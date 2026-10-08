import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotControl,IMPACT_TIME,SWING_DURATION,swingPose,shotAccuracy} from '../src/shot.js';

test('first press charges and meter bounces repeatedly without firing',()=>{
  const shot=new ShotControl();assert.equal(shot.press(),'charge');
  shot.tick(.625);assert.equal(shot.power,50);
  shot.tick(.625);assert.equal(shot.power,100);
  shot.tick(.625);assert.equal(shot.power,50);
  shot.tick(.625);assert.equal(shot.power,0);
  assert.deepEqual(shot.tick(10),{impact:false,complete:false,autoSwing:false});
  assert.equal(shot.phase,'charging');
});
test('second press locks power; third press at the white line locks accuracy',()=>{
  const shot=new ShotControl();shot.press();shot.tick(.875);
  assert.equal(shot.press(),'accuracy');assert.equal(shot.power,70);
  shot.tick(55/60);assert.equal(shot.cursor,15);
  assert.equal(shot.press(),'swing');assert.equal(shot.rating,'Perfect!');
  assert.equal(shot.press(),null);
  assert.equal(shot.tick(IMPACT_TIME-.01).impact,false);
  assert.equal(shot.tick(.02).impact,true);
  assert.equal(shot.tick(.2).impact,false);assert.equal(shot.power,70);
  assert.equal(shot.tick(SWING_DURATION).complete,true);
  assert.equal(shot.tick(1).impact,false);assert.equal(shot.phase,'flight');
});
test('cancel power or accuracy permits a fresh shot, but cannot interrupt swing',()=>{
  const shot=new ShotControl();shot.press();shot.tick(1);assert.equal(shot.cancel(),true);
  assert.equal(shot.phase,'idle');shot.press();assert.equal(shot.power,0);
  shot.press();assert.equal(shot.cancel(),true);
  shot.press();shot.press();shot.press();assert.equal(shot.cancel(),false);
});
test('missed accuracy window produces one automatic late swing',()=>{
  const shot=new ShotControl();shot.press();shot.tick(1);shot.press();
  assert.equal(shot.tick(2).autoSwing,true);assert.equal(shot.error,-15);
  assert.equal(shot.tick(.1).autoSwing,false);assert.equal(shot.phase,'swinging');
});
test('low-power putts still provide time to hit the accuracy line',()=>{
  const shot=new ShotControl();shot.press();shot.tick(.05);shot.press();
  assert.equal(shot.power,4);assert.equal(shot.cursor,30);
  shot.tick(.25);shot.press();assert.equal(shot.rating,'Perfect!');
});
test('accuracy errors affect direction and distance while the nice window preserves aim',()=>{
  assert.equal(shotAccuracy(0).bearingOffset,0);assert.equal(shotAccuracy(0).powerScale,1);
  assert.equal(shotAccuracy(5).bearingOffset,0);
  assert.ok(shotAccuracy(20).bearingOffset<0);assert.ok(shotAccuracy(-15).bearingOffset>0);
  assert.ok(shotAccuracy(20).powerScale<1);
});
test('swing lifts club, meets ball at impact, follows through and returns to address',()=>{
  assert.equal(swingPose(0).angle,0);assert.ok(swingPose(.48).angle<-2);
  assert.equal(swingPose(IMPACT_TIME).angle,0);
  assert.ok(swingPose(1.03).angle>2);assert.equal(swingPose(SWING_DURATION).angle,0);
  assert.ok(Math.abs(swingPose(.48,true).angle)<Math.abs(swingPose(.48).angle));
});
