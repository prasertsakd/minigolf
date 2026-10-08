import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchTap } from '../src/touch.js';
import { ShotControl } from '../src/shot.js';

const pointer = (id, x = 100, time = 0, type = 'touch') => ({ pointerId: id, clientX: x, clientY: 100, timeStamp: time, pointerType: type });

test('one short touch tap fires exactly once', () => {
  let shots = 0;
  const tap = createTouchTap(() => shots++);
  tap.down(pointer(1));
  tap.up(pointer(1, 103, 100));
  tap.cancel(pointer(1, 103, 100));
  assert.equal(shots, 1);
});

test('pinch fingers never fire a shot, and the next normal tap still works', () => {
  let shots = 0;
  const tap = createTouchTap(() => shots++);
  tap.down(pointer(1));
  tap.down(pointer(2, 200, 20));
  tap.move(pointer(2, 220, 30));
  tap.up(pointer(1, 100, 90));
  tap.up(pointer(2, 220, 110));
  assert.equal(shots, 0);
  tap.down(pointer(3, 100, 200));
  tap.up(pointer(3, 100, 300));
  assert.equal(shots, 1);
});

test('touch recognizer ignores drags, long presses, cancelled pointers and mouse input', () => {
  let shots = 0;
  const tap = createTouchTap(() => shots++);
  tap.down(pointer(1));
  tap.move(pointer(1, 130, 50));
  tap.up(pointer(1, 100, 100));
  tap.down(pointer(2));
  tap.up(pointer(2, 100, 500));
  tap.down(pointer(3));
  tap.cancel(pointer(3));
  tap.up(pointer(3, 100, 100));
  tap.down(pointer(4, 100, 0, 'mouse'));
  tap.up(pointer(4, 100, 100, 'mouse'));
  assert.equal(shots, 0);
});

test('three taps advance power, accuracy and swing; a pinch cannot lock either meter',()=>{
  const shot=new ShotControl(),tap=createTouchTap(()=>shot.press());
  const single=id=>{tap.down(pointer(id));tap.up(pointer(id,100,100));};
  single(1);shot.tick(.9);assert.equal(shot.phase,'charging');
  tap.down(pointer(2));tap.down(pointer(3,200));tap.up(pointer(2,100,100));tap.up(pointer(3,200,100));
  assert.equal(shot.phase,'charging');
  single(4);assert.equal(shot.phase,'accuracy');
  shot.tick((shot.cursor-15)/60);single(5);
  assert.equal(shot.phase,'swinging');assert.equal(shot.rating,'Perfect!');
});
