import * as THREE from 'three';

const STYLES = {
  water: {count:38,life:1.25,spread:3.2,rise:5.5,scale:[.11,.22,.11],colors:[0xbff8ff,0x52d7ee,0xffffff],dust:0,rings:3},
  sand: {count:32,life:.95,spread:2.6,rise:2.8,scale:[.075,.065,.07],colors:[0xffd278,0xe6b367,0xffedb7],dust:4,rings:0},
  grass: {count:24,life:.8,spread:2.1,rise:2.5,scale:[.045,.18,.07],colors:[0x89be37,0x427a24,0xb7db65,0x755436],dust:1,rings:0},
  rock: {count:16,life:.7,spread:2.4,rise:2.3,scale:[.07,.07,.08],colors:[0xcec5b6,0x9e9587,0xe4ddca],dust:1,rings:0},
};
function dustTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.4,'rgba(255,255,255,.35)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(canvas);
}

// One shared, bounded pool for all four golfers; particles do not add physics or traffic.
export class SurfaceEffects {
  constructor(scene,{texture,random=Math.random,capacity=256}={}) {
    this.random=random;this.capacity=capacity;this.particles=[];this.group=new THREE.Group();scene.add(this.group);
    this.texture=texture||dustTexture();this.ownsTexture=!texture;
    this.chips=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),capacity);
    this.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.chips.frustumCulled=false;this.chips.count=0;this.group.add(this.chips);
    this.transform=new THREE.Object3D();this.color=new THREE.Color();
    this.puffs=Array.from({length:16},()=>{
      const mesh=new THREE.Sprite(new THREE.SpriteMaterial({map:this.texture,color:0xffdc9e,transparent:true,depthWrite:false,opacity:0}));
      mesh.visible=false;this.group.add(mesh);return {mesh,age:Infinity};
    });
    const geometry=new THREE.RingGeometry(.86,1,40);
    this.rings=Array.from({length:12},()=>{
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xdbfcff,transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:0}));
      mesh.rotation.x=-Math.PI/2;mesh.visible=false;this.group.add(mesh);return {mesh,age:Infinity};
    });
  }
  slot(pool) { return pool.find(p=>p.age>=p.life)||pool.reduce((oldest,p)=>p.age>oldest.age?p:oldest); }
  emit(event) {
    const style=STYLES[event.kind];if(!style)return;
    const force=Math.min(1.5,.65+Math.sqrt(Math.max(0,event.strength||0))*.16),random=this.random;
    for(let i=0;i<style.count;i++) {
      const angle=i/style.count*Math.PI*2+random()*.3,speed=(.4+random()*.6)*style.spread*force;
      this.particles.push({x:event.x,y:event.y+.09,z:event.z,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
        vy:(.45+random()*.55)*style.rise*force,age:0,life:style.life*(.75+random()*.25),
        scale:style.scale.map(s=>s*force*(.7+random()*.6)),color:style.colors[i%style.colors.length],angle:random()*6});
    }
    if(this.particles.length>this.capacity)this.particles.splice(0,this.particles.length-this.capacity);
    for(let i=0;i<style.dust;i++) {
      const puff=this.slot(this.puffs);puff.age=0;puff.life=event.kind==='sand'?1.2:.65;
      puff.x=event.x+(random()-.5)*.8;puff.y=event.y+.2;puff.z=event.z+(random()-.5)*.8;puff.size=force*(event.kind==='sand'?1.7:.75);
      puff.mesh.material.color.set(event.kind==='sand'?0xf8d799:event.kind==='grass'?0x90865b:0xc4b9a5);
      puff.opacity=event.kind==='sand'?.48:.24;puff.mesh.visible=true;
    }
    for(let i=0;i<style.rings;i++) {
      const ring=this.slot(this.rings);ring.age=-i*.13;ring.life=1.35;ring.force=force;
      ring.mesh.position.set(event.x,event.y+.015+i*.003,event.z);ring.mesh.visible=false;
    }
  }
  update(dt) {
    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const [i,p] of this.particles.entries()) {
      p.age+=dt;p.vy-=7.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const fade=Math.max(0,Math.min(1,(p.life-p.age)/.22));
      this.transform.position.set(p.x,p.y,p.z);this.transform.rotation.set(p.angle+p.age*6,p.age*4,p.age*5);
      this.transform.scale.set(...p.scale.map(s=>s*fade));this.transform.updateMatrix();
      this.chips.setMatrixAt(i,this.transform.matrix);this.color.setHex(p.color);this.chips.setColorAt(i,this.color);
    }
    this.chips.count=this.particles.length;this.chips.instanceMatrix.needsUpdate=true;
    if(this.chips.instanceColor)this.chips.instanceColor.needsUpdate=true;
    for(const puff of this.puffs) {
      puff.age+=dt;puff.mesh.visible=puff.age<puff.life;
      if(!puff.mesh.visible)continue;
      puff.mesh.position.set(puff.x+puff.age*.45,puff.y+puff.age*.5,puff.z);
      puff.mesh.scale.setScalar(puff.size*(.5+puff.age*1.5));puff.mesh.material.opacity=puff.opacity*Math.sin(Math.PI*puff.age/puff.life);
    }
    for(const ring of this.rings) {
      ring.age+=dt;ring.mesh.visible=ring.age>=0&&ring.age<ring.life;
      if(!ring.mesh.visible)continue;
      ring.mesh.scale.setScalar(.25+ring.age*3.2*ring.force);ring.mesh.material.opacity=.65*(1-ring.age/ring.life);
    }
  }
  clear() {
    this.particles=[];this.chips.count=0;
    for(const p of [...this.puffs,...this.rings]) {p.age=Infinity;p.mesh.visible=false;}
  }
  dispose() {
    this.group.removeFromParent();this.chips.geometry.dispose();this.chips.material.dispose();
    this.rings[0].mesh.geometry.dispose();for(const p of [...this.puffs,...this.rings])p.mesh.material.dispose();
    if(this.ownsTexture)this.texture.dispose();
  }
}
