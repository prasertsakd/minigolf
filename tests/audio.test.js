import test from 'node:test';
import assert from 'node:assert/strict';
import { GolfAudio } from '../src/audio.js';

function fakeContext() {
  const context={state:'suspended',sampleRate:48000,currentTime:1,destination:{},resumes:0,starts:0,fail:false};
  const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};
  context.resume=()=>{context.resumes++;return Promise.resolve().then(()=>{if(context.fail)throw Error('Gesture blocked');context.state='running';});};
  context.createBuffer=(channels,length)=>({getChannelData:()=>new Float32Array(length)});
  context.createBufferSource=()=>({connect(){},disconnect(){},start(){context.starts++;},stop(){}});
  context.createOscillator=()=>({...context.createBufferSource(),frequency:parameter});
  context.createGain=()=>({connect(){},disconnect(){},gain:parameter});
  context.createBiquadFilter=()=>({connect(){},disconnect(){},Q:parameter,frequency:parameter});
  return context;
}
test('a gesture unlocks mobile audio before deferred swing and network sounds',async()=>{
  const ctx=fakeContext();let creates=0;
  const audio=new GolfAudio(()=>true,()=>{creates++;return ctx;});
  audio.tone();assert.equal(creates,0,'a render/network callback cannot initialize locked audio');
  const resumed=audio.unlock();
  assert.equal(ctx.resumes,1,'resume is invoked inside the gesture, before any await');
  assert.equal(ctx.starts,1,'a silent source primes the mobile output in that gesture');
  audio.tone();await resumed;await Promise.resolve();
  assert.equal(ctx.starts,2,'a sound during resume plays once the output is running');
  audio.noiseBurst();audio.tone();assert.equal(ctx.starts,4,'delayed impact sounds share the already unlocked output');
  await audio.unlock();assert.equal(ctx.resumes,1,'a running output needs no new context or unlock buffer');
});
test('the next gesture recovers suspended/interrupted audio and respects mute',async()=>{
  let enabled=false;const contexts=[];
  const audio=new GolfAudio(()=>enabled,()=>{const ctx=fakeContext();contexts.push(ctx);return ctx;});
  await audio.unlock();assert.equal(contexts.length,0);
  enabled=true;await audio.unlock();const ctx=contexts[0];
  ctx.state='interrupted';await audio.unlock();assert.equal(ctx.resumes,2);
  ctx.state='suspended';const resume=audio.unlock();audio.tone();enabled=false;await resume;
  const starts=ctx.starts;audio.tone();assert.equal(ctx.starts,starts,'muting discards pending and future sounds');
  enabled=true;ctx.state='closed';await audio.unlock();assert.equal(contexts.length,2);
});
test('a failed unlock can retry on the next actual interaction',async()=>{
  const ctx=fakeContext();ctx.fail=true;const audio=new GolfAudio(()=>true,()=>ctx);
  assert.equal(await audio.unlock(),false);ctx.fail=false;
  assert.equal(await audio.unlock(),true);audio.tone();assert.equal(ctx.starts,3);
});
