import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchAim } from '../src/touch.js';
import { ShotControl } from '../src/shot.js';

const pointer = (id, x = 100, time = 0, type = 'touch') => ({ pointerId: id, clientX: x, clientY: 100, timeStamp: time, pointerType: type });

test('touch drags adjust aim incrementally and taps/compatibility clicks cannot fire shots', () => {
  const deltas=[],aim=createTouchAim(dx=>deltas.push(dx));
  aim.down(pointer(1));aim.move(pointer(1,104));assert.deepEqual(deltas,[]);
  aim.move(pointer(1,125));aim.move(pointer(1,135));aim.up(pointer(1,135,200));
  assert.deepEqual(deltas,[25,10]);assert.equal(aim.shouldHandleClick({timeStamp:210}),false);
  aim.down(pointer(2,100,300));aim.up(pointer(2,100,400));assert.deepEqual(deltas,[25,10]);
  assert.equal(aim.shouldHandleClick({pointerType:'touch',timeStamp:1500}),false);
  assert.equal(aim.shouldHandleClick({sourceCapabilities:{firesTouchEvents:true},timeStamp:1500}),false);
  assert.equal(aim.shouldHandleClick({pointerType:'mouse',timeStamp:1500}),true);
});

test('a pinch cannot rotate aim even with one finger remaining; the next drag recovers', () => {
  let degrees=0;const aim=createTouchAim(dx=>degrees+=dx);
  aim.down(pointer(1));aim.down(pointer(2,200));aim.move(pointer(2,240));aim.up(pointer(1,100,100));aim.move(pointer(2,260));aim.up(pointer(2,260,120));
  assert.equal(degrees,0);aim.down(pointer(3));aim.move(pointer(3,120));aim.up(pointer(3,120,200));assert.equal(degrees,20);
});

test('busy, vertical, cancelled and mouse gestures do not change touch aim', () => {
  let enabled=false,deltas=0;const aim=createTouchAim(()=>deltas++,()=>enabled);
  aim.down(pointer(1));enabled=true;aim.move(pointer(1,120));aim.up(pointer(1));
  aim.down(pointer(2));aim.move({...pointer(2,101),clientY:140});aim.move(pointer(2,150));aim.up(pointer(2));
  aim.down(pointer(3));aim.cancel(pointer(3));aim.move(pointer(3,130));
  aim.down(pointer(4,100,0,'mouse'));aim.move(pointer(4,140,0,'mouse'));assert.equal(deltas,0);
});

test('the button starts charge and touch taps can lock power and accuracy without disturbing aim',()=>{
  const shot=new ShotControl();let degrees=0,taps=0;
  const aim=createTouchAim(dx=>degrees+=dx,()=>shot.phase==='idle',()=>{taps++;shot.press();},()=>['charging','accuracy'].includes(shot.phase));
  aim.down(pointer(1));aim.move(pointer(1,120));aim.up(pointer(1));assert.equal(shot.phase,'idle');assert.equal(degrees,20);
  shot.press();shot.tick(.9);assert.equal(shot.phase,'charging');
  aim.down(pointer(2));aim.up(pointer(2,100,500));assert.equal(degrees,20);assert.equal(shot.phase,'accuracy');
  shot.tick((shot.cursor-15)/60);aim.down(pointer(3));aim.up(pointer(3,100,700));
  assert.equal(taps,2);assert.equal(shot.phase,'swinging');assert.equal(shot.rating,'Perfect!');
});

test('tap-to-lock rejects drags, pinches, vertical gestures and taps outside shot timing stages',()=>{
  const shot=new ShotControl();let taps=0;
  const aim=createTouchAim(()=>{},()=>shot.phase==='idle',()=>taps++,()=>['charging','accuracy'].includes(shot.phase));
  aim.down(pointer(1));aim.up(pointer(1));assert.equal(taps,0);
  shot.press();
  aim.down(pointer(2));aim.move(pointer(2,120));aim.up(pointer(2,120,300));assert.equal(taps,0);
  aim.down(pointer(3));aim.down(pointer(4,200));aim.up(pointer(3,100,400));aim.up(pointer(4,200,410));assert.equal(taps,0);
  aim.down(pointer(5));aim.move({...pointer(5,101),clientY:120});aim.up(pointer(5,101,500));assert.equal(taps,0);
});
