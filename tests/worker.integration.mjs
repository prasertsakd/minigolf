// Defaults to the local Worker. Override GOLF_TEST_API only for an authorized deployment check.
import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.GOLF_TEST_API||'http://127.0.0.1:8790';
const request=async(path,body)=>{const r=await fetch(`${base}/api/rooms${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body&&JSON.stringify(body)});return {status:r.status,...await r.json()};};
const until=async(check,timeout=15000)=>{const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw new Error('Timed out waiting for room state');await new Promise(r=>setTimeout(r,80));}};
async function socket(session,roomId){
  const ws=new WebSocket(`${base.replace('http','ws')}/api/rooms/${roomId}/ws`);
  const peer={ws,state:null,errors:[],send:message=>ws.send(JSON.stringify(message))};
  ws.addEventListener('open',()=>peer.send({type:'auth',playerId:session.playerId,token:session.token}));
  ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.type==='state')peer.state=data.state;else if(data.type==='error')peer.errors.push(data.error);});
  await until(()=>peer.state);return peer;
}
test('Worker API and WebSockets support a complete four-player round, waiting, reconnect and final rankings', {timeout:150000}, async()=>{
  const bad=await request('',{name:'Bad',capacity:5});assert.equal(bad.status,400);
  const created=await request('',{name:'Integration round',capacity:4,courseId:'canyon',roundLength:3,profile:{name:'Host'}});
  assert.equal(created.status,201);const roomId=created.room.id;
  const sessions=[created,...await Promise.all([1,2,3].map(i=>request(`/${roomId}/join`,{profile:{name:`Friend ${i}`,character:i%2?'male':'female'}})))];
  assert.equal((await request(`/${roomId}/join`,{profile:{name:'Extra'}})).status,400);
  assert.ok((await request('')).rooms.some(r=>r.id===roomId&&!r.joinable));
  const peers=[];
  // Real networks can authenticate guests before the creator. Preserve the original host.
  for(const i of [3,2,1,0])peers[i]=await socket(sessions[i],roomId);
  assert.equal(peers[0].state.hostId,sessions[0].playerId);
  try {
    peers[1].send({type:'start'});await until(()=>peers[1].errors.length);assert.match(peers[1].errors[0],/เจ้าของ/);
    for(const p of peers)p.send({type:'ready',ready:true});
    await until(()=>peers[0].state.players.every(p=>p.ready));peers[0].send({type:'start'});
    await until(()=>peers.every(p=>p.state.status==='playing'));
    assert.ok(peers.every(p=>JSON.stringify(p.state.wind)===JSON.stringify(peers[0].state.wind)));
    let command=0;
    const sendShot=i=>{const state=peers[i].state,p=state.players.find(p=>p.id===sessions[i].playerId);const message={type:'shot',holeIndex:state.holeIndex,commandId:`smoke-${command++}`,club:'putter',power:0,error:0,bearing:p.bearing};peers[i].send(message);peers[i].send(message);};
    for(let hole=0;hole<3;hole++){
      for(let stroke=0;stroke<12;stroke++){
        const previousRevision=peers[0].state.revision;
        const earlyFinish=hole===0&&stroke===11;
        for(let i=0;i<(earlyFinish?1:4);i++)sendShot(i);
        await until(()=>peers[0].state.revision>previousRevision&&peers[0].state.players[0].motion.phase==='swinging');
        await until(()=>peers[0].state.players.every((p,i)=>earlyFinish&&i>0||['idle','waiting'].includes(p.motion.phase)));
        if(earlyFinish){
          assert.equal(peers[0].state.holeIndex,0);assert.equal(peers[0].state.nextHoleIn,null);
          assert.equal(peers[0].state.players[0].done,true);assert.equal(peers[0].state.players[1].done,false);
          peers[0].ws.close();peers[0]=await socket(sessions[0],roomId);
          assert.equal(peers[0].state.players[0].scores[0],12);
          for(let i=1;i<4;i++)sendShot(i);
          await until(()=>peers[0].state.players.every(p=>p.done));
        }
      }
      if(hole<2)await until(()=>peers.every(p=>p.state.holeIndex===hole+1));
    }
    await until(()=>peers.every(p=>p.state.status==='finished'));
    assert.ok(peers.every(peer=>peer.state.players.every(p=>p.scores.join(',')==='12,12,12')));
    console.log('Verified: 4 real WebSockets, concurrent shots, one early finisher, reconnect, all 3 hole barriers and final scores.');
  } finally {for(const peer of peers){if(peer.ws.readyState===WebSocket.OPEN)peer.send({type:'leave'});peer.ws.close();}}
});

test('surface impact events reach every WebSocket and remain after the server resets a water ball', {timeout:25000}, async()=>{
  const created=await request('',{name:'Surface effects QA',capacity:2,courseId:'lagoon',roundLength:3,profile:{name:'Host'}});
  const joined=await request(`/${created.room.id}/join`,{profile:{name:'Guest'}});
  const peers=[await socket(created,created.room.id),await socket(joined,created.room.id)];
  try {
    for(const peer of peers)peer.send({type:'ready',ready:true});
    await until(()=>peers[0].state.players.every(p=>p.ready));peers[0].send({type:'start'});
    await until(()=>peers.every(p=>p.state.status==='playing'));
    peers[0].send({type:'shot',holeIndex:0,commandId:'water-effects',club:'driver',power:100,error:0,bearing:-Math.PI/2});
    await until(()=>peers.every(peer=>peer.state.players[0].effects?.some(e=>e.kind==='water')));
    await until(()=>peers.every(peer=>peer.state.players[0].motion.phase==='idle'));
    const expected=peers[0].state.players[0].effects.find(e=>e.kind==='water');
    assert.deepEqual(peers[1].state.players[0].effects.find(e=>e.kind==='water'),expected);
    assert.equal(peers[0].state.players[0].ball.status,'stopped');assert.equal(peers[0].state.players[0].strokes,2);
    peers[1].ws.close();peers[1]=await socket(joined,created.room.id);
    assert.deepEqual(peers[1].state.players[0].effects.find(e=>e.kind==='water'),expected);
  } finally {for(const peer of peers){if(peer.ws.readyState===WebSocket.OPEN)peer.send({type:'leave'});peer.ws.close();}}
});
