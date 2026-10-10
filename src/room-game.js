import { COURSES } from './courses.js';
import { BALL_RADIUS, CLUBS, launch, stepBall, terrainHeight, randomWind } from './physics.js';
import { IMPACT_TIME, SWING_DURATION, shotAccuracy } from './shot.js';

export const MAX_STROKES = 12;
export const RECONNECT_GRACE = 60_000;
export const NEXT_HOLE_DELAY = 4;
const TEE_LANE_SPACING = 2;
export function publicProfile(profile = {}) {
  return {
    name: String(profile.name || 'Guest golfer').trim().slice(0, 20) || 'Guest golfer',
    character: profile.character === 'male' ? 'male' : 'female',
    outfit: ['coral', 'lagoon', 'sky', 'sunset'].includes(profile.outfit) ? profile.outfit : 'coral',
  };
}

// This model runs on the server. Clients submit shots, never positions or scores.
export class RoomGame {
  constructor({ id, name, courseId = 'lagoon', capacity = 4, roundLength = 9 }, random = Math.random) {
    if (!COURSES[courseId] || ![2, 3, 4].includes(capacity) || ![3, 9].includes(roundLength)) throw new Error('ข้อมูลห้องไม่ถูกต้อง');
    this.random = random;
    this.state = { id, name: String(name || 'Golf with friends').trim().slice(0, 32), courseId, capacity, roundLength,
      status: 'lobby', holeIndex: 0, wind: { x: 0, z: 0 }, players: [], hostId: null, nextHoleIn: null, revision: 0 };
  }
  get hole() { return COURSES[this.state.courseId].holes[this.state.holeIndex]; }
  player(id) { return this.state.players.find(p => p.id === id); }
  addPlayer(id, profile, now = Date.now()) {
    if (this.state.status !== 'lobby') throw new Error('ห้องนี้เริ่มเล่นแล้ว');
    if (this.state.players.length >= this.state.capacity) throw new Error('ห้องเต็มแล้ว');
    const p = { id, profile: publicProfile(profile), ready: false, connected: false, disconnectedAt: now,
      withdrawn: false, done: false, strokes: 0, scores: [], ball: null, bearing: 0, club: 'driver',
      motion: { phase: 'idle', elapsed: 0, power: 80 }, commands: [], effects: [], effectSerial: 0 };
    this.state.players.push(p);
    this.state.hostId ||= id;
    this.changed();
    return p;
  }
  changed() { this.state.revision++; }
  connect(id, now = Date.now()) {
    const p = this.player(id);
    if (!p || p.withdrawn) throw new Error('ไม่พบผู้เล่นในห้อง');
    p.connected = true; p.disconnectedAt = null; p.lastSeen = now;
    // Joining sockets can authenticate in any order; keep the creator's reserved seat.
    // A previously connected host can still transfer to the first returning player.
    const host = this.player(this.state.hostId);
    if (!host || host.withdrawn || (!host.connected && host.lastSeen !== undefined)) this.state.hostId = id;
    this.changed();
  }
  disconnect(id, now = Date.now()) {
    const p = this.player(id); if (!p || p.withdrawn) return;
    p.connected = false; p.disconnectedAt = now;
    const next = this.state.players.find(p => p.connected && !p.withdrawn);
    if (id === this.state.hostId && next) this.state.hostId = next.id;
    this.changed();
  }
  leave(id) {
    const p = this.player(id); if (!p) return;
    if (this.state.status === 'lobby') this.state.players = this.state.players.filter(p => p.id !== id);
    else { p.withdrawn = true; p.connected = false; p.motion.phase = 'waiting'; this.finishPlayer(p, MAX_STROKES); }
    if (this.state.hostId === id) this.state.hostId = this.state.players.find(p => p.connected && !p.withdrawn)?.id || this.state.players.find(p => !p.withdrawn)?.id || null;
    this.changed();
    this.checkBarrier();
  }
  expireDisconnected(now = Date.now()) {
    for (const p of [...this.state.players]) if (!p.connected && !p.withdrawn && now - p.disconnectedAt >= RECONNECT_GRACE) this.leave(p.id);
  }
  command(id, message) {
    const p = this.player(id);
    if (!p || !p.connected || p.withdrawn) throw new Error('กรุณาเชื่อมต่อห้องใหม่');
    if (message.type === 'ready') {
      if (this.state.status !== 'lobby') throw new Error('เกมเริ่มแล้ว');
      p.ready = Boolean(message.ready); this.changed(); return;
    }
    if (message.type === 'start') {
      if (id !== this.state.hostId) throw new Error('เจ้าของห้องเท่านั้นที่เริ่มเกมได้');
      if (this.state.status !== 'lobby') throw new Error('เกมเริ่มแล้ว');
      if (this.state.players.length < 2 || !this.state.players.every(p => p.connected && p.ready)) throw new Error('ต้องมีอย่างน้อย 2 คน และทุกคนกดพร้อม');
      this.state.status = 'playing'; this.startHole(); return;
    }
    if (message.type === 'leave') { this.leave(id); return; }
    if (this.state.status !== 'playing' || message.holeIndex !== this.state.holeIndex || p.done) throw new Error('รอหลุมถัดไปก่อน');
    if (message.type === 'aim') {
      if (p.motion.phase !== 'idle') return;
      if (!Number.isFinite(message.bearing) || Math.abs(message.bearing) > Math.PI * 4 || !CLUBS[message.club]) throw new Error('ข้อมูลการเล็งไม่ถูกต้อง');
      p.bearing = message.bearing; p.club = message.club; this.changed(); return;
    }
    if (message.type !== 'shot') throw new Error('คำสั่งไม่ถูกต้อง');
    if (typeof message.commandId !== 'string' || message.commandId.length > 64) throw new Error('รหัสช็อตไม่ถูกต้อง');
    if (p.commands.includes(message.commandId)) return; // Retry/reconnect cannot count a shot twice.
    if (p.motion.phase !== 'idle') throw new Error('รอลูกหยุดก่อน');
    if (!CLUBS[message.club] || !Number.isFinite(message.power) || message.power < 0 || message.power > 100 ||
      !Number.isFinite(message.error) || message.error < -15 || message.error > 85 ||
      !Number.isFinite(message.bearing) || Math.abs(message.bearing) > Math.PI * 4) throw new Error('ข้อมูลช็อตไม่ถูกต้อง');
    p.commands.push(message.commandId); p.commands = p.commands.slice(-24);
    p.club = message.club; p.bearing = message.bearing; p.lastSafe = { ...p.ball };
    p.motion = { phase: 'swinging', elapsed: 0, power: message.power, error: message.error,
      perfect: Math.abs(message.error) <= 2, origin: { ...p.ball }, impacted: false };
    p.accumulator = 0; this.changed();
  }
  startHole() {
    this.state.wind = randomWind(this.random); this.state.nextHoleIn = null;
    for (const [index, p] of this.state.players.entries()) {
      p.strokes = 0; p.done = false; p.club = 'driver'; p.accumulator = 0;
      p.effects = []; p.effectSerial = 0;
      const heading = Math.atan2(this.hole.pin[0] - this.hole.tee[0], this.hole.pin[1] - this.hole.tee[1]);
      const offset = (index - (this.state.players.length - 1) / 2) * TEE_LANE_SPACING;
      const x = this.hole.tee[0] + Math.cos(heading) * offset, z = this.hole.tee[1] - Math.sin(heading) * offset;
      p.ball = { x, z, y: terrainHeight(x, z, this.hole) + BALL_RADIUS, status: 'stopped' };
      p.bearing = Math.atan2(this.hole.pin[0] - p.ball.x, this.hole.pin[1] - p.ball.z);
      p.motion = { phase: 'idle', elapsed: 0, power: 80 };
      if (p.withdrawn) this.finishPlayer(p, MAX_STROKES);
    }
    this.changed();
  }
  finishPlayer(p, strokes = p.strokes) {
    if (p.done) return;
    p.strokes = Math.min(MAX_STROKES, strokes); p.done = true;
    p.scores[this.state.holeIndex] = p.strokes; p.motion.phase = 'waiting';
    this.changed();
  }
  checkBarrier() {
    if (this.state.status === 'playing' && this.state.players.length && this.state.players.every(p => p.done) && this.state.nextHoleIn === null) {
      this.state.nextHoleIn = NEXT_HOLE_DELAY; this.changed();
    }
  }
  tick(dt) {
    if (this.state.status !== 'playing') return;
    // A barrier established during this tick should receive its full countdown.
    const countdown = this.state.nextHoleIn !== null;
    for (const p of this.state.players) {
      if (p.done || p.motion.phase === 'idle') continue;
      const motion = p.motion; motion.elapsed += dt;
      if (!motion.impacted && motion.elapsed >= IMPACT_TIME) {
        const accuracy = shotAccuracy(motion.error);
        p.ball = launch(motion.origin, p.club, motion.power * accuracy.powerScale, p.bearing + accuracy.bearingOffset, this.hole);
        p.strokes++; motion.impacted = true; p.accumulator = Math.max(0, motion.elapsed - IMPACT_TIME);
      } else if (motion.impacted) p.accumulator += dt;
      while (p.accumulator >= 1 / 120 && p.ball.status === 'moving') {
        const previousImpact=p.ball.impactSerial||0;
        stepBall(p.ball, 1 / 120, this.hole, this.state.wind); p.accumulator -= 1 / 120;
        for(const event of p.ball.impacts||[])if(event.id>previousImpact){
          p.effectSerial=(p.effectSerial||0)+1;p.effects=[...(p.effects||[]),{...event,id:p.effectSerial}].slice(-8);
        }
      }
      if(p.ball.status==='water'&&motion.waterUntil===undefined)motion.waterUntil=motion.elapsed+.9;
      if (motion.elapsed < SWING_DURATION) continue;
      motion.phase = 'flight';
      if (p.ball.status === 'moving') continue;
      if(p.ball.status==='water'&&motion.elapsed<motion.waterUntil)continue;
      if (p.ball.status === 'holed') this.finishPlayer(p);
      else {
        if (p.ball.status === 'water') { p.ball = { ...p.lastSafe }; p.strokes++; }
        p.motion = { phase: 'idle', elapsed: 0, power: motion.power };
        p.bearing = Math.atan2(this.hole.pin[0] - p.ball.x, this.hole.pin[1] - p.ball.z);
        if (p.strokes >= MAX_STROKES) this.finishPlayer(p, MAX_STROKES);
      }
      this.changed();
    }
    this.checkBarrier();
    if (countdown) {
      this.state.nextHoleIn = Math.max(0, this.state.nextHoleIn - dt);
      if (this.state.nextHoleIn === 0) {
        if (this.state.holeIndex + 1 >= this.state.roundLength) { this.state.status = 'finished'; this.changed(); }
        else { this.state.holeIndex++; this.startHole(); }
      }
    }
  }
  snapshot() {
    return { ...this.state, players: this.state.players.map(({ commands, accumulator, lastSafe, lastSeen, disconnectedAt, effectSerial, ...p }) => {
      const {impacts,impactSerial,...ball}=p.ball||{};
      return { ...p, effects:(p.effects||[]).map(e=>({...e})), profile: { ...p.profile }, scores: [...p.scores], ball:p.ball?ball:null, motion: { ...p.motion } };
    }) };
  }
  summary() {
    const s = this.state;
    return { id: s.id, name: s.name, courseId: s.courseId, capacity: s.capacity, roundLength: s.roundLength,
      players: s.players.filter(p => !p.withdrawn).length, status: s.status, joinable: s.status === 'lobby' && s.players.length < s.capacity };
  }
}
