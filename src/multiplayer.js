const SESSION_KEY = 'geek-lagoon-room';
export class MultiplayerClient {
  constructor({ onState, onConnection, onError }) {
    Object.assign(this, { onState, onConnection, onError }); this.stopped = true; this.connected = false;
  }
  async request(path, body) {
    const response = await fetch(`/api/rooms${path}`, { method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body && JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    let result;
    try { result = await response.json(); } catch { throw new Error('ระบบห้องยังไม่พร้อมใช้งาน กรุณาลองใหม่ หรือเล่น Solo'); }
    if (!response.ok) throw new Error(result.error || 'เชื่อมต่อห้องไม่ได้');
    return result;
  }
  list() { return this.request(''); }
  async create(options, profile) {
    const result = await this.request('', { ...options, profile });
    this.attach({ roomId: result.room.id, playerId: result.playerId, token: result.token });
    return result;
  }
  async join(roomId, profile) {
    const result = await this.request(`/${roomId}/join`, { profile });
    this.attach({ roomId, playerId: result.playerId, token: result.token }); return result;
  }
  resume() {
    try { const session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); if (session?.roomId && session?.token) { this.attach(session); return true; } } catch {}
    return false;
  }
  attach(session) {
    this.closeSocket(); this.session = session; this.stopped = false; this.attempt = 0; this.offlineAt = Date.now();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    this.connect();
  }
  connect() {
    if (this.stopped) return;
    this.onConnection('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${this.session.roomId}/ws`);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', playerId: this.session.playerId, token: this.session.token }));
    socket.onmessage = event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      this.lastMessage = Date.now();
      if (message.type === 'state') {
        if (!this.connected) { this.connected = true; this.attempt = 0; this.onConnection('connected'); }
        this.onState(message.state, this.session.playerId);
      } else if (message.type === 'error') this.onError(message.error);
    };
    socket.onclose = event => {
      if (this.socket !== socket || this.stopped) return;
      if (this.connected) this.offlineAt = Date.now();
      this.connected = false; clearInterval(this.heartbeat);
      if ([1008, 4001].includes(event.code) || Date.now() - this.offlineAt >= 60_000) {
        this.stopped = true; try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        this.onConnection('expired'); this.onError(event.code === 4001 ? 'ห้องนี้ถูกเปิดในแท็บอื่นแล้ว' : 'เชื่อมต่อห้องไม่สำเร็จ กรุณากลับไปเข้าห้องใหม่'); return;
      }
      this.onConnection('reconnecting');
      this.retry = setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.attempt++));
    };
    this.heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        if (this.lastMessage && Date.now() - this.lastMessage > 45_000) socket.close();
        else socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000);
  }
  send(message) {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message)); return true;
  }
  closeSocket() { clearTimeout(this.retry); clearInterval(this.heartbeat); if (this.socket) { this.socket.onclose = null; this.socket.onmessage = null; this.socket.onopen = null; this.socket.close(); } this.connected = false; }
  leave() {
    this.send({ type: 'leave' }); this.stopped = true; this.closeSocket(); this.session = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }
}
