import { RoomGame, RECONNECT_GRACE } from '../src/room-game.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const roomId = /^[a-f0-9-]{36}$/;
const directory = env => env.DIRECTORY.get(env.DIRECTORY.idFromName('public-rooms'));
const room = (env, id) => env.GOLF_ROOM.get(env.GOLF_ROOM.idFromName(id));
const internal = (path, data) => new Request(`https://room.internal/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (Number(request.headers.get('Content-Length')) > 2048) return json({ error: 'ข้อมูลใหญ่เกินไป' }, 413);
    if (request.method !== 'GET' || request.headers.get('Upgrade') === 'websocket') {
      const origin = request.headers.get('Origin');
      if (origin) {
        let host; try { host = new URL(origin).hostname; } catch { return json({ error: 'Origin not allowed' }, 403); }
        if (!['minigolf.aiyarafun.com', 'minigolf-43b.pages.dev', 'localhost', '127.0.0.1', url.hostname].includes(host)) return json({ error: 'Origin not allowed' }, 403);
      }
    }
    try {
      if (url.pathname === '/api/rooms') {
        if (request.method === 'GET') return directory(env).fetch('https://directory.internal/list');
        if (request.method === 'POST') {
          if (Number(request.headers.get('Content-Length')) > 2048) return json({ error: 'ข้อมูลใหญ่เกินไป' }, 413);
          const data = await request.json();
          return directory(env).fetch(internal('create', { ...data, ip: request.headers.get('CF-Connecting-IP') || 'local' }));
        }
      }
      const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|ws)$/);
      if (match && roomId.test(match[1])) {
        if (match[2] === 'ws' && request.headers.get('Upgrade') === 'websocket') return room(env, match[1]).fetch(request);
        if (match[2] === 'join' && request.method === 'POST') return room(env, match[1]).fetch(internal('join', await request.json()));
      }
      return json({ error: 'ไม่พบห้องหรือ endpoint' }, 404);
    } catch (error) { return json({ error: error.message || 'เชื่อมต่อห้องไม่ได้' }, 400); }
  },
};

export class RoomDirectory {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.limits = new Map(); }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/list') {
      const rooms = await this.ctx.storage.list({ prefix: 'room:' });
      const fresh = [...rooms.values()].filter(r => Date.now() - r.updatedAt < 2 * 60 * 60_000 && r.players > 0 && r.status !== 'finished');
      return json({ rooms: fresh.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 100) });
    }
    const data = await request.json();
    if (path === '/update') { await this.ctx.storage.put(`room:${data.id}`, { ...data, updatedAt: Date.now() }); return json({ ok: true }); }
    if (path === '/remove') { await this.ctx.storage.delete(`room:${data.id}`); return json({ ok: true }); }
    if (path !== '/create') return json({ error: 'Not found' }, 404);
    const recent = (this.limits.get(data.ip) || []).filter(t => Date.now() - t < 60_000);
    if (recent.length >= 6) return json({ error: 'สร้างห้องบ่อยเกินไป กรุณารอสักครู่' }, 429);
    recent.push(Date.now()); this.limits.set(data.ip, recent);
    const id = crypto.randomUUID();
    const response = await room(this.env, id).fetch(internal('create', { ...data, id }));
    if (response.ok) {
      const result = await response.json();
      await this.ctx.storage.put(`room:${id}`, { ...result.room, updatedAt: Date.now() });
      return json(result, 201);
    }
    return response;
  }
}

export class GolfRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sessions = {}; this.timer = null; this.lastPersist = 0; this.lastActivity = Date.now();
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('room');
      if (saved) {
        this.game = new RoomGame(saved.state); this.game.state = saved.state;
        this.sessions = saved.sessions; this.lastActivity = saved.lastActivity;
      }
      if (ctx.getWebSockets().some(ws => ws.deserializeAttachment()?.playerId)) this.startLoop();
    });
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.headers.get('Upgrade') === 'websocket') {
      if (!this.game) return json({ error: 'ไม่พบห้องนี้' }, 404);
      if (this.ctx.getWebSockets().length >= 12) return json({ error: 'ห้องมีการเชื่อมต่อมากเกินไป' }, 429);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId: null, createdAt: Date.now() });
      this.ctx.waitUntil(this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE));
      return new Response(null, { status: 101, webSocket: client });
    }
    try {
      const data = await request.json();
      if (path === '/create') {
        if (this.game) return json({ error: 'ห้องนี้มีอยู่แล้ว' }, 409);
        this.game = new RoomGame(data);
      } else if (!this.game) return json({ error: 'ไม่พบห้องนี้' }, 404);
      if (path === '/create' || path === '/join') {
        this.game.expireDisconnected();
        const id = crypto.randomUUID(), token = crypto.randomUUID() + crypto.randomUUID();
        this.game.addPlayer(id, data.profile); this.sessions[id] = token; this.lastActivity = Date.now();
        await this.persist(); this.broadcast(); await this.updateDirectory();
        await this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE);
        return json({ playerId: id, token, room: this.game.summary() });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) { return json({ error: error.message }, 400); }
  }
  async webSocketMessage(ws, data) {
    let attachment = ws.deserializeAttachment();
    try {
      if (typeof data !== 'string' || data.length > 2048) throw new Error('ข้อความไม่ถูกต้อง');
      const message = JSON.parse(data);
      if (!attachment.playerId) {
        if (message.type !== 'auth' || !this.sessions[message.playerId] || this.sessions[message.playerId] !== message.token) { ws.close(1008, 'Invalid session'); return; }
        for (const other of this.ctx.getWebSockets()) if (other !== ws && other.deserializeAttachment()?.playerId === message.playerId) {
          other.serializeAttachment({ playerId: null, createdAt: 0 }); other.close(4001, 'Session opened elsewhere');
        }
        this.game.connect(message.playerId);
        attachment = { playerId: message.playerId, createdAt: Date.now() }; ws.serializeAttachment(attachment);
      } else if (message.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      else {
        this.game.command(attachment.playerId, message);
        if (message.type === 'leave') { ws.serializeAttachment({ playerId: null, createdAt: 0 }); ws.close(1000, 'Left room'); }
      }
      this.lastActivity = Date.now();
      await this.persist(); this.broadcast(); this.startLoop();
      await this.updateDirectory(); await this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE);
    } catch (error) { try { ws.send(JSON.stringify({ type: 'error', error: error.message })); } catch {} }
  }
  async webSocketClose(ws) { await this.closed(ws); }
  async webSocketError(ws) { await this.closed(ws); }
  async closed(ws) {
    const id = ws.deserializeAttachment()?.playerId;
    if (id && !this.ctx.getWebSockets().some(other => other !== ws && other.deserializeAttachment()?.playerId === id)) this.game?.disconnect(id);
    if (!this.ctx.getWebSockets().some(other => other !== ws && other.deserializeAttachment()?.playerId)) this.stopLoop();
    await this.persist(); this.broadcast(); await this.updateDirectory(); await this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE);
  }
  startLoop() {
    if (this.timer || this.game?.state.status !== 'playing') return;
    let previous = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now(), dt = Math.min(.25, (now - previous) / 1000); previous = now;
      this.game.tick(dt); this.game.expireDisconnected(now); this.broadcast();
      if (now - this.lastPersist > 1000) { this.lastPersist = now; this.ctx.waitUntil(this.persist()); }
      if (this.game.state.status !== 'playing') { this.stopLoop(); this.ctx.waitUntil(this.updateDirectory()); this.ctx.waitUntil(this.persist()); }
    }, 1000 / 15);
  }
  stopLoop() { clearInterval(this.timer); this.timer = null; }
  broadcast() {
    if (!this.game) return;
    const message = JSON.stringify({ type: 'state', state: this.game.snapshot() });
    for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.playerId) try { ws.send(message); } catch {}
  }
  async persist() {
    if (this.game) await this.ctx.storage.put('room', { state: this.game.state, sessions: this.sessions, lastActivity: this.lastActivity });
  }
  async updateDirectory() { if (this.game) await directory(this.env).fetch(internal('update', this.game.summary())); }
  async alarm() {
    if (!this.game) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a?.playerId && Date.now() - (a?.createdAt || 0) > 10_000) ws.close(1008, 'Authentication required');
    }
    this.game.expireDisconnected(); this.broadcast(); await this.persist(); await this.updateDirectory();
    if (!this.ctx.getWebSockets().some(ws => ws.deserializeAttachment()?.playerId) && Date.now() - this.lastActivity > 20 * 60_000) {
      this.stopLoop(); await directory(this.env).fetch(internal('remove', { id: this.game.state.id })); await this.ctx.storage.deleteAll(); this.game = null;
    } else await this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE);
  }
}
