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
  for(const character of ['female','male']){
  const world=Object.create(GolfWorld.prototype);world.character=world.makeCharacter({character});
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
  }
});

test('backswing stays behind the ball and body/follow-through turn toward the hole for every aim',()=>{
  for(const character of ['female','male']){
  const world=Object.create(GolfWorld.prototype);world.character=world.makeCharacter({character});
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
  }
});

test('detailed golfers keep batched geometry finite and their moving joints connected with every outfit',()=>{
  const outfits=[{shirt:0xe39b94,cap:0xe39b94,bottom:0xfff9e9},{shirt:0x4f9477,cap:0xf0d27b,bottom:0xf5f0dc},
    {shirt:0x6a9fbe,cap:0x3c617b,bottom:0xf4f1e5},{shirt:0xd27a52,cap:0xe7ba69,bottom:0x58483e}];
  for(const character of ['female','male'])for(const outfit of outfits){
    const world=Object.create(GolfWorld.prototype);world.character=world.makeCharacter({character,outfit});
    let meshes=0,triangles=0;const colors=new Set();
    world.character.traverse(object=>{
      if(!object.isMesh)return;meshes++;colors.add(object.material.color.getHex());
      const geometry=object.geometry;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
      for(const attr of ['position','normal'])assert.ok(geometry.attributes[attr].array.every(Number.isFinite),'baked vertex data is finite');
    });
    assert.ok(meshes<=64,'static details should be batched for mobile draw-call cost');
    assert.ok(triangles<22000,'one golfer stays within its triangle budget');
    for(const color of [outfit.shirt,outfit.cap,outfit.bottom])assert.ok(colors.has(color),'selected palette is retained');
    for(const time of [0,.6,IMPACT_TIME,1.2,SWING_DURATION]){
      world.poseCharacter(time,true,false);
      for(const arm of world.arms){
        assert.equal(arm.elbow.parent,world.torso,'animated elbow stays attached after batching');
        arm.lower.updateMatrix();const elbow=new THREE.Vector3(0,-.5,0).applyMatrix4(arm.lower.matrix);
        assert.ok(elbow.distanceTo(arm.elbow.position)<1e-6,'elbow follows forearm through the swing');
      }
      for(const leg of world.legs){
        assert.equal(leg.knee.parent,world.character,'animated knee stays attached after batching');
        leg.upper.updateMatrix();const knee=new THREE.Vector3(0,.5,0).applyMatrix4(leg.upper.matrix);
        assert.ok(knee.distanceTo(leg.knee.position)<1e-6,'knee follows thigh through the swing');
      }
    }
    world.disposeGroup(world.character);
  }
});
