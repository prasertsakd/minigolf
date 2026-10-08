import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from '../src/courses.js';

test('the course picker offers two complete nine-hole courses with independent hole sets',()=>{
  assert.deepEqual(Object.keys(COURSES),['lagoon','canyon']);
  assert.notEqual(COURSES.lagoon.holes,COURSES.canyon.holes);
  for(const course of Object.values(COURSES)){
    assert.equal(course.holes.length,9,`${course.name} must have nine holes`);
    assert.equal(course.holes.reduce((sum,hole)=>sum+hole.par,0),36,`${course.name} should be par 36`);
    assert.equal(new Set(course.holes.map(hole=>hole.name)).size,9,`${course.name} hole names should be unique`);
    for(const hole of course.holes){
      assert.ok(hole.tee.every(Number.isFinite));
      assert.ok(hole.pin.every(Number.isFinite));
      assert.ok(hole.tee[0]>=-24&&hole.tee[0]<=24&&hole.tee[1]>=-51&&hole.tee[1]<=51,`${hole.name} tee must fit in the playable island`);
      assert.ok(hole.pin[0]>=-24&&hole.pin[0]<=24&&hole.pin[1]>=-51&&hole.pin[1]<=51,`${hole.name} green must fit in the playable island`);
    }
  }
});
