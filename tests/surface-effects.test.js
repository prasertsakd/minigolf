import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SurfaceEffects } from '../src/surface-effects.js';
import { GolfWorld } from '../src/world.js';

test('four-player impact bursts keep a bounded particle pool and expire fully between holes',()=>{
  const scene=new THREE.Scene(),texture=new THREE.Texture();
  const effects=new SurfaceEffects(scene,{texture,random:()=>.5});
  for(let i=0;i<50;i++)effects.emit({kind:['water','sand','grass','rock'][i%4],x:0,y:0,z:0,strength:12});
  effects.update(1/60);assert.ok(effects.chips.count<=256);assert.equal(effects.group.children.length,29);
  for(let i=0;i<180;i++)effects.update(1/60);
  assert.equal(effects.chips.count,0);assert.ok(effects.puffs.every(p=>!p.mesh.visible));assert.ok(effects.rings.every(p=>!p.mesh.visible));
  effects.emit({kind:'water',x:0,y:0,z:0,strength:8});effects.clear();assert.equal(effects.chips.count,0);
  effects.dispose();assert.equal(scene.children.length,0);
});
test('repeated snapshots emit each surface impact once and a reconnect does not replay old bursts',()=>{
  const emitted=[],world={surfaceEffectIds:new Map(),surfaceEffects:{emit:e=>emitted.push(e.id)}};
  const receive=(events,initial)=>GolfWorld.prototype.receiveSurfaceEffects.call(world,'p1',events,initial);
  receive([{id:1}],true);receive([{id:1},{id:2}],false);receive([{id:1},{id:2}],false);receive([{id:2},{id:3}],false);
  assert.deepEqual(emitted,[2,3]);
});
