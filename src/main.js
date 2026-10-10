import './style.css';
import { GolfWorld } from './world.js';
import { BALL_RADIUS, CLUBS, launch, stepBall, predict, surfaceAt, terrainHeight, distance, randomWind } from './physics.js';
import { COURSES } from './courses.js';
import { createTouchAim } from './touch.js';
import { ShotControl, shotAccuracy } from './shot.js';
import { rangeProfile } from './range.js';
import { MultiplayerClient } from './multiplayer.js';
import { RoomUI } from './room-ui.js';
import { OUTFITS } from './profile.js';
import { GolfAudio } from './audio.js';

const paths={flag:'M5 21V3m0 0c5-5 9 5 14 0v9c-5 5-9-5-14 0',golf:'M4 21h16M9 18V3l10 3-10 3m-4 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',trophy:'M8 3h8v8a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v5m-4 1h8',help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',sound:'M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',muted:'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6',sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',wind:'M3 8h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',camera:'M3 7h4l2-3h6l2 3h4v13H3V7Zm9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',arrow:'M4 12h16m-6-6 6 6-6 6',reset:'M4 11a8 8 0 1 1 1 7M4 3v8h8',leaf:'M20 3C8 2 1 10 6 17s17 2 14-14ZM5 20 16 9',check:'m5 12 4 4L19 6',map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.golf}"/></svg>`;
const $=s=>document.querySelector(s);
let profile={name:'Guest golfer',best:null,rounds:0,sound:true};
try{profile={...profile,...JSON.parse(localStorage.getItem('fairway-profile')||'{}')};}catch{}
profile.name=typeof profile.name==='string'?profile.name.slice(0,20):'Guest golfer';
profile.character=profile.character==='male'?'male':'female';
profile.outfit=Object.hasOwn(OUTFITS,profile.outfit)?profile.outfit:'coral';
const save=()=>{try{localStorage.setItem('fairway-profile',JSON.stringify(profile));}catch{}};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const avatarEmoji=character=>character==='male'?'🏌🏻‍♂️':'🏌🏻‍♀️';
$('#app').innerHTML=`
<main class="game-shell">
  <section class="course-view" aria-label="สนามกอล์ฟสามมิติ">
    <canvas id="world" tabindex="0" aria-label="สนามกอล์ฟ 3D ลากนิ้วเพื่อเล็ง จีบเพื่อซูม กดปุ่มตีเริ่มชาร์จ แล้วแตะจอหรือปุ่มเพื่อล็อกแรงและตีตรงเส้นขาว"></canvas>
    <div id="loading" class="loading">กำลังเตรียมสนามของคุณ…</div>
    <div class="scene-vignette" aria-hidden="true"></div>
    <div class="ball-label" id="ball-label"><span>ลูกของคุณ</span></div>
    <div id="remote-labels" aria-hidden="true"></div>
    <div class="match-status" id="match-status" role="status" hidden></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <div class="scene-tools hud-widget" aria-label="มุมมองสนาม">
      <button class="camera-button" id="camera" title="สลับมุมกล้อง">${icon('camera')}ดูทั้งสนาม</button>
      <div class="tool-divider"></div>
      <div class="view-controls"><button id="zoom-out" aria-label="ซูมออก" title="ซูมออก">−</button><button id="zoom-in" aria-label="ซูมเข้า" title="ซูมเข้า">＋</button><button id="reset" aria-label="เริ่มหลุมนี้ใหม่" title="เริ่มหลุมนี้ใหม่">${icon('reset')}</button></div>
    </div>
  </section>
  <header class="hud-top">
    <div class="course-widget hud-widget">
      <div class="course-label sr-only"><h1>Geek Lagoon</h1><p id="hole-title">01 — Palm Opening</p></div>
      <div class="hole-info"><div class="hole-stat"><span>หลุม</span><div class="hole-number"><strong id="hole-number">01</strong><span id="hole-count">/ 09</span></div></div><div class="hole-stats"><div><span>พาร์</span><b id="par">4</b></div><div><span>ถึงหลุม</span><b id="distance">192 <small>m</small></b></div></div></div>
    </div>
    <div class="hud-actions">
      <button class="score-card hud-widget" id="score-quick" aria-label="เปิดสกอร์การ์ด"><div class="score-top"><span>คะแนนรอบนี้</span><strong id="score">E</strong></div><div class="shot-status">ช็อต <b id="strokes">1</b><span class="status-separator">·</span><span id="lie">Tee</span></div></button>
      <div class="hud-menu">
        <button class="menu-toggle hud-widget" id="menu-toggle" aria-label="เมนูเกม" aria-expanded="false" aria-controls="menu-panel" title="เมนูเกม"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>เมนู</span></button>
        <nav id="menu-panel" class="menu-panel hud-widget" aria-label="เมนูหลัก" hidden>
          <div class="player-widget"><div class="avatar" id="player-avatar">${avatarEmoji(profile.character)}</div><div><strong id="player-name">${escape(profile.name)}</strong><small id="course-brand">GEEK LAGOON · SOLO</small></div></div>
          <button id="play-nav" aria-label="สนามกอล์ฟ">${icon('flag')}เล่นต่อ</button>
          <button id="lobby-nav" aria-label="คลับเฮาส์ SOLO">${icon('grid')}คลับเฮาส์</button>
          <button id="scores-nav" aria-label="สกอร์การ์ด">${icon('trophy')}สกอร์การ์ด</button>
          <button id="help-nav" aria-label="วิธีเล่น">${icon('help')}วิธีเล่น</button>
          <button id="sound" aria-label="เปิดหรือปิดเสียง">${icon(profile.sound?'sound':'muted')}เสียง</button>
          <button id="profile-button" aria-label="Profile">${icon('golf')}Profile</button>
        </nav>
      </div>
    </div>
  </header>
  <div class="weather hud-widget" id="wind-widget" aria-label="แรงและทิศทางลม">
    <div class="wind-compass" id="wind-compass" role="img" aria-label="เข็มทิศลม">
      <span class="wind-cardinal north">N</span><span class="wind-cardinal east">E</span><span class="wind-cardinal south">S</span><span class="wind-cardinal west">W</span>
      <span class="wind-needle" id="wind-needle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2 16 14 12 11 8 14Z"/><path d="m12 22-4-12 4 3 4-3Z"/></svg></span>
    </div>
    <div class="wind-readout"><span>ลม</span><b id="wind">2.4 m/s</b><small id="wind-direction">พัดไป N</small></div>
  </div>
  <div id="hole-dots" hidden></div>
  <aside class="match-hud hud-widget" id="match-hud" aria-label="ผู้เล่นในห้อง" hidden></aside>
  <section class="swing-panel hud-widget" aria-label="ควบคุมการตี">
    <div class="club-widget"><div class="control-title"><span>ไม้กอล์ฟ</span><b id="club-name">Driver · 1W</b></div><div class="clubs">${Object.entries(CLUBS).map(([key,c])=>`<button class="club ${key==='driver'?'selected':''}" data-club="${key}" aria-label="เลือก ${c.name}" title="${c.name}" aria-pressed="${key==='driver'}">${c.label}</button>`).join('')}</div></div>
    <div class="aim-widget"><div class="control-title"><span>ทิศทาง</span><span class="secondary">เล็ง</span></div><div class="aim-control"><button id="aim-left" aria-label="เล็งซ้าย">${icon('left')}</button><output id="aim">0°</output><button id="aim-right" aria-label="เล็งขวา">${icon('right')}</button><button id="aim-pin" title="เล็งตรงธง" aria-label="เล็งไปที่ธง">${icon('flag')}</button></div></div>
    <div class="power-widget"><div class="control-title"><span id="power-title">แรงตี</span><b id="power-value">80%</b></div><div class="power-meter" id="power" role="progressbar" aria-label="แรงตี" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80"><div class="power-fill"></div><div class="accuracy-zone" aria-hidden="true"><div class="accuracy-nice"></div></div><div class="power-ticks" aria-hidden="true"></div><div class="accuracy-line" aria-hidden="true"></div><div class="distance-flag" id="distance-flag" role="img" aria-label="ธงระยะถึงหลุม"><svg viewBox="0 0 14 22" aria-hidden="true"><path d="M2 21V1M2 1l10 3-10 4"/></svg></div><div class="power-locked" aria-hidden="true"></div><div class="power-cursor" aria-hidden="true"></div></div><div class="power-scale" id="distance-scale" aria-label="ระยะตีโดยประมาณเป็นเมตร"></div><div class="power-caption"><span id="target-distance"></span><span id="estimate">≈ 168 m</span></div></div>
    <button id="touch-swing" class="touch-swing" type="button" aria-label="เริ่มชาร์จแรงตี"><span>ตี</span><small>1 · ชาร์จ</small></button>
  </section>
  <footer class="footer"><span class="desktop-hint"><kbd>Space</kbd> / คลิก: เริ่ม → ล็อกแรง → กดตรงเส้นขาว · <kbd>←</kbd><kbd>→</kbd> เล็ง</span><span class="touch-hint">ลากเล็ง · ปุ่มตีเริ่ม · แตะจอ/ปุ่มล็อกแรงและตี · จีบซูม</span></footer>
  <p id="caddie" hidden></p>
</main>
<div class="overlay" id="overlay" hidden><section class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></section></div>`;
let world, courseId='lagoon', holeIndex=0, roundLength=9, strokes=0, scores=[], club='driver', power=80, bearing=0, aimOffset=0, ball, moving=false, lastSafe, wind, lastTime=0, accumulator=0, toastTimer, finished=false, lastFlightUI=0;
const soundEngine=new GolfAudio(()=>profile.sound);
for(const type of ['pointerdown','pointerup','touchend','keydown','click'])document.addEventListener(type,event=>{
  if(event.isTrusted)soundEngine.unlock();
},{capture:true,passive:true});
const shot=new ShotControl();
let shotOrigin, previousPower=80;
let pendingAimDelta=0,queuedAim=false,lastAimSend=0,waterDelay=0;
const touchMedia=matchMedia('(any-pointer: coarse), (max-width: 600px)');
function updateTouchControls(){ $('.game-shell').classList.toggle('touch-controls',touchMedia.matches); }
touchMedia.addEventListener('change',updateTouchControls);updateTouchControls();
let rangeGuide,rangeKey='';
let multiplayerRoom=null,localPlayerId=null,roomHoleKey='',connection='solo',onlineDisplayBall=null,lastStateAt=0,pendingShot=false,recordedRoom=null,matchHudKey='';
const client=new MultiplayerClient({onState:handleRoomState,onConnection:state=>{connection=state;if(client.session)updateMatchHUD();},onError:message=>{pendingShot=false;if(shot.phase==='swinging'&&!moving)shot.reset();roomUI.error(message);notify(message,5000);}});
const roomUI=new RoomUI({client,profile,open:openModal,onSolo:(id,length)=>{courseId=id;newRound(length);},onLeave:leaveRoom,onName:name=>{profile.name=name.trim().slice(0,20)||'Guest golfer';$('#player-name').textContent=profile.name;save();},onProfileChange:draft=>{Object.assign(profile,draft);$('#player-name').textContent=profile.name;$('#player-avatar').textContent=avatarEmoji(profile.character);world?.setCharacterAppearance(profile.character,OUTFITS[profile.outfit]);save();}});
const online=()=>Boolean(client.session);
const busy=()=>moving||finished||shot.phase!=='idle'||(online()&&(connection!=='connected'||multiplayerRoom?.status!=='playing'));
try { world=new GolfWorld($('#world'),{character:profile.character,outfit:OUTFITS[profile.outfit]}); } catch(err){$('#loading').textContent='ไม่สามารถเปิดกราฟิก 3D ได้ กรุณาเปิด WebGL ในเบราว์เซอร์';document.querySelectorAll('.swing-panel button,.swing-panel input').forEach(el=>el.disabled=true);console.error(err);}
const course=()=>COURSES[courseId];
const holes=()=>course().holes;
const hole=()=>holes()[holeIndex];
const pin=()=>({x:hole().pin[0],z:hole().pin[1]});
const baseBearing=()=>Math.atan2(pin().x-ball.x,pin().z-ball.z);
const windInfo=wind=>{const angle=Math.atan2(wind.x,wind.z);return{angle:angle*180/Math.PI,label:['N','NE','E','SE','S','SW','W','NW'][Math.round((angle+Math.PI*2)/(Math.PI/4))%8]};};
function notify(message,duration=3400){$('#toast').textContent=message;$('#toast').classList.toggle('perfect',message.startsWith('PERFECT!'));$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible','perfect'),duration);}
const tone=(...args)=>soundEngine.tone(...args);
const noiseBurst=options=>soundEngine.noiseBurst(options);
function surfaceSound(event){
  const volume=Math.min(.12,.025+(event.strength||0)*.004);
  if(event.kind==='water')noiseBurst({duration:.38,lowpass:3300,highpass:450,type:'lowpass',volume:volume*1.2});
  else if(event.kind==='sand')noiseBurst({duration:.22,lowpass:2200,highpass:400,volume:volume*.7});
  else if(event.kind==='rock')tone(1500,.055,'triangle',volume*.7);
  else noiseBurst({duration:.09,lowpass:650,highpass:180,type:'lowpass',volume:volume*.5});
}
function swingWhoosh(){noiseBurst({delay:.48,duration:.36,lowpass:1500,highpass:220,type:'lowpass',volume:.055});}
function impactSound(){
  const sound={driver:[145,880,1250],iron:[175,1180,1700],wedge:[195,1450,2100],putter:[225,1750,2500]}[club],force=.78+power/450;
  noiseBurst({duration:club==='putter'?.075:.12,lowpass:sound[2],highpass:360,type:'bandpass',volume:(club==='putter'?.07:.11)*force,q:1.1});
  tone(sound[0],club==='putter'?.085:.14,'sine',(club==='putter'?.09:.15)*force);
  tone(sound[1],.055,'triangle',.045*force);
}
function startHole(authority=null){
  pendingAimDelta=0;queuedAim=false;waterDelay=0;
  $('.game-shell').dataset.waiting='false';
  $('.course-widget').title=`${course().name} — ${hole().name}`;
  if(!world)return;shot.reset();shotOrigin=null;accumulator=0;strokes=0;finished=false;moving=false;ball=authority?{...authority.player.ball}:{x:hole().tee[0],y:terrainHeight(hole().tee[0],hole().tee[1],hole())+BALL_RADIUS,z:hole().tee[1],status:'stopped'};lastSafe={...ball};club='driver';power=80;aimOffset=0;bearing=baseBearing();wind=authority?authority.wind:randomWind();rangeKey='';world.clearRemotePlayers();onlineDisplayBall={...ball};
  world.build(hole(),holeIndex,course().theme);world.setWind(wind);world.setCamera('player');$('#camera').innerHTML=`${icon('camera')}ดูทั้งสนาม`;$('#loading').hidden=true;$('.course-label h1').textContent=course().name;$('#course-brand').textContent=`${course().name.toUpperCase()} · ${authority?'MULTIPLAYER':'SOLO'}`;$('#hole-title').textContent=`${String(holeIndex+1).padStart(2,'0')} — ${hole().name}`;$('#hole-number').textContent=String(holeIndex+1).padStart(2,'0');$('#hole-count').textContent=`/ ${String(roundLength).padStart(2,'0')}`;$('#par').textContent=hole().par;
  const speed=Math.hypot(wind.x,wind.z),direction=windInfo(wind);$('#wind').textContent=`${speed.toFixed(1)} m/s`;$('#wind-direction').textContent=`พัดไป ${direction.label}`;$('#wind-needle').style.setProperty('--wind-angle',`${direction.angle}deg`);$('#wind-compass').setAttribute('aria-label',`ลมพัดไปทาง ${direction.label}`);$('#wind-widget').title=`ลม ${speed.toFixed(1)} m/s พัดไปทาง ${direction.label}`;updateUI();updateGuide();
}
function totalScore(){return scores.reduce((total,s,i)=>total+s-holes()[i].par,0);}
const scoreLabel=s=>s===0?'E':s>0?`+${s}`:String(s);
function updateUI(){
  if(!ball)return;const dist=distance(ball,pin());$('#distance').innerHTML=`${(dist*2.5).toFixed(0)} <small style="font-size:10px;color:#86947a">m</small>`;$('#strokes').textContent=(moving||finished)?strokes:strokes+1;$('#score').textContent=scoreLabel(totalScore());$('#power-value').textContent=`${power}%`;$('#aim').textContent=`${aimOffset>0?'+':''}${Math.round(aimOffset)}°`;
  const surface=strokes===0?'tee':surfaceAt(ball.x,ball.z,hole());$('#lie').textContent={tee:'จุดเริ่ม',fairway:'แฟร์เวย์',rough:'รัฟ',green:'กรีน',sand:'บังเกอร์',water:'น้ำ'}[surface];
  $('#hole-dots').innerHTML=Array.from({length:roundLength},(_,i)=>`<div class="hole-dot ${i===holeIndex?'current':i<scores.length?'done':''}" title="หลุม ${i+1}${i<scores.length?`: ${scores[i]} ช็อต`:''}">${i<scores.length?'✓':i+1}</div>`).join('');
  document.querySelectorAll('[data-club]').forEach(button=>{button.classList.toggle('selected',button.dataset.club===club);button.setAttribute('aria-pressed',String(button.dataset.club===club));button.disabled=busy();});
  ['#aim-left','#aim-right','#aim-pin','#reset'].forEach(id=>$(id).disabled=busy()||(id==='#reset'&&online()));
  updateMeter();
  $('#profile-button').disabled=online();
  $('#profile-button').title=online()?'เลือก Profile ได้ก่อนเข้าห้อง':'';
  if(surface==='green')$('#caddie').textContent='ถึงกรีนแล้ว! ใช้ Putter และลดแรงตีให้ลูกกลิ้งเข้าหลุม เส้นประช่วยดูจุดหยุดของลูก';
  else if(surface==='sand')$('#caddie').textContent='ลูกอยู่ในบังเกอร์ ใช้ Wedge เพื่อลอยออกจากทราย ทรายจะหยุดลูกเร็วกว่าแฟร์เวย์';
  else $('#caddie').textContent='เล็งตามเส้นประ แล้วชาร์จ ล็อกแรง และกดตรงเส้นขาว ลมจะมีผลขณะลูกลอยอยู่ในอากาศ';
}
function updateMeter(){
  const charging=shot.phase==='charging',accuracy=shot.phase==='accuracy',swinging=shot.phase==='swinging';
  const value=charging?shot.power:power;
  $('.game-shell').dataset.shotPhase=shot.phase;
  $('#power').style.setProperty('--power',`${value}%`);
  $('#power').style.setProperty('--cursor',`${accuracy?shot.cursor:value}%`);
  $('#power').setAttribute('aria-valuenow',String(Math.round(value)));
  $('#power').setAttribute('aria-label',accuracy?'ความแม่นยำ กดเมื่อถึงเส้นขาว':'แรงตี');
  $('#power').setAttribute('aria-valuetext',accuracy?`แรง ${power}% ตัวชี้ความแม่นยำ ${Math.round(shot.cursor)}% เป้าหมาย 15%`:`${Math.round(value)}%`);
  $('#power-value').textContent=`${Math.round(value)}%`;
  $('#power-title').textContent=charging?'1 · ชาร์จแรง':accuracy?'2 · ความแม่นยำ':swinging?'3 · ตี':'แรงตี';
  if(charging)$('#estimate').textContent='กดเพื่อล็อกแรง';
  else if(accuracy)$('#estimate').textContent='กดตรงเส้นขาว!';
  else if(swinging)$('#estimate').textContent='กำลังเหวี่ยงไม้';
  const waiting=moving||finished||['swinging','flight'].includes(shot.phase)||(online()&&(connection!=='connected'||multiplayerRoom?.status!=='playing'));
  const title=waiting?'รอลูก':charging?'ล็อกแรง':accuracy?'ตี!':'ตี';
  const caption=waiting?'กำลังเล่น':charging?'2 · ล็อกแรง':accuracy?'3 · เส้นขาว':'1 · ชาร์จ';
  $('#touch-swing span').textContent=title;$('#touch-swing small').textContent=caption;$('#touch-swing').disabled=waiting;
  $('#touch-swing').setAttribute('aria-label',waiting?'รอลูกหยุด':charging?'ล็อกแรงตี':accuracy?'ล็อกความแม่นยำตรงเส้นขาว':'เริ่มชาร์จแรงตี');
}
function cancelCharge(){if(shot.cancel()){power=previousPower;world.guide.visible=true;clearTimeout(toastTimer);$('#toast').classList.remove('visible');updateUI();updateGuide();}}
function updateRangeGuide(){
  const key=[holeIndex,ball.x,ball.z,club,wind.x,wind.z].join(':');
  if(key===rangeKey)return;
  rangeKey=key;rangeGuide=rangeProfile(ball,club,hole(),wind);
  const fullRange=Math.round(rangeGuide.maxMeters);$('#club-name').textContent=`${CLUBS[club].name} · ${fullRange} m`;$('#club-name').title=`ระยะเต็มแรงโดยประมาณ ${fullRange} เมตร`;
  const {targetMeters,targetPower,maxMeters,reachable,ticks}=rangeGuide,flag=$('#distance-flag'),clubRange=Math.round(maxMeters);
  flag.style.setProperty('--target-power',`${targetPower}%`);
  flag.classList.toggle('out-of-range',!reachable);
  flag.dataset.targetPower=targetPower;flag.dataset.targetMeters=targetMeters;flag.dataset.reachable=reachable;
  const label=`หลุม ${Math.round(targetMeters)} m · ${reachable?`แรงโดยประมาณ ${targetPower}%`:`เกินระยะ ${CLUBS[club].name} (สูงสุด ${clubRange} m)`}`;
  flag.setAttribute('aria-label',label);flag.title=label;
  $('#target-distance').textContent=`⚑ ${Math.round(targetMeters)} m${reachable?'':` · เกิน ${CLUBS[club].label} ${clubRange} m`}`;
  $('#target-distance').classList.toggle('out-of-range',!reachable);
  $('#distance-scale').innerHTML=ticks.map(({power,meters})=>`<span style="left:${power}%">${meters<10?meters.toFixed(1).replace('.0',''):Math.round(meters)}${power===100?' m':''}</span>`).join('');
}
function updateGuide(){if(!world||busy())return;updateRangeGuide();const forecast=predict(ball,club,power,bearing,hole(),wind);world.setGuide(forecast.points);$('#estimate').textContent=`≈ ${Math.round(distance(ball,forecast.ball)*2.5)} m`;if(online())queuedAim=true;}
function changeAim(delta){if(busy())return;aimOffset=Math.max(-180,Math.min(180,aimOffset+delta));bearing=baseBearing()+aimOffset*Math.PI/180;updateUI();updateGuide();}
function shoot(){
  if(!world||moving||finished||!$('#overlay').hidden||!menuPanel.hidden||(online()&&(connection!=='connected'||multiplayerRoom?.status!=='playing')))return;
  if(pendingAimDelta){const delta=pendingAimDelta;pendingAimDelta=0;changeAim(delta);}
  const action=shot.press();
  if(action==='charge'){
    previousPower=power;world.guide.visible=false;updateUI();tone(440,.06);
    notify('1 · เริ่มชาร์จแล้ว กดอีกครั้งเพื่อล็อกแรง',1200);
  }else if(action==='accuracy'){
    power=shot.power;updateUI();tone(580,.08);notify(`2 · ล็อกแรง ${power}% — กดตรงเส้นขาว!`,1000);
  }else if(action==='swing'){
    beginSwing();
  }
}
function beginSwing(){
  waterDelay=0;
  shotOrigin={...ball};lastSafe={...ball,status:'stopped'};accumulator=0;
  if(online()){
    pendingShot=client.send({type:'shot',commandId:crypto.randomUUID(),holeIndex,club,power,bearing,error:shot.error});
    if(!pendingShot){shot.reset();notify('กำลังเชื่อมต่อห้องใหม่ รอสักครู่ก่อนตี');updateUI();return;}
  }
  swingWhoosh();
  updateUI();notify(shot.rating==='Perfect!'?`PERFECT! · จังหวะเต็ม · แรง ${power}%`:`${shot.rating} · แรง ${power}%`,shot.rating==='Perfect!'?2200:1500);
}
function settle(){
  moving=false;shot.reset();shotOrigin=null;world.guide.visible=true;
  if(ball.status==='holed'){finished=true;scores.push(strokes);tone(880,.25);setTimeout(()=>tone(1175,.4),180);updateUI();showHoleResult();return;}
  if(ball.status==='water'){ball={...lastSafe};strokes++;notify('ตกน้ำ! +1 ช็อต กลับมาตีจากจุดเดิม');tone(170,.3);}
  else notify(`${{fairway:'ลงแฟร์เวย์',rough:'อยู่ในรัฟ',sand:'ลงบังเกอร์',green:'ถึงกรีนแล้ว'}[surfaceAt(ball.x,ball.z,hole())]} · เหลือ ${Math.round(distance(ball,pin())*2.5)} เมตร`);
  aimOffset=0;bearing=baseBearing();const dist=distance(ball,pin());club=dist<15?'putter':surfaceAt(ball.x,ball.z,hole())==='sand'?'wedge':dist<35?'wedge':dist<60?'iron':'driver';
  // Pick a sensible starting power; players still choose the shot and direction.
  let bestError=Infinity,bestPower=80;for(let p=5;p<=100;p++){const result=predict(ball,club,p,bearing,hole(),wind);const error=distance(result.ball,pin());if(error<bestError){bestError=error;bestPower=p;}}
  power=bestPower;updateUI();updateGuide();
  if(strokes>=12){finished=true;openModal(`${icon('flag')}<div class="eyebrow">TAKE A BREATHER</div><h2 id="modal-title">ลองหลุมถัดไปกัน</h2><p>ถึง 12 ช็อตแล้ว บันทึกหลุมนี้เป็น 12 ช็อต แล้วไปต่อ หรือเริ่มหลุมนี้ใหม่ได้ครับ</p><button class="primary" id="skip-hole">ไปหลุมถัดไป</button><button class="primary" id="retry-hole" style="background:#e3eaca;color:#41583a">ลองหลุมนี้อีกครั้ง</button>`,false);$('#skip-hole').onclick=()=>{scores.push(12);nextHole();};$('#retry-hole').onclick=()=>{$('#overlay').hidden=true;startHole();};}
}
function openModal(content,closable=true){cancelCharge();$('#modal').className='modal';$('#modal').innerHTML=`${closable?'<button class="close" aria-label="ปิด">×</button>':''}${content}`;$('#overlay').hidden=false;if(closable)$('#modal .close').onclick=closeModal;$('#modal button')?.focus();}
function closeModal(){if(finished||['home','solo','create','join','lobby','connecting','results'].includes(roomUI.screen))return;$('#overlay').hidden=true;$('#world').focus({preventScroll:true});}
function showHoleResult(){
  const difference=strokes-hole().par;const result=strokes===1?'Hole in one!':difference<=-3?'Albatross!':difference===-2?'Eagle!':difference===-1?'Birdie!':difference===0?'That’s a par.':difference===1?'Bogey.':'Keep swinging.';
  openModal(`<div class="modal-icon">${icon('flag')}</div><div class="eyebrow">HOLE ${holeIndex+1} COMPLETE</div><h2 id="modal-title">${result}</h2><p>ทุกช็อตคือโอกาสเริ่มต้นใหม่ เล่นต่อให้จบรอบกัน!</p><div class="result-stats"><div><b>${strokes}</b><span>STROKES</span></div><div><b>${hole().par}</b><span>PAR</span></div><div><b>${scoreLabel(totalScore())}</b><span>ROUND SCORE</span></div></div><button class="primary" id="next-hole">${holeIndex+1===roundLength?'ดูผลการออกรอบ':'หลุมถัดไป'} ${icon('arrow')}</button>`,false);$('#next-hole').onclick=nextHole;
}
function nextHole(){
  $('#overlay').hidden=true;
  if(holeIndex+1>=roundLength){profile.rounds++;const score=totalScore();if(roundLength===9&&(profile.best===null||score<profile.best))profile.best=score;save();showRoundResult();}
  else {holeIndex++;startHole();notify(`หลุม ${holeIndex+1} · ${hole().name}`);}
}
const scoreTable=()=>`<table class="score-table"><thead><tr><th>HOLE</th><th>PAR</th><th>STROKES</th><th>+ / −</th></tr></thead><tbody>${Array.from({length:roundLength},(_,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td>${holes()[i].par}</td><td>${scores[i]??'—'}</td><td>${scores[i]!=null?scoreLabel(scores[i]-holes()[i].par):'—'}</td></tr>`).join('')}</tbody></table>`;
function showRoundResult(){openModal(`<div class="modal-icon">${icon('trophy')}</div><div class="eyebrow">${escape(course().name.toUpperCase())} · A ROUND WELL SPENT</div><h2 id="modal-title">See you on the green.</h2><p>จบ ${roundLength} หลุมแล้ว ${escape(profile.name)}! คะแนนรวม ${scoreLabel(totalScore())} · ${scores.reduce((a,b)=>a+b,0)} ช็อต</p>${scoreTable()}<button class="primary" id="again">ออกรอบอีกครั้ง ${icon('arrow')}</button>`,false);$('#again').onclick=()=>newRound(roundLength);}
function newRound(length=9){roundLength=length;holeIndex=0;scores=[];finished=false;$('#overlay').hidden=true;startHole();notify(`ยินดีต้อนรับสู่ ${course().name} ⛳`);}
function lobby(){
  if(online()){
    openModal(`<div class="eyebrow">MULTIPLAYER ROOM</div><h2 id="modal-title">${escape(multiplayerRoom?.name||'ห้องของคุณ')}</h2><p>ออกจากห้องแล้วจะกลับเข้ารอบที่เริ่มไปแล้วไม่ได้ เพื่อนจะเล่นต่อได้ตามปกติ</p><button class="primary" id="room-continue">กลับไปเล่น</button><button class="room-exit" id="room-exit">ออกจากห้องและกลับคลับเฮาส์</button>`,false);
    $('#room-continue').onclick=()=>{$('#overlay').hidden=true;$('#world').focus();};$('#room-exit').onclick=leaveRoom;
  }else if(!moving)roomUI.home();
}
function help(){if(finished)return;openModal(`<div class="eyebrow">THE BASICS</div><h2 id="modal-title">Small ball. Big possibilities.</h2><p>1. เลือกไม้: <b>1W</b> ตีไกล · <b>7I</b> ระยะกลาง · <b>SW</b> ชิพข้ามอุปสรรค · <b>PT</b> พัตต์บนกรีน</p><p>2. ลากนิ้วซ้าย–ขวาบนสนามเพื่อเล็ง จีบสองนิ้วเพื่อซูม หรือใช้ลูกศรบนคีย์บอร์ด กดปุ่มธงเพื่อเล็งตรงหลุม เส้นประแสดงวิถีและจุดหยุดโดยประมาณ</p><p>3. กด <b>ปุ่มตี</b> บนมือถือ หรือ <b>Space</b> / คลิกด้วยเมาส์ ครั้งแรกเริ่มชาร์จ ครั้งที่สองล็อกแรง ครั้งที่สามกดเมื่อแถบกลับมาตรง <b>เส้นขาว</b> หากกดเร็วลูกเบนซ้าย กดช้าลูกเบนขวา กด <b>Esc</b> เพื่อยกเลิกก่อนเหวี่ยงไม้</p><p>4. ลูกชนก้อนหินอาจเด้งเปลี่ยนทิศ ตกทรายจะกลิ้งช้าลง ลูกตกน้ำเสียเพิ่ม 1 ช็อตและกลับจุดเดิม กด <b>C</b> เปลี่ยนมุมกล้อง</p><button class="primary" id="help-close">พร้อมแล้ว ไปตีกัน ${icon('arrow')}</button>`);$('#help-close').onclick=closeModal;}
$('#play-nav').onclick=()=>{if(!finished)closeModal();};$('#lobby-nav').onclick=lobby;$('#scores-nav').onclick=()=>{if(finished)return;openModal(`<div class="eyebrow">EVERY SHOT COUNTS</div><h2 id="modal-title">Your scorecard.</h2><p>คะแนนรอบนี้ ${scoreLabel(totalScore())} · จบแล้ว ${scores.length} / ${roundLength} หลุม</p>${scoreTable()}<p>ออกรอบจบแล้วทั้งหมด ${profile.rounds} ครั้ง · สถิติดีที่สุด 9 หลุม: ${profile.best===null?'ยังไม่มี':scoreLabel(profile.best)}</p>`);};$('#help-nav').onclick=help;
$('#sound').onclick=()=>{profile.sound=!profile.sound;$('#sound').innerHTML=`${icon(profile.sound?'sound':'muted')}เสียง`;$('#sound').setAttribute('aria-pressed',String(profile.sound));save();if(profile.sound){soundEngine.unlock();tone();}};
$('#profile-button').onclick=()=>{
  if(finished)return;
  const draft={name:profile.name,character:profile.character,outfit:profile.outfit};
  openModal(`<div class="eyebrow">YOUR CLUB PROFILE</div><h2 id="modal-title">Profile</h2><p>ตั้งชื่อ เลือกตัวละคร และจัดชุดนักกอล์ฟของคุณ</p><label for="name-input">ชื่อผู้เล่น</label><input id="name-input" maxlength="20" value="${escape(profile.name)}" autocomplete="nickname"><fieldset class="profile-field"><legend>ตัวละคร</legend><div class="profile-choices"><button type="button" class="profile-choice" data-character="female" aria-pressed="${draft.character==='female'}"><span class="profile-avatar">🏌🏻‍♀️</span><span><strong>นักกอล์ฟหญิง</strong><small>หมวกไวเซอร์ · ผมหางม้า · กระโปรงพลีต</small></span></button><button type="button" class="profile-choice" data-character="male" aria-pressed="${draft.character==='male'}"><span class="profile-avatar">🏌🏻‍♂️</span><span><strong>นักกอล์ฟชาย</strong><small>หมวกแก๊ป · เสื้อโปโล · กางเกง</small></span></button></div></fieldset><fieldset class="profile-field outfit-field"><legend>สีชุด</legend><div class="outfit-choices">${Object.entries(OUTFITS).map(([id,outfit])=>`<button type="button" class="outfit-choice" data-outfit="${id}" aria-label="ชุด ${escape(outfit.name)}" aria-pressed="${draft.outfit===id}" title="${escape(outfit.name)}"><span class="outfit-swatch" style="--shirt:#${outfit.shirt.toString(16).padStart(6,'0')};--cap:#${outfit.cap.toString(16).padStart(6,'0')};--bottom:#${outfit.bottom.toString(16).padStart(6,'0')}"></span><span>${escape(outfit.name)}</span></button>`).join('')}</div></fieldset><button class="primary" id="save-profile">บันทึก Profile</button>`);
  $('#modal').classList.add('profile-modal');
  $('#modal').querySelectorAll('[data-character]').forEach(button=>button.onclick=()=>{draft.character=button.dataset.character;$('#modal').querySelectorAll('[data-character]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.character===draft.character)));});
  $('#modal').querySelectorAll('[data-outfit]').forEach(button=>button.onclick=()=>{draft.outfit=button.dataset.outfit;$('#modal').querySelectorAll('[data-outfit]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.outfit===draft.outfit)));});
  $('#save-profile').onclick=()=>{profile.name=$('#name-input').value.trim().slice(0,20)||'Guest golfer';profile.character=draft.character;profile.outfit=draft.outfit;$('#player-name').textContent=profile.name;$('#player-avatar').textContent=avatarEmoji(profile.character);world?.setCharacterAppearance(profile.character,OUTFITS[profile.outfit]);save();closeModal();};
};
const PLAYER_COLORS=[0xffc5a9,0x8ddfe4,0xdfb5fa,0xffe990];
function leaveRoom(){
  client.leave();multiplayerRoom=null;localPlayerId=null;roomHoleKey='';connection='solo';pendingShot=false;matchHudKey='';
  world?.clearRemotePlayers();$('#remote-labels').replaceChildren();$('#match-hud').hidden=true;$('#match-status').hidden=true;
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  $('.game-shell').classList.remove('multiplayer');world?.setCharacterAppearance(profile.character,OUTFITS[profile.outfit]);finished=false;scores=[];holeIndex=0;startHole();roomUI.home();
}
function handleRoomState(room,playerId){
  const me=room.players.find(p=>p.id===playerId);
  multiplayerRoom=room;localPlayerId=playerId;connection='connected';lastStateAt=performance.now();
  if(!me){notify('คุณออกจากห้องแล้ว');leaveRoom();return;}
  if(room.status==='playing'||room.status==='finished'){
    const key=`${room.id}:${room.holeIndex}`,fresh=roomHoleKey!==key;
    const previousPhase=fresh?'idle':shot.phase,previousStrokes=fresh?0:strokes;
    courseId=room.courseId;roundLength=room.roundLength;holeIndex=room.holeIndex;
    $('.game-shell').classList.add('multiplayer');
    if(fresh){roomHoleKey=key;pendingShot=false;world.setCharacterAppearance(me.profile.character,OUTFITS[me.profile.outfit]);startHole({player:me,wind:room.wind});$('#remote-labels').replaceChildren();notify(`หลุม ${holeIndex+1} · ตีพร้อมกันได้เลย`);}
    const newlyDone=!finished&&me.done;
    scores=[...me.scores];strokes=me.strokes;ball={...me.ball};wind=room.wind;finished=me.done;moving=ball.status==='moving'||ball.status==='water';
    $('.game-shell').dataset.waiting=String(me.done);
    if(newlyDone){world.setCamera('overview');$('#camera').innerHTML=`${icon('camera')}มุมมองผู้เล่น`;}
    if(me.motion.phase==='swinging'||me.motion.phase==='flight'){
      if(!pendingShot&&previousPhase==='idle'&&me.motion.phase==='swinging')swingWhoosh();
      pendingShot=false;shot.phase=me.motion.phase;shot.elapsed=me.motion.elapsed;shot.error=me.motion.error;
      shot.rating=me.motion.perfect?'Perfect!':Math.abs(me.motion.error)<=5?'Nice!':'Good';power=Math.round(me.motion.power);club=me.club;bearing=me.bearing;shotOrigin=me.motion.origin;
    }else if(finished||(!pendingShot&&!['charging','accuracy'].includes(shot.phase))){
      shot.reset();shotOrigin=null;
      if(fresh||['swinging','flight'].includes(previousPhase)){
        aimOffset=0;bearing=baseBearing();club=distance(ball,pin())<15?'putter':surfaceAt(ball.x,ball.z,hole())==='sand'?'wedge':distance(ball,pin())<35?'wedge':distance(ball,pin())<60?'iron':'driver';
        let bestError=Infinity;for(let p=5;p<=100;p++){const result=predict(ball,club,p,bearing,hole(),wind),error=distance(result.ball,pin());if(error<bestError){bestError=error;power=p;}}
        if(!finished)updateGuide();
      }
    }
    world.guide.visible=!busy();
    if(strokes>previousStrokes&&me.motion.impacted){impactSound();if(me.motion.perfect)tone(1100,.2,'triangle',.045);}
    for(const p of room.players){
      const effects=world.receiveSurfaceEffects(p.id,p.effects,fresh);
      if(p.id===playerId)for(const effect of effects)surfaceSound(effect);
    }
    world.setRemotePlayers(room.players.filter(p=>p.id!==playerId).map(p=>({...p,color:PLAYER_COLORS[room.players.indexOf(p)],appearance:{character:p.profile.character,outfit:OUTFITS[p.profile.outfit]}})));
    for(const p of room.players.filter(p=>p.id!==playerId)){
      let label=document.getElementById(`peer-${p.id}`);
      if(!label){label=document.createElement('div');label.id=`peer-${p.id}`;label.className='peer-label';label.style.setProperty('--peer-color',`#${PLAYER_COLORS[room.players.indexOf(p)].toString(16)}`);$('#remote-labels').append(label);}
      label.textContent=`${p.profile.name}${!p.connected?' · หลุด':p.done?' · รอเพื่อน':` · ${p.strokes} ช็อต`}`;
    }
    updateUI();
    if(room.status==='finished'&&recordedRoom!==room.id){recordedRoom=room.id;profile.rounds++;save();}
  }
  roomUI.state(room,playerId);updateMatchHUD();
}
function updateMatchHUD(){
  const room=multiplayerRoom;if(!room)return;
  $('#match-hud').hidden=room.status!=='playing';
  const key=JSON.stringify([room.name,room.players.map(p=>[p.id,p.strokes,p.done,p.connected,p.withdrawn]),connection]);
  if(key!==matchHudKey){
    matchHudKey=key;
    $('#match-hud').innerHTML=`<div class="match-room-title"><strong>${escape(room.name)}</strong><span>${room.players.length} คน · ตีพร้อมกัน</span><button id="leave-match" aria-label="ออกจากห้อง">ออก</button></div><div class="match-roster">${room.players.map((p,i)=>`<div class="match-player ${p.id===localPlayerId?'is-you':''}" style="--peer-color:#${PLAYER_COLORS[i].toString(16)}"><i></i><span>${escape(p.profile.name)}${p.id===localPlayerId?' · คุณ':''}</span><b>${p.withdrawn?'ออกแล้ว':!p.connected?'หลุด':p.done?'✓':p.strokes}</b></div>`).join('')}</div>`;
    $('#leave-match').onclick=lobby;
  }
  const done=room.players.filter(p=>p.done).length;
  const status=connection!=='connected'?(connection==='expired'?'การเชื่อมต่อหมดเวลา · กดออกเพื่อเข้าห้องใหม่':'กำลังเชื่อมต่อใหม่… ช็อตและคะแนนยังอยู่'):room.nextHoleIn!==null?`${room.holeIndex+1===room.roundLength?'สรุปผลรอบ':'หลุมถัดไป'}ใน ${Math.ceil(room.nextHoleIn)} วินาที`:finished?`จบแล้ว! รอเพื่อน ${done}/${room.players.length} คน`:'';
  $('#match-status').textContent=status;$('#match-status').hidden=!status;
  if(online()&&ball)updateUI();
}

document.querySelectorAll('[data-club]').forEach(button=>button.onclick=()=>{if(busy())return;club=button.dataset.club;updateUI();updateGuide();});
const menuToggle=$('#menu-toggle'),menuPanel=$('#menu-panel');
function closeMenu(returnFocus=false){menuPanel.hidden=true;menuToggle.setAttribute('aria-expanded','false');if(returnFocus)menuToggle.focus();}
menuToggle.onclick=()=>{const opening=menuPanel.hidden;if(opening)cancelCharge();menuPanel.hidden=!opening;menuToggle.setAttribute('aria-expanded',String(opening));if(opening)menuPanel.querySelector('button').focus();};
menuPanel.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>closeMenu()));
document.addEventListener('click',event=>{if(!event.target.closest('.hud-menu'))closeMenu();});
$('.hud-menu').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget))closeMenu();});
$('#score-quick').onclick=()=>$('#scores-nav').click();
$('#aim-left').onclick=()=>changeAim(-2);$('#aim-right').onclick=()=>changeAim(2);$('#aim-pin').onclick=()=>{if(busy())return;aimOffset=0;bearing=baseBearing();updateUI();updateGuide();};
const touchAim=createTouchAim(
  dx=>{pendingAimDelta+=dx*120/Math.max(320,$('#world').clientWidth);},
  ()=>!busy()&&$('#overlay').hidden&&menuPanel.hidden,
  shoot,
  ()=>['charging','accuracy'].includes(shot.phase)&&!moving&&!finished&&$('#overlay').hidden&&menuPanel.hidden&&(!online()||connection==='connected'&&multiplayerRoom?.status==='playing'),
);
$('#world').addEventListener('pointerdown',event=>{if(event.pointerType==='touch')$('.game-shell').classList.add('touch-controls');touchAim.down(event);});
$('#world').addEventListener('pointermove',touchAim.move);
$('#world').addEventListener('pointerup',touchAim.up);
$('#world').addEventListener('pointercancel',touchAim.cancel);
$('#world').addEventListener('lostpointercapture',touchAim.cancel);
$('#world').addEventListener('click',event=>{if(touchAim.shouldHandleClick(event))shoot();});
$('#touch-swing').onclick=shoot;
$('#zoom-in').onclick=()=>world?.changeZoom(.15);$('#zoom-out').onclick=()=>world?.changeZoom(-.15);
$('#camera').onclick=()=>{if(!world)return;const mode=world.cameraMode==='overview'?'player':'overview';world.setCamera(mode);$('#camera').innerHTML=`${icon('camera')}${mode==='overview'?'มุมมองผู้เล่น':'ดูทั้งสนาม'}`;};
$('#reset').onclick=()=>{if(busy())return;startHole();notify('เริ่มหลุมนี้ใหม่แล้ว คะแนนหลุมก่อนหน้ายังอยู่');};
$('#overlay').onclick=e=>{if(e.target===$('#overlay'))closeModal();};
document.addEventListener('keydown',e=>{
  if(!menuPanel.hidden){if(e.key==='Escape'){e.preventDefault();closeMenu(true);}return;}
  if(!$('#overlay').hidden){if(e.key==='Escape')closeModal();if(e.key==='Tab'){const focusable=[...$('#modal').querySelectorAll('button:not([disabled]),input,select,a[href]')];const first=focusable[0],last=focusable.at(-1);if(document.activeElement===$('#modal')){e.preventDefault();(e.shiftKey?last:first)?.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
  const focused=document.activeElement;
  if((focused.tagName==='INPUT'&&focused.type!=='range')||focused.tagName==='TEXTAREA'||(e.code==='Space'&&focused.closest('.hud-top')))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
  if(e.key==='ArrowLeft')changeAim(-2);if(e.key==='ArrowRight')changeAim(2);
  if(e.key==='Escape')cancelCharge();
  if(e.code==='Space'&&!e.repeat)shoot();if(e.key.toLowerCase()==='c')$('#camera').click();
  const keyIndex=Number(e.key)-1;if(keyIndex>=0&&keyIndex<4)document.querySelectorAll('[data-club]')[keyIndex].click();
});
window.addEventListener('blur',cancelCharge);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCharge();});
if(world){
  startHole();
  const invitedRoom=new URLSearchParams(location.search).get('room');
  if(client.resume()){
    roomUI.screen='connecting';openModal('<h2 id="modal-title">กำลังกลับเข้าห้อง…</h2><p>กำลังโหลดผู้เล่นและคะแนนรอบเดิม</p><button class="primary" id="resume-cancel">กลับคลับเฮาส์</button>',false);$('#resume-cancel').onclick=leaveRoom;
  }else if(invitedRoom&&/^[a-f0-9-]{36}$/.test(invitedRoom)){
    roomUI.home(invitedRoom);
  }else roomUI.home();
  function frame(time){
    requestAnimationFrame(frame);
    const dt=Math.min((time-lastTime)/1000||0,.1);lastTime=time;
    if(pendingAimDelta){const delta=pendingAimDelta;pendingAimDelta=0;if($('#overlay').hidden&&menuPanel.hidden)changeAim(delta);}
    if(queuedAim&&online()&&!busy()&&time-lastAimSend>=100){client.send({type:'aim',holeIndex,bearing,club});queuedAim=false;lastAimSend=time;}
    const serverMotion=online()&&['swinging','flight'].includes(shot.phase);
    const event=serverMotion?{}:shot.tick(dt);
    if(shot.phase==='charging'||shot.phase==='accuracy')updateMeter();
    if(event.autoSwing)beginSwing();
    if(event.impact&&!online()){const accuracy=shotAccuracy(shot.error);ball=launch(ball,club,power*accuracy.powerScale,bearing+accuracy.bearingOffset,hole());strokes++;moving=true;impactSound();if(shot.rating==='Perfect!'){tone(980,.18,'triangle',.045);setTimeout(()=>tone(1320,.24,'sine',.04),75);}updateUI();}
    if(event.complete){updateMeter();$('#estimate').textContent='ลูกกำลังเคลื่อนที่';}
    if(moving&&!online()){
      if(ball.status==='moving'){
        accumulator+=dt;
        while(accumulator>=1/120&&ball.status==='moving'){
          const previousImpact=ball.impactSerial||0;stepBall(ball,1/120,hole(),wind);accumulator-=1/120;
          for(const event of ball.impacts||[])if(event.id>previousImpact){world.surfaceEffects.emit(event);surfaceSound(event);}
        }
      }
      if(ball.status==='water')waterDelay+=dt;
      if(ball.status!=='moving'&&shot.phase==='flight'&&(ball.status!=='water'||waterDelay>=.9)){accumulator=0;settle();}
      if(time-lastFlightUI>150){$('#distance').innerHTML=`${Math.round(distance(ball,pin())*2.5)} <small style="font-size:10px;color:#86947a">m</small>`;lastFlightUI=time;}
    }
    let renderedBall=ball;
    if(online()&&onlineDisplayBall){for(const axis of ['x','y','z'])onlineDisplayBall[axis]+=(ball[axis]-onlineDisplayBall[axis])*Math.min(1,dt*18);onlineDisplayBall.status=ball.status;renderedBall=onlineDisplayBall;}
    const elapsed=serverMotion?shot.elapsed+Math.min(.1,(performance.now()-lastStateAt)/1000):shot.elapsed;
    const label=world.render(dt,renderedBall,bearing,moving,{phase:shot.phase,elapsed,origin:shotOrigin,putting:club==='putter',power,perfect:shot.rating==='Perfect!'});
    $('#ball-label').style.left=`${label.x}px`;$('#ball-label').style.top=`${label.y}px`;
    $('#ball-label').style.display=label.visible&&!moving&&!finished&&shot.phase==='idle'?'flex':'none';
    for(const position of world.remoteLabels){const el=document.getElementById(`peer-${position.id}`);if(el){el.style.left=`${position.x}px`;el.style.top=`${position.y}px`;el.hidden=!position.visible;}}
  }
  requestAnimationFrame(frame);
}








