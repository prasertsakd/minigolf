import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeProfile} from '../src/range.js';
import {HOLES,predict,distance} from '../src/physics.js';

const h=HOLES[0],wind={x:0,z:0};
test('flag displays actual player-to-hole distance and matches the flight model at its recommended power',()=>{
  const p={x:h.pin[0],z:h.pin[1]-40},guide=rangeProfile(p,'driver',h,wind);
  assert.equal(guide.targetMeters,100);assert.equal(guide.reachable,true);
  const endpoint=predict(p,'driver',guide.targetPower,0,h,wind).ball;
  assert.ok(Math.abs(distance(p,endpoint)*2.5-guide.targetMeters)<3);
  // Launch speed gives a nonlinear range: a linear 100/max placement is wrong.
  assert.ok(guide.ticks[2].meters>guide.ticks[1].meters*2.5);
});
test('changing club changes metre scale and moves flag, without changing distance to hole',()=>{
  const p={x:h.pin[0],z:h.pin[1]-30},driver=rangeProfile(p,'driver',h,wind),iron=rangeProfile(p,'iron',h,wind);
  assert.equal(driver.targetMeters,iron.targetMeters);assert.equal(driver.targetMeters,75);
  assert.notDeepEqual(driver.ticks,iron.ticks);assert.ok(iron.targetPower>driver.targetPower);
});
test('SW and PT have distinct full-power ranges and metre scales',()=>{
  const p={x:h.tee[0],z:h.tee[1]},sw=rangeProfile(p,'wedge',h,wind),pt=rangeProfile(p,'putter',h,wind);
  assert.ok(sw.maxMeters>pt.maxMeters);
  assert.notDeepEqual(sw.ticks,pt.ticks);
  assert.equal(sw.ticks.at(-1).meters,sw.maxMeters);
  assert.equal(pt.ticks.at(-1).meters,pt.maxMeters);
});
test('an unreachable hole keeps its real distance and puts an out-of-range flag at the end',()=>{
  const p={x:h.tee[0],z:h.tee[1]},guide=rangeProfile(p,'wedge',h,wind);
  assert.equal(guide.reachable,false);assert.equal(guide.targetPower,100);
  assert.ok(guide.targetMeters>guide.maxMeters);assert.equal(Math.round(guide.targetMeters),192);
});
test('moving player updates target distance; tick values use the currently selected club',()=>{
  const p={x:h.pin[0],z:h.pin[1]-20},next={x:p.x,z:p.z+10};
  const old=rangeProfile(p,'iron',h,wind),updated=rangeProfile(next,'putter',h,wind);
  assert.equal(old.targetMeters,50);assert.equal(updated.targetMeters,25);
  assert.deepEqual(updated.ticks.map(t=>t.power),[0,25,50,75,100]);
  for(const tick of updated.ticks){const end=predict(next,'putter',tick.power,0,h,wind).ball;assert.equal(tick.meters,distance(next,end)*2.5);}
});
