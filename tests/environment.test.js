import test from 'node:test';
import assert from 'node:assert/strict';
import { islandSkirt } from '../src/environment.js';
import { COURSES } from '../src/courses.js';
import { terrainHeight } from '../src/physics.js';

test('island shell has no interior cap that could bury the golfer on low greens',()=>{
  for(const course of Object.values(COURSES))for(const hole of course.holes){
    const geometry=islandSkirt(hole),p=geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      assert.ok(Math.abs(x)===32||Math.abs(z)===51,'shell vertices must stay on the perimeter');
      assert.ok(y===-4||Math.abs(y-terrainHeight(x,z,hole))<1e-5,'wall tops must follow the heightfield');
    }
    geometry.dispose();
  }
});
