import { COURSES } from './courses.js';
import { OUTFITS } from './profile.js';
import { ProfilePreview } from './profile-preview.js';

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const score = n => n === 0 ? 'E' : n > 0 ? `+${n}` : String(n);
export class RoomUI {
  constructor({ client, profile, open, onSolo, onLeave, onName, onProfileChange }) {
    Object.assign(this, { client, profile, open, onSolo, onLeave, onName, onProfileChange }); this.screen = 'game';
  }
  show(content) {
    this.preview?.dispose();this.preview=null;
    this.open(content, false);
    document.querySelector('#modal').classList.add('room-modal');
  }
  home(invitedRoom=null) {
    this.stopRefresh(); this.screen = 'home';
    const draft={name:this.profile.name,character:this.profile.character,outfit:this.profile.outfit};
    this.show(`<div class="eyebrow">GEEK LAGOON · CLUBHOUSE</div><h2 id="modal-title">Your golfer. Your game.</h2><p>ตั้งชื่อ แต่งตัว แล้วเลือกว่าจะออกรอบแบบไหน</p><section class="entry-profile" aria-label="ตั้งผู้เล่นก่อนเข้าเกม"><div class="entry-preview"><canvas id="entry-preview" role="img" aria-label="ตัวอย่างนักกอล์ฟและชุดที่เลือก"></canvas><span id="entry-outfit-label">${escape(OUTFITS[draft.outfit].name)}</span></div><div class="entry-profile-fields"><label for="entry-name">ชื่อผู้เล่น</label><input id="entry-name" maxlength="20" required value="${escape(draft.name)}" autocomplete="nickname" placeholder="ชื่อที่เพื่อนจะเห็น"><fieldset class="profile-field"><legend>ตัวละคร</legend><div class="profile-choices"><button type="button" class="profile-choice" data-entry-character="female" aria-pressed="${draft.character==='female'}"><span class="profile-avatar">🏌🏻‍♀️</span><strong>หญิง</strong></button><button type="button" class="profile-choice" data-entry-character="male" aria-pressed="${draft.character==='male'}"><span class="profile-avatar">🏌🏻‍♂️</span><strong>ชาย</strong></button></div></fieldset><fieldset class="profile-field entry-outfits"><legend>เลือกชุด</legend><div class="outfit-choices">${Object.entries(OUTFITS).map(([id,outfit])=>`<button type="button" class="outfit-choice" data-entry-outfit="${id}" aria-label="ชุด ${escape(outfit.name)}" aria-pressed="${draft.outfit===id}"><span class="outfit-swatch" style="--shirt:#${outfit.shirt.toString(16).padStart(6,'0')};--cap:#${outfit.cap.toString(16).padStart(6,'0')};--bottom:#${outfit.bottom.toString(16).padStart(6,'0')}"></span><span>${escape(outfit.name)}</span></button>`).join('')}</div></fieldset></div></section><div class="entry-mode-title">${invitedRoom?'เพื่อนชวนคุณมาออกรอบ · พร้อมแล้วกด Join Room':'พร้อมแล้ว เลือกโหมดเล่น'}</div><div class="play-modes"><button id="solo-mode"><span>⛳</span><strong>Solo Player</strong><small>เล่นคนเดียว เลือกสนามแล้วเริ่มได้เลย</small></button><button id="create-mode"><span>＋</span><strong>Create Room</strong><small>สร้างห้อง เลือกสนาม ชวนเพื่อน 2–4 คน</small></button><button id="join-mode"><span>↗</span><strong>Join Room</strong><small>${invitedRoom?'เข้าห้องที่เพื่อนส่งลิงก์มาให้':'เลือกห้องที่เปิดอยู่ แล้วเข้าไปเล่นด้วยกัน'}</small></button></div>`);
    document.querySelector('#modal').classList.add('entry-modal');
    document.querySelector('#modal').setAttribute('tabindex','-1');document.querySelector('#modal').focus({preventScroll:true});
    try{this.preview=new ProfilePreview(document.querySelector('#entry-preview'),{character:draft.character,outfit:OUTFITS[draft.outfit]});}catch{document.querySelector('.entry-preview').classList.add('preview-unavailable');}
    const preview=()=>{
      this.preview?.setAppearance({character:draft.character,outfit:OUTFITS[draft.outfit]});
      document.querySelector('#entry-outfit-label').textContent=OUTFITS[draft.outfit].name;
      document.querySelectorAll('[data-entry-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entryCharacter===draft.character)));
      document.querySelectorAll('[data-entry-outfit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entryOutfit===draft.outfit)));
    };
    document.querySelectorAll('[data-entry-character]').forEach(b=>b.onclick=()=>{draft.character=b.dataset.entryCharacter;preview();});
    document.querySelectorAll('[data-entry-outfit]').forEach(b=>b.onclick=()=>{draft.outfit=b.dataset.entryOutfit;preview();});
    const commit=()=>{
      const input=document.querySelector('#entry-name');draft.name=input.value.trim();
      input.setCustomValidity(draft.name?'':'กรุณาตั้งชื่อผู้เล่นก่อนเข้าเกม');if(!input.reportValidity())return false;
      this.onProfileChange(draft);return true;
    };
    document.querySelector('#entry-name').oninput=event=>event.target.setCustomValidity('');
    document.querySelector('#solo-mode').onclick=()=>{if(commit())this.solo();};
    document.querySelector('#create-mode').onclick=()=>{if(commit())this.create();};
    document.querySelector('#join-mode').onclick=()=>{if(commit())invitedRoom?this.joinInvitation(invitedRoom):this.join();};
  }
  async joinInvitation(roomId){
    let cancelled=false;
    this.screen='connecting';this.show('<h2 id="modal-title">กำลังเข้าห้องเพื่อน…</h2><p>พร้อมออกรอบด้วยกันแล้ว</p><button class="primary" id="cancel-invitation">กลับคลับเฮาส์</button>');
    document.querySelector('#cancel-invitation').onclick=()=>{cancelled=true;this.onLeave();};
    try{await this.client.join(roomId,this.profile);if(cancelled)this.client.leave();}catch(error){if(!cancelled)this.error(error.message);}
  }
  back() { return '<button class="room-back" id="room-back">← กลับ</button>'; }
  bindBack() { document.querySelector('#room-back').onclick = () => this.home(); }
  courseOptions() { return Object.values(COURSES).map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join(''); }
  solo() {
    this.screen = 'solo';
    this.show(`${this.back()}<div class="eyebrow">SOLO PLAYER</div><h2 id="modal-title">สนามของคุณ จังหวะของคุณ</h2><p>เล่นคนเดียวโดยไม่ต้องเข้าห้อง</p><section class="course-picker">${Object.values(COURSES).map(c => `<article class="course-choice"><div class="course-art ${c.theme}" aria-hidden="true"></div><div class="course-copy"><h3>${escape(c.name)}</h3><small>${escape(c.subtitle)}</small><p>${escape(c.description)}</p></div><div class="course-actions"><button class="course-start" data-course="${c.id}" data-length="9">9 หลุม</button><button class="course-start quick" data-course="${c.id}" data-length="3">3 หลุม</button></div></article>`).join('')}</section>`);
    this.bindBack();
    document.querySelectorAll('#modal [data-course]').forEach(b => b.onclick = () => { this.screen = 'game'; this.onSolo(b.dataset.course, Number(b.dataset.length)); });
  }
  create() {
    this.screen = 'create';
    this.show(`${this.back()}<div class="eyebrow">CREATE ROOM</div><h2 id="modal-title">นัดเพื่อนมาออกรอบ</h2><form id="create-room-form"><label for="room-name">ชื่อห้อง</label><input id="room-name" maxlength="32" required value="${escape(this.profile.name)}'s room"><label for="room-player-name">ชื่อผู้เล่น</label><input id="room-player-name" maxlength="20" required value="${escape(this.profile.name)}" autocomplete="nickname"><div class="room-form-grid"><div><label for="room-course">สนาม</label><select id="room-course">${this.courseOptions()}</select></div><div><label for="room-capacity">จำนวนคนสูงสุด</label><select id="room-capacity"><option value="2">2 คน</option><option value="3">3 คน</option><option value="4" selected>4 คน</option></select></div><div><label for="room-length">จำนวนหลุม</label><select id="room-length"><option value="9">9 หลุม</option><option value="3">3 หลุม</option></select></div></div><p id="room-error" class="room-error" role="alert"></p><button class="primary" id="room-create-submit" type="submit">สร้างห้อง</button></form>`);
    this.bindBack();
    document.querySelector('#create-room-form').onsubmit = async event => {
      event.preventDefault(); const button = document.querySelector('#room-create-submit'); button.disabled = true; button.textContent = 'กำลังสร้างห้อง…';
      this.onName(document.querySelector('#room-player-name').value);
      try {
        await this.client.create({ name: document.querySelector('#room-name').value.trim(), courseId: document.querySelector('#room-course').value,
          capacity: Number(document.querySelector('#room-capacity').value), roundLength: Number(document.querySelector('#room-length').value) }, this.profile);
        this.screen = 'connecting'; this.show('<h2 id="modal-title">กำลังเข้าห้อง…</h2><p>เตรียมสนามให้เพื่อนของคุณ</p><button class="primary" id="cancel-room">กลับคลับเฮาส์</button>');
        document.querySelector('#cancel-room').onclick = () => this.onLeave();
      } catch (error) { document.querySelector('#room-error').textContent = error.message; button.disabled = false; button.textContent = 'สร้างห้อง'; }
    };
  }
  join() {
    this.stopRefresh(); this.screen = 'join';
    this.show(`${this.back()}<div class="eyebrow">JOIN ROOM</div><h2 id="modal-title">มีใครอยู่ในสนามบ้าง</h2><label for="join-player-name">ชื่อผู้เล่น</label><input id="join-player-name" maxlength="20" value="${escape(this.profile.name)}" autocomplete="nickname"><div class="room-list-title"><span>ห้องที่เปิดอยู่</span><button id="refresh-rooms">↻ รีเฟรช</button></div><p id="room-error" class="room-error" role="alert"></p><div id="room-list" class="room-list" aria-live="polite">กำลังค้นหาห้อง…</div>`);
    this.bindBack(); document.querySelector('#refresh-rooms').onclick = () => this.refresh();
    this.refresh(); this.refreshTimer = setInterval(() => this.refresh(), 5000);
  }
  async refresh() {
    if (this.screen !== 'join' || this.refreshing) return; this.refreshing = true;
    try {
      const { rooms } = await this.client.list(); if (this.screen !== 'join') return;
      document.querySelector('#room-error').textContent = '';
      document.querySelector('#room-list').innerHTML = rooms.length ? rooms.map(r => `<article class="room-row"><div><strong>${escape(r.name)}</strong><small>${escape(COURSES[r.courseId]?.name || r.courseId)} · ${r.roundLength} หลุม · ${r.players}/${r.capacity} คน</small></div><button data-join="${escape(r.id)}" ${r.joinable ? '' : 'disabled'}>${r.joinable ? 'เข้าห้อง' : r.status === 'playing' ? 'กำลังเล่น' : 'เต็มแล้ว'}</button></article>`).join('') : '<div class="rooms-empty">ยังไม่มีห้องเปิดอยู่<br><small>สร้างห้องแล้วชวนเพื่อนมาเล่นกัน</small><button id="empty-create">Create Room</button></div>';
      document.querySelector('#empty-create')?.addEventListener('click', () => { this.stopRefresh(); this.create(); });
      document.querySelectorAll('[data-join]').forEach(button => button.onclick = async () => {
        button.disabled = true; this.onName(document.querySelector('#join-player-name').value);
        try { await this.client.join(button.dataset.join, this.profile); this.stopRefresh(); this.screen = 'connecting'; }
        catch (error) { document.querySelector('#room-error').textContent = error.message; button.disabled = false; }
      });
    } catch (error) { if (this.screen === 'join') { document.querySelector('#room-error').textContent = error.message; document.querySelector('#room-list').innerHTML = '<div class="rooms-empty">ค้นหาห้องไม่สำเร็จ กดรีเฟรชเพื่อลองใหม่</div>'; } }
    finally { this.refreshing = false; }
  }
  stopRefresh() { clearInterval(this.refreshTimer); }
  state(room, playerId) {
    this.stopRefresh(); this.room = room; this.playerId = playerId;
    if (room.status === 'lobby') {
      const key = JSON.stringify([room.revision, room.players.map(p => [p.id, p.ready, p.connected]), room.hostId]);
      if (this.screen === 'lobby' && key === this.lobbyKey) return;
      const focusId = document.activeElement?.id; this.lobbyKey = key; this.screen = 'lobby';
      const me = room.players.find(p => p.id === playerId), host = room.hostId === playerId;
      const ready = room.players.length >= 2 && room.players.every(p => p.ready && p.connected);
      this.show(`<div class="eyebrow">ROOM · ${escape(COURSES[room.courseId].name)} · ${room.roundLength} HOLES</div><h2 id="modal-title">${escape(room.name)}</h2><p>สนามเต็มจอเดียว เห็นเพื่อนเล่นด้วยกัน · จบหลุมแล้วรอทุกคน</p><div class="room-players">${Array.from({ length: room.capacity }, (_, i) => {
        const p = room.players[i]; return p ? `<div class="room-player"><span class="room-player-avatar">${p.profile.character === 'male' ? '🏌🏻‍♂️' : '🏌🏻‍♀️'}</span><div><strong>${escape(p.profile.name)}${p.id === playerId ? ' · คุณ' : ''}</strong><small>${p.id === room.hostId ? 'เจ้าของห้อง · ' : ''}${p.connected ? p.ready ? 'พร้อมแล้ว ✓' : 'ยังไม่พร้อม' : 'กำลังเชื่อมต่อ…'}</small></div><i class="ready-dot ${p.ready && p.connected ? 'is-ready' : ''}"></i></div>` : '<div class="room-player empty-seat">＋ รอเพื่อนเข้าห้อง</div>';
      }).join('')}</div><p class="room-error" id="room-error" role="alert"></p><button class="primary" id="room-ready">${me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว'}</button>${host ? `<button class="primary" id="room-start" ${ready ? '' : 'disabled'}>เริ่มเกมพร้อมกัน</button>` : '<p class="waiting-host">รอเจ้าของห้องเริ่มเกม</p>'}<div class="room-lobby-actions"><button id="copy-room-link">คัดลอกลิงก์ชวนเพื่อน</button><button id="leave-lobby">ออกจากห้อง</button></div>`);
      document.querySelector('#room-ready').onclick = () => this.client.send({ type: 'ready', ready: !me.ready });
      document.querySelector('#room-start')?.addEventListener('click', () => this.client.send({ type: 'start' }));
      document.querySelector('#leave-lobby').onclick = () => this.onLeave();
      document.querySelector('#copy-room-link').onclick = async () => {
        const url = `${location.origin}/?room=${room.id}`;
        try { await navigator.clipboard.writeText(url); document.querySelector('#copy-room-link').textContent = 'คัดลอกแล้ว ✓'; }
        catch { document.querySelector('#room-error').textContent = url; }
      };
      if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
    } else if (room.status === 'finished') {
      if (this.screen === 'results') return; this.screen = 'results';
      const par = COURSES[room.courseId].holes.slice(0, room.roundLength).reduce((s, h) => s + h.par, 0);
      const ranked = [...room.players].sort((a, b) => Number(a.withdrawn) - Number(b.withdrawn) || a.scores.reduce((s, x) => s + x, 0) - b.scores.reduce((s, x) => s + x, 0));
      this.show(`<div class="eyebrow">ROUND COMPLETE · ${room.roundLength} HOLES</div><h2 id="modal-title">Good game, everyone.</h2><p>${escape(room.name)} · ${escape(COURSES[room.courseId].name)}</p><table class="score-table"><thead><tr><th>อันดับ</th><th>ผู้เล่น</th><th>ช็อต</th><th>คะแนน</th></tr></thead><tbody>${ranked.map((p, i) => { const total = p.scores.reduce((s, x) => s + x, 0); return `<tr><td>${p.withdrawn ? '—' : i + 1}</td><td>${escape(p.profile.name)}${p.id === playerId ? ' · คุณ' : ''}${p.withdrawn ? ' (ออกจากห้อง)' : ''}</td><td>${total}</td><td>${score(total - par)}</td></tr>`; }).join('')}</tbody></table><button class="primary" id="round-home">กลับคลับเฮาส์</button>`);
      document.querySelector('#round-home').onclick = () => this.onLeave();
    } else if (this.screen === 'lobby' || this.screen === 'connecting') { this.screen = 'game'; document.querySelector('#overlay').hidden = true; document.querySelector('#world').focus(); }
  }
  error(message) {
    const target = document.querySelector('#room-error');
    if (target) target.textContent = message;
    else if (this.screen === 'connecting') {
      this.show(`<div class="eyebrow">ROOM CONNECTION</div><h2 id="modal-title">เข้าห้องไม่สำเร็จ</h2><p class="room-error" role="alert">${escape(message)}</p><button class="primary" id="connection-home">กลับคลับเฮาส์</button>`);
      document.querySelector('#connection-home').onclick = () => this.onLeave();
    }
  }
}
