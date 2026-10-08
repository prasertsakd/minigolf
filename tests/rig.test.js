import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GolfWorld} from '../src/world.js';
import {swingPose,IMPACT_TIME,SWING_DURATION} from '../src/shot.js';

test('strong swing coils hips and shoulders, plants weight and raises the rear heel for a held finish',()=>{
  const coil=swingPose(.6),finish=swingPose(1.2);
  assert.ok(coil.angle<-2.6);assert.ok(coil.hipTurn+coil.turn>1);
  assert.ok(coil.crouch>.1);assert.ok(coil.shift<0);
  assert.ok(finish.hipTurn+finish.turn<-1.3);assert.ok(finish.shift>.2);assert.ok(finish.heel>.8);
  assert.deepEqual(swingPose(1.2),swingPose(1.45));
  assert.ok(Math.abs(swingPose(.6,false,20).angle)<Math.abs(coil.angle));
  assert.ok(Math.abs(swingPose(.6,true).angle)<.6);
});
test('club head meets ball at impact for every bearing despite the large body animation',()=>{
  // Build only the procedural rig: no WebGL/browser context is needed.
  const world=Object.create(GolfWorld.prototype);world.character=world.makeCharacter();
  for(const bearing of [0,Math.PI/3,-Math.PI/2,Math.PI]){
    const ball=new THREE.Vector3(7,.23,-12);
    world.character.position.set(ball.x-Math.cos(bearing)*1.5,0,ball.z+Math.sin(bearing)*1.5);
    world.character.rotation.y=bearing-Math.PI/2;
    world.poseCharacter(.6,true,false);world.poseCharacter(IMPACT_TIME,true,false);
    world.character.updateMatrixWorld(true);
    assert.ok(world.clubHead.getWorldPosition(new THREE.Vector3()).distanceTo(ball)<1e-6);
    assert.equal(world.feet[0].position.y,.16);
    world.poseCharacter(SWING_DURATION,true,false);
    world.character.updateMatrixWorld(true);
    assert.ok(world.clubHead.getWorldPosition(new THREE.Vector3()).distanceTo(ball)<1e-6);
  }
});

test('backswing stays behind the ball and body/follow-through turn toward the hole for every aim',()=>{
  const world=Object.create(GolfWorld.prototype);world.character=world.makeCharacter();
  for(const bearing of [0,Math.PI/3,-Math.PI/2,Math.PI])for(const power of [20,100])for(const putting of [false,true]){
    const ball=new THREE.Vector3(7,.23,-12),forward=new THREE.Vector3(Math.sin(bearing),0,Math.cos(bearing));
    world.character.position.set(ball.x-Math.cos(bearing)*1.5,0,ball.z+Math.sin(bearing)*1.5);
    world.character.rotation.y=bearing-Math.PI/2;
    for(const time of [.3,.58,.78]){
      world.poseCharacter(time,true,putting,power);world.character.updateMatrixWorld(true);
      assert.ok(world.clubHead.getWorldPosition(new THREE.Vector3()).sub(ball).dot(forward)<0,`backswing ${time}, aim ${bearing}`);
    }
    for(const time of [.97,1.1,1.52]){
      world.poseCharacter(time,true,putting,power);world.character.updateMatrixWorld(true);
      assert.ok(world.clubHead.getWorldPosition(new THREE.Vector3()).sub(ball).dot(forward)>0,`follow-through ${time}, aim ${bearing}`);
      const facing=new THREE.Vector3(0,0,-1).applyQuaternion(world.torso.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(facing.dot(forward)>0,'torso turns toward the hole');
    }
  }
});
