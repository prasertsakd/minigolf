import test from 'node:test';
import assert from 'node:assert/strict';
import { BALL_RADIUS, HOLES, createCourseRocks, courseRocks, stepBall, surfaceAt } from '../src/physics.js';
import { COURSES } from '../src/courses.js';

const flat={name:'Collision test',tee:[0,-30],pin:[0,30],bend:0,sand:[],water:[],rocks:[],terrain:null};
const moving=(x,y,z,vx,vy,vz)=>({x,y,z,vx,vy,vz,status:'moving',bounces:0});
test('random-looking obstacle layouts are identical across independent clients and servers, and avoid tees, cups and hazards',()=>{
  for(const hole of Object.values(COURSES).flatMap(c=>c.holes)){
    const rocks=courseRocks(hole);
    assert.deepEqual(rocks,createCourseRocks(JSON.parse(JSON.stringify(hole))));
    assert.ok(rocks.length>=10);
    for(const rock of rocks){
      assert.ok(Math.hypot(rock.x-hole.tee[0],rock.z-hole.tee[1])>=9);
      assert.ok(Math.hypot(rock.x-hole.pin[0],rock.z-hole.pin[1])>=12);
      assert.ok(['fairway','rough'].includes(surfaceAt(rock.x,rock.z,hole)));
    }
  }
  assert.notDeepEqual(courseRocks(HOLES[0]),courseRocks(HOLES[1]));
  let n=0;const injected=()=>((n++*37)%101)/101;
  const a=createCourseRocks(flat,injected);n=0;assert.deepEqual(a,createCourseRocks(flat,injected));
});
test('a glancing rock hit redirects the ball, a high shot clears it, and swept contact cannot tunnel through it',()=>{
  for(const scale of [1,.2]){
  const hole={...flat,rocks:[{x:0,z:0,radius:.65*scale,height:.55*scale}]};
  const x=scale===1?.45:.18,glance=moving(x,BALL_RADIUS,-2,0,0,6);
  for(let i=0;i<60&&!(glance.impacts||[]).length;i++)stepBall(glance,1/120,hole);
  assert.ok(glance.vx>1,'offset contact must deflect right');assert.ok(glance.vy>0,'the low pebble produces a small hop');
  assert.equal(glance.impacts[0].kind,'rock');
  const high=moving(0,4,-2,0,0,20);stepBall(high,.2,hole);assert.equal(high.impacts?.length||0,0);assert.equal(high.vz,20);
  const fast=moving(0,BALL_RADIUS,-2,0,0,40);stepBall(fast,.1,hole);
  assert.equal(fast.impacts[0].kind,'rock','swept contact detects even the smallest pebble');
  assert.ok(fast.vz<35,'continuous collision slows/redirects a ball that crosses the full pebble in one step');
  const copy=moving(x,BALL_RADIUS,-2,0,0,6);
  for(let i=0;i<60&&!(copy.impacts||[]).length;i++)stepBall(copy,1/120,hole);
  assert.deepEqual(copy,glance,'collision contains no per-client random impulse');
  }
});
test('landing and hazard entry produce distinct bounded effects without changing penalties',()=>{
  for(const kind of ['water','sand','grass']){
    const hole={...flat,[kind==='water'?'water':'sand']:kind==='grass'?[]:[[0,0,3,3]]};
    const b=moving(0,.4,0,1,-5,1);stepBall(b,.1,hole);
    assert.equal(b.impacts[0].kind,kind);assert.equal(b.status,kind==='water'?'water':'moving');
  }
  const sand={...flat,sand:[[0,0,2,2]]},b=moving(0,BALL_RADIUS,-2.2,0,0,4);
  for(let i=0;i<100&&b.status==='moving';i++)stepBall(b,1/120,sand);
  assert.equal(b.impacts.filter(e=>e.kind==='sand').length,1,'rolling into sand emits once, not every physics tick');
});
