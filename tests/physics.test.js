import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLES, launch, predict, stepBall, surfaceAt } from '../src/physics.js';
import { COURSES } from '../src/courses.js';
test('an 80 percent driver shot flies and settles on the course',()=>{
  const h=HOLES[0],position={x:h.tee[0],z:h.tee[1]},angle=Math.atan2(h.pin[0]-position.x,h.pin[1]-position.z);
  const result=predict(position,'driver',80,angle,h,{x:0,z:0});
  assert.equal(result.ball.status,'stopped');assert.ok(result.points.some(p=>p.y>5));assert.ok(result.ball.z>20);assert.ok(Number.isFinite(result.ball.x));
});
test('a gentle putt toward the cup is captured',()=>{
  const h=HOLES[0],result=predict({x:h.pin[0],z:h.pin[1]-3},'putter',40,0,h,{x:0,z:0});
  assert.equal(result.ball.status,'holed');assert.equal(result.ball.z,h.pin[1]);
});
test('water hazards stop the ball and airborne balls can cross them',()=>{
  const h=HOLES[1];assert.equal(surfaceAt(0,0,h),'water');const b=launch({x:0,z:-2},'putter',50,0);
  for(let i=0;i<1000&&b.status==='moving';i++)stepBall(b,1/120,h);
  assert.equal(b.status,'water');const flying={x:0,y:5,z:0,vx:0,vy:0,vz:10,status:'moving',bounces:0};stepBall(flying,1/120,h);assert.equal(flying.status,'moving');
});
test('crosswind bends the flight and headwind or tailwind changes carry distance',()=>{
  const h=HOLES[0],position={x:h.tee[0],z:h.tee[1]},bearing=Math.atan2(h.pin[0]-position.x,h.pin[1]-position.z);
  const calm=predict(position,'driver',80,bearing,h,{x:0,z:0}).ball;
  const crosswind=predict(position,'driver',80,bearing,h,{x:4,z:0}).ball;
  const tailwind=predict(position,'driver',80,bearing,h,{x:0,z:4}).ball;
  const headwind=predict(position,'driver',80,bearing,h,{x:0,z:-4}).ball;
  assert.ok(crosswind.x>calm.x+0.5,'crosswind should drift the ball downwind');
  assert.ok(tailwind.z>calm.z+0.5,'tailwind should extend carry');
  assert.ok(headwind.z<calm.z-0.5,'headwind should reduce carry');
});
test('all club powers finish with finite positions on every hole in both courses',()=>{
  for(const h of Object.values(COURSES).flatMap(course=>course.holes))for(const club of ['driver','iron','wedge','putter'])for(const power of [5,50,100]){
    const p={x:h.tee[0],z:h.tee[1]},angle=Math.atan2(h.pin[0]-p.x,h.pin[1]-p.z),result=predict(p,club,power,angle,h,{x:2,z:-1});
    assert.ok(['stopped','water','holed'].includes(result.ball.status));assert.ok(Number.isFinite(result.ball.x)&&Number.isFinite(result.ball.z));
  }
});
