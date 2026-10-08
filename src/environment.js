import * as THREE from 'three';
import { terrainHeight } from './physics.js';

export function grassMaterial(mat){
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 grassPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngrassPosition=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader='varying vec3 grassPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=fract(sin(dot(floor(grassPosition.xz*22.0),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb*=.92+grain*.12;`);
  };return mat;
}

// Only vertical boundary faces: a flat top cap would hide negative terrain.
export function islandSkirt(hole) {
  const edge=[];
  for(let x=-32;x<32;x++)edge.push([x,-51]);
  for(let z=-51;z<51;z++)edge.push([32,z]);
  for(let x=32;x>-32;x--)edge.push([x,51]);
  for(let z=51;z>-51;z--)edge.push([-32,z]);
  const vertices=[];
  for(let i=0;i<edge.length;i++){
    const [x,z]=edge[i],[nx,nz]=edge[(i+1)%edge.length];
    const a=[x,terrainHeight(x,z,hole),z],b=[nx,terrainHeight(nx,nz,hole),nz],c=[x,-4,z],d=[nx,-4,nz];
    vertices.push(...a,...b,...c,...b,...d,...c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}

export function oceanMaterial() {
  const uniforms={time:{value:0}};
  const mat=new THREE.MeshStandardMaterial({color:0x159fac,roughness:.3,metalness:.25});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.seaTime=uniforms.time;
    shader.vertexShader='varying vec3 seaPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nseaPosition=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader='varying vec3 seaPosition;\nuniform float seaTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=seaPosition.xz;
      float wave=sin(p.x*.35+p.y*.61+seaTime*.7+sin(p.y*.09)*2.0)*sin(p.y*.49-p.x*.27-seaTime*.5);
      float glitter=pow(max(0.0,wave),16.0);
      float nearShore=exp(-max(abs(p.x)-32.0,abs(p.y)-51.0)*.045);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.08,.67,.64),clamp(nearShore*.42,0.0,.65));
      diffuseColor.rgb+=wave*.025+glitter*.17;`);
  };
  mat.userData.time=uniforms.time;return mat;
}

export function addIslandScenery(world,hole,random){
  const rockColors=[0x71848a,0x526977,0x8e9c94,0xb6b29a];
  // Shoreline props stay outside the playable bounds.
  for(let i=0;i<100;i++){
    const side=i%4,t=random(),x=side<2?(side===0?-33:33):-32+t*64,z=side<2?-51+t*102:(side===2?-52:52);
    const rock=world.mesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:rockColors[i%4],flatShading:true,roughness:1}),[x,-1.9,z]);
    rock.scale.set(1.3+random()*1.6,1.1+random()*1.7,1+random()*1.5);rock.rotation.set(random()*.7,random()*6,random()*.4);rock.castShadow=true;
    if(i%3===0){
      const foam=world.ellipse(x,z,2.5,1.6,0xd1fff2,-2.71);foam.material.dispose();foam.material=new THREE.MeshBasicMaterial({color:0xd1fff2,transparent:true,opacity:.45,depthWrite:false});
    }
  }
  for(let i=0;i<18;i++){
    const angle=i/18*Math.PI*2,x=Math.cos(angle)*(135+random()*80),z=Math.sin(angle)*(140+random()*70),height=9+random()*17;
    const mountain=world.mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:i%2?0x6299a0:0x78aca6,flatShading:true,roughness:1}),[x,height*.12-3,z]);
    mountain.rotation.y=random()*6;mountain.scale.set(12+random()*18,height,10+random()*14);
  }
  const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,emissive:0x7493a0,emissiveIntensity:.25,flatShading:false});
  for(let i=0;i<11;i++){
    const angle=i/11*Math.PI*2,x=Math.cos(angle)*155,z=Math.sin(angle)*155;
    for(let puff=0;puff<4;puff++){
      const cloud=world.mesh(new THREE.IcosahedronGeometry(1,1),cloudMat,[x+puff*7,26+random()*6,z]);
      cloud.scale.set(9,4+random()*5,6);cloud.receiveShadow=false;
    }
  }
  const leafMat=new THREE.MeshStandardMaterial({color:0x46842d,side:THREE.DoubleSide,flatShading:true});
  const flowerMats=[0xfa7157,0xffce58,0xe94f81].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  for(let i=0;i<52;i++){
    const x=(i%2?1:-1)*(25+random()*4),z=-45+random()*90;
    if(Math.hypot(x-hole.pin[0],z-hole.pin[1])<11)continue;
    const group=new THREE.Group();group.position.set(x,terrainHeight(x,z,hole),z);world.course.add(group);
    for(let j=0;j<5;j++){
      const leaf=world.mesh(new THREE.ConeGeometry(.28,1.8,3),leafMat,[0,.55,0],group);leaf.rotation.set(.7,0,j*Math.PI*2/5);leaf.rotation.y=j*1.7;
    }
    const flower=world.mesh(new THREE.IcosahedronGeometry(.27,0),flowerMats[i%3],[.15,1.05,.15],group);flower.scale.y=.45;
  }
}
