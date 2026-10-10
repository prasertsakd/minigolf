import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomGame, MAX_STROKES, RECONNECT_GRACE, NEXT_HOLE_DELAY, publicProfile } from '../src/room-game.js';
import { BALL_RADIUS, terrainHeight } from '../src/physics.js';

function room(count=2, options={}) {
  const game=new RoomGame({id:'test',name:'Friends',capacity:count,courseId:'lagoon',roundLength:3,...options},()=>.5);
  for(let i=0;i<count;i++){game.addPlayer(`p${i}`,{name:`Player ${i}`,character:i%2?'male':'female'},0);game.connect(`p${i}`,0);game.command(`p${i}`,{type:'ready',ready:true});}
  return game;
}
const run=(game,seconds)=>{for(let t=0;t<seconds;t+=1/60)game.tick(1/60);};
const shot=(game,id,extra={})=>game.command(id,{type:'shot',holeIndex:game.state.holeIndex,commandId:`${id}-${game.state.holeIndex}-${game.player(id).strokes}`,club:'driver',power:80,error:0,bearing:game.player(id).bearing,...extra});

test('impact events survive water reset and have bounded monotonic IDs in public snapshots',()=>{
  const game=room();game.command('p0',{type:'start'});const p=game.player('p0');
  for(let i=0;i<3;i++){
    shot(game,'p0',{bearing:-Math.PI/2,power:100});run(game,10);
    assert.equal(p.motion.phase,'idle');assert.equal(p.ball.status,'stopped');
  }
  const events=game.snapshot().players[0].effects;
  assert.equal(events.filter(e=>e.kind==='water').length,3);
  assert.ok(events.length<=8);assert.equal(new Set(events.map(e=>e.id)).size,events.length);
  const snapshot=game.snapshot();snapshot.players[0].effects[0].kind='tampered';
  assert.notEqual(game.player('p0').effects[0].kind,'tampered');
  assert.equal('impactSerial' in snapshot.players[0].ball,false);
});
test('water retains its impact location briefly before the authoritative penalty reset',()=>{
  const game=room();game.command('p0',{type:'start'});shot(game,'p0',{bearing:-Math.PI/2,power:100});
  const p=game.player('p0');for(let i=0;i<1200&&p.ball.status!=='water';i++)game.tick(1/120);
  assert.equal(p.ball.status,'water');const at={x:p.ball.x,z:p.ball.z};
  run(game,.5);assert.equal(p.ball.status,'water');assert.deepEqual({x:p.ball.x,z:p.ball.z},at);
  assert.throws(()=>shot(game,'p0'),/รอลูก/);run(game,1);assert.equal(p.ball.status,'stopped');assert.equal(p.strokes,2);
});

test('the room creator keeps hosting when guests authenticate first',()=>{
  const game=new RoomGame({id:'auth-order',name:'Friends',capacity:4,roundLength:3},()=>.5);
  for(let i=0;i<4;i++)game.addPlayer(`p${i}`,{name:`Player ${i}`},0);
  for(const i of [3,2,1,0]){game.connect(`p${i}`,10+i);game.command(`p${i}`,{type:'ready',ready:true});assert.equal(game.state.hostId,'p0');}
  assert.throws(()=>game.command('p1',{type:'start'}),/เจ้าของ/);
  game.command('p0',{type:'start'});assert.equal(game.state.status,'playing');
  game.disconnect('p0',100);assert.equal(game.state.hostId,'p1');
  game.disconnect('p1',101);game.disconnect('p2',102);game.disconnect('p3',103);
  game.connect('p2',104);assert.equal(game.state.hostId,'p2');
});

test('tee positions leave a 2 metre lane between adjacent players in 2-, 3- and 4-player rooms',()=>{
  for(const courseId of ['lagoon','canyon'])for(const count of [2,3,4]){
    const game=room(count,{courseId});game.command('p0',{type:'start'});
    for(let i=1;i<count;i++){
      const a=game.player(`p${i-1}`).ball,b=game.player(`p${i}`).ball;
      assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-2)<1e-9,`${courseId} ${count}-player lane ${i}`);
    }
  }
});

test('rooms validate capacity, course, membership, readiness and host permissions',()=>{
  assert.throws(()=>room(5));assert.throws(()=>room(2,{courseId:'other'}));assert.throws(()=>room(2,{roundLength:4}));
  const game=room();assert.throws(()=>game.addPlayer('extra',{}),/เต็ม/);
  assert.throws(()=>game.command('p1',{type:'start'}),/เจ้าของ/);
  game.command('p1',{type:'ready',ready:false});assert.throws(()=>game.command('p0',{type:'start'}),/ทุกคน/);
  game.command('p1',{type:'ready',ready:true});game.command('p0',{type:'start'});
  assert.equal(game.state.status,'playing');assert.throws(()=>game.addPlayer('late',{}),/เริ่ม/);
  assert.deepEqual(game.state.wind,{x:Math.sin(Math.PI)*3,z:-3});
  assert.notEqual(game.player('p0').ball.x,game.player('p1').ball.x);
});

test('2–4 players can launch simultaneously; a retry cannot duplicate strokes',()=>{
  for(const count of [2,3,4]){
    const game=room(count);game.command('p0',{type:'start'});
    for(let i=0;i<count;i++){shot(game,`p${i}`);shot(game,`p${i}`);}
    run(game,1);for(const p of game.state.players){assert.equal(p.strokes,1);assert.equal(p.ball.status,'moving');}
    run(game,25);for(const p of game.state.players){assert.equal(p.motion.phase,'idle');assert.ok(p.strokes>=1);}
  }
});

test('shot validation rejects positions, illegal clubs, stale holes and nonfinite input',()=>{
  const game=room();game.command('p0',{type:'start'});
  for(const invalid of [{power:101},{power:NaN},{club:'rocket'},{bearing:Infinity},{error:86},{holeIndex:2}])assert.throws(()=>shot(game,'p0',invalid));
  assert.throws(()=>game.command('p0',{type:'position',ball:{status:'holed'},holeIndex:0}));
  assert.equal(game.player('p0').strokes,0);assert.equal(game.player('p0').done,false);
});

test('an early finisher waits; all players advance together only after the barrier',()=>{
  const game=room();game.command('p0',{type:'start'});
  const p=game.player('p0');p.ball={x:8,z:35.5,y:terrainHeight(8,35.5,game.hole)+BALL_RADIUS,status:'stopped'};
  shot(game,'p0',{club:'putter',power:30,bearing:0});run(game,5);
  assert.equal(p.done,true);assert.equal(p.scores[0],1);assert.equal(game.state.holeIndex,0);assert.equal(game.state.nextHoleIn,null);
  assert.throws(()=>shot(game,'p0'),/รอ/);
  game.finishPlayer(game.player('p1'),3);game.tick(1/60);
  assert.equal(game.state.nextHoleIn,NEXT_HOLE_DELAY);
  run(game,3);assert.equal(game.state.holeIndex,0);run(game,1.1);assert.equal(game.state.holeIndex,1);
  assert.equal(game.player('p0').done,false);assert.equal(game.player('p1').strokes,0);assert.deepEqual(p.scores,[1]);
});

test('water penalties and the 12-stroke cap are enforced by the server',()=>{
  const game=room();game.command('p0',{type:'start'});const p=game.player('p0');
  p.strokes=11;p.ball={x:30.8,z:10,y:terrainHeight(30.8,10,game.hole)+BALL_RADIUS,status:'stopped'};
  shot(game,'p0',{club:'putter',power:100,bearing:Math.PI/2});run(game,4);
  assert.equal(p.done,true);assert.equal(p.scores[0],MAX_STROKES);assert.equal(p.ball.x,30.8);
});

test('disconnect supports resume and host transfer; expired or departed players do not block the round',()=>{
  const game=room();game.disconnect('p0',100);assert.equal(game.state.hostId,'p1');
  game.expireDisconnected(100+RECONNECT_GRACE-1);assert.ok(game.player('p0'));
  game.connect('p0',101);game.command('p1',{type:'start'});game.disconnect('p0',200);
  game.expireDisconnected(200+RECONNECT_GRACE);assert.equal(game.player('p0').withdrawn,true);
  game.finishPlayer(game.player('p1'),2);run(game,4.1);assert.equal(game.state.holeIndex,1);
  assert.equal(game.player('p0').done,true);
  game.finishPlayer(game.player('p1'),2);run(game,4.1);game.finishPlayer(game.player('p1'),2);run(game,4.1);
  assert.equal(game.state.status,'finished');assert.deepEqual(game.player('p0').scores,[12,12,12]);
});

test('a lobby departure frees its seat; public snapshots omit private session fields',()=>{
  const game=room();game.leave('p0');game.addPlayer('new',{name:'Friend'});
  assert.equal(game.state.hostId,'p1');assert.equal(game.summary().players,2);
  const snapshot=game.snapshot();assert.equal('commands' in snapshot.players[0],false);assert.equal('lastSafe' in snapshot.players[0],false);
  snapshot.players[0].scores.push(100);assert.deepEqual(game.player('p1').scores,[]);
  assert.deepEqual(publicProfile({name:'A'.repeat(40),character:'other',outfit:'other'}),{name:'A'.repeat(20),character:'female',outfit:'coral'});
});
