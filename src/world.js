import * as THREE from 'three';
import { BALL_RADIUS, surfaceAt, terrainHeight, courseRocks } from './physics.js';
import { swingPose, IMPACT_TIME } from './shot.js';
import { islandSkirt, oceanMaterial, addIslandScenery, grassMaterial } from './environment.js';
import { createGolferRig } from './golfer.js';
import { SurfaceEffects } from './surface-effects.js';

const material = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,...extra});
const colors={grass:0x78ae61,fairway:0x98c67a,green:0xb4d588,sand:0xf4dba4,trunk:0xa98364,leaf:0x4f9271};
const themes={
  lagoon:{background:0x9fd6ef,fog:0x9fd6ef,fogNear:150,fogFar:340,sky:0xffffff,outside:0xa5d8d5,ground:0x54882f,side:0xd5bd91,fairwayA:0x8dbc42,fairwayB:0x78a938,greenOuter:0x68a137,green:0x9bc84e,sandRim:0xc49f71,sand:0xf4dba4,waterRim:0x86b9a2,water:0x78c2c8,waterLight:0x8dced0,trunk:0xa98364,leaf:0x4f9271,sun:0xfff7df,ambient:0x88a99d},
  canyon:{background:0xe6bd9a,fog:0xe6bd9a,fogNear:185,fogFar:360,sky:0xffd6b7,outside:0xc6a77f,ground:0xa99863,side:0x825640,fairwayA:0xa9c47a,fairwayB:0x96b16c,greenOuter:0x799957,green:0xb1ca75,sandRim:0x9d6249,sand:0xe0bf86,waterRim:0x648c78,water:0x55a999,waterLight:0x73c7ad,trunk:0x76523c,leaf:0x4d7050,sun:0xffe1ba,ambient:0xa27a5b},
};
export class GolfWorld {
  constructor(canvas,appearance={}) {
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xc2e3df);
    this.scene.fog=new THREE.Fog(0xc2e3df,210,390);
    this.createSky();
    this.overviewCamera=new THREE.OrthographicCamera(-70,70,50,-50,.1,550);
    this.playerCamera=new THREE.PerspectiveCamera(48,1,.1,550);
    this.scene.add(this.overviewCamera,this.playerCamera);
    this.camera=this.overviewCamera;
    this.createClouds();
    this.hemisphere=new THREE.HemisphereLight(0xfff7df,0x7497ad,1.35);this.scene.add(this.hemisphere);
    this.sun=new THREE.DirectionalLight(0xffe1ad,3.2);this.sun.position.set(-45,90,-45);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-75;this.sun.shadow.camera.right=75;this.sun.shadow.camera.top=75;this.sun.shadow.camera.bottom=-75;this.sun.shadow.camera.far=200;this.sun.shadow.normalBias=.035;this.scene.add(this.sun);
    this.course=new THREE.Group();this.scene.add(this.course);
    this.surfaceEffects=new SurfaceEffects(this.scene);this.surfaceEffectIds=new Map();
    this.ocean=this.mesh(new THREE.PlaneGeometry(900,900),oceanMaterial(),[0,-2.8,0],this.scene);this.ocean.rotation.x=-Math.PI/2;
    this.ball=this.mesh(new THREE.SphereGeometry(BALL_RADIUS,20,16),material(0xffffff),[0,BALL_RADIUS,0],this.scene);this.ball.castShadow=true;
    this.ballHalo=this.mesh(new THREE.RingGeometry(.7,.84,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,side:THREE.DoubleSide}),[0,.07,0],this.scene);this.ballHalo.rotation.x=-Math.PI/2;
    this.guide=new THREE.Group();this.scene.add(this.guide);
    this.character=this.makeCharacter(appearance);this.scene.add(this.character);
    this.makeShotEffects();
    this.cameraMode='overview';this.zoom=1;this.cameraTarget=new THREE.Vector3(0,0,0);this.cameraPosition=new THREE.Vector3(110,125,-145);
    this.clock=0;this.wind={x:0,z:0};this.windHeading=0;this.windStrength=0;this.ready=false;
    this.remotePlayers=new Map();this.remoteLabels=[];
    new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.resize();
    canvas.addEventListener('wheel',event=>{event.preventDefault();this.changeZoom(event.deltaY<0?.1:-.1);},{passive:false});
    const touches=new Map();let pinchDistance=0;
    canvas.addEventListener('pointerdown',event=>{canvas.focus({preventScroll:true});if(event.pointerType!=='touch')return;canvas.setPointerCapture(event.pointerId);touches.set(event.pointerId,{x:event.clientX,y:event.clientY});pinchDistance=0;});
    canvas.addEventListener('pointermove',event=>{
      if(!touches.has(event.pointerId))return;touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){const [a,b]=[...touches.values()],nextDistance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)this.changeZoom(this.zoom*(nextDistance/pinchDistance-1));pinchDistance=nextDistance;}
    });
    const endTouch=event=>{touches.delete(event.pointerId);pinchDistance=0;};canvas.addEventListener('pointerup',endTouch);canvas.addEventListener('pointercancel',endTouch);canvas.addEventListener('lostpointercapture',endTouch);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();document.querySelector('#loading').hidden=false;document.querySelector('#loading').textContent='กราฟิกถูกพักชั่วคราว กรุณารีโหลดหน้าเกม';});
  }
  createSky(){
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;
    const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,canvas.height);
    gradient.addColorStop(0,'#127ed0');gradient.addColorStop(.28,'#279be5');gradient.addColorStop(.58,'#70cafa');gradient.addColorStop(.82,'#c0e9fa');gradient.addColorStop(1,'#e6f4fc');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
    const cloud=(x,y,width,height,opacity)=>{
      ctx.save();ctx.globalAlpha=opacity;
      const shade=ctx.createLinearGradient(0,y-height*.5,0,y+height*.65);shade.addColorStop(0,'rgba(255,255,255,.82)');shade.addColorStop(.62,'rgba(250,255,244,.78)');shade.addColorStop(1,'rgba(155,207,209,.42)');
      ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(x,y+height*.22,width*.51,height*.28,0,0,Math.PI*2);ctx.fill();
      for(const [dx,dy,sx,sy] of [[-.34,.05,.25,.39],[-.13,-.13,.32,.55],[.13,-.2,.34,.66],[.38,.02,.25,.4]]){
        const puff=ctx.createRadialGradient(x+dx*width,y+dy*height-height*.1,1,x+dx*width,y+dy*height,width*.32);
        puff.addColorStop(0,'rgba(255,255,255,.98)');puff.addColorStop(.7,'rgba(248,255,247,.84)');puff.addColorStop(1,'rgba(203,234,231,.12)');
        ctx.fillStyle=puff;ctx.beginPath();ctx.ellipse(x+dx*width,y+dy*height,width*sx,height*sy,0,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    };
      [[85,365,150,54,.28],[390,410,185,64,.24],[755,350,160,56,.26],[1130,405,175,60,.24],[1450,360,150,54,.26]].forEach(args=>cloud(...args));
    const sunGlow=ctx.createRadialGradient(435,400,2,435,400,48);sunGlow.addColorStop(0,'rgba(255,255,216,.68)');sunGlow.addColorStop(.2,'rgba(255,249,210,.24)');sunGlow.addColorStop(1,'rgba(255,249,210,0)');ctx.fillStyle=sunGlow;ctx.fillRect(385,350,100,100);
    ctx.fillStyle='rgba(255,250,214,.92)';ctx.beginPath();ctx.arc(435,400,9,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.68)';ctx.lineWidth=3;ctx.lineCap='round';
    for(const [x,y,size] of [[744,348,11],[772,361,8],[805,340,10],[1037,372,8]]){ctx.beginPath();ctx.moveTo(x-size,y);ctx.quadraticCurveTo(x,y-size*.4,x+size,y);ctx.stroke();}
    this.skyTexture=new THREE.CanvasTexture(canvas);this.skyTexture.colorSpace=THREE.SRGBColorSpace;this.skyTexture.wrapS=THREE.RepeatWrapping;this.skyTexture.wrapT=THREE.ClampToEdgeWrapping;
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(480,48,32),new THREE.MeshBasicMaterial({map:this.skyTexture,side:THREE.BackSide,depthWrite:false,fog:false}));
    this.sky.frustumCulled=false;this.sky.renderOrder=-1000;this.scene.add(this.sky);
  }
  createClouds(){
    const cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;
    const ctx=cloudCanvas.getContext('2d');
    ctx.fillStyle='rgba(214,232,231,.62)';ctx.beginPath();ctx.ellipse(128,94,94,22,0,0,Math.PI*2);ctx.fill();
    for(const [x,y,r] of [[48,78,25],[87,58,34],[132,48,40],[178,57,34],[215,76,24]]){
      const puff=ctx.createLinearGradient(x,y-r,x,y+r);puff.addColorStop(0,'rgba(255,255,255,.98)');puff.addColorStop(.62,'rgba(255,255,255,.94)');puff.addColorStop(1,'rgba(220,237,236,.88)');
      ctx.fillStyle=puff;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    const texture=new THREE.CanvasTexture(cloudCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.96,depthWrite:false,depthTest:true});
    const layouts=[
      {camera:this.overviewCamera,items:[[-43,34,31,14],[0,39,34,15],[47,33,30,13]],range:72,z:-300},
      {camera:this.playerCamera,items:[[-105,106,58,24],[-37,117,54,22],[40,100,62,25],[112,110,55,22]],range:150,z:-320}
    ];
    this.clouds=[];
    for(const layout of layouts)for(const [index,[x,y,w,h]] of layout.items.entries()){
      const sprite=new THREE.Sprite(material);sprite.position.set(x,y,layout.z);sprite.scale.set(w,h,1);sprite.frustumCulled=false;layout.camera.add(sprite);
      this.clouds.push({sprite,speed:index%2===0?1.05:-.8,baseY:y,phase:index*1.9,range:layout.range});
    }
  }
  mesh(geometry,mat,pos,parent=this.course){const m=new THREE.Mesh(geometry,mat);m.position.set(...pos);m.receiveShadow=true;parent.add(m);return m;}
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.aspect=w/h;this.setFrustum();}
  setFrustum(){const span=Math.max(44,70/this.aspect)/this.zoom;this.overviewCamera.left=-span*this.aspect;this.overviewCamera.right=span*this.aspect;this.overviewCamera.top=span;this.overviewCamera.bottom=-span;this.overviewCamera.updateProjectionMatrix();this.playerCamera.aspect=this.aspect;this.playerCamera.fov=(this.remotePlayers?.size&&this.aspect<.75?70:48)/this.zoom;this.playerCamera.updateProjectionMatrix();}
  setCamera(mode){this.cameraMode=mode;this.camera=mode==='overview'?this.overviewCamera:this.playerCamera;this.zoom=mode==='player'?1.16:1.12;this.setFrustum();this.cameraSnapped=false;}
  setWind(wind){this.wind={...wind};this.windHeading=Math.atan2(-wind.z,wind.x);this.windStrength=THREE.MathUtils.clamp(Math.hypot(wind.x,wind.z)/5.5,0,1);}
  changeZoom(delta){this.zoom=THREE.MathUtils.clamp(this.zoom+delta,.7,1.8);this.setFrustum();}
  disposeGroup(group){while(group.children.length){const obj=group.children[0];obj.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});group.remove(obj);}}
  ellipse(x,z,rx,rz,color,y=.025,parent=this.course){const m=this.mesh(new THREE.CircleGeometry(1,64),material(color),[x,y,z],parent);m.rotation.x=-Math.PI/2;m.scale.set(rx,rz,1);return m;}
  terrainGrid(hole,color){
    const nx=64,nz=102,minX=-32,minZ=-51,positions=[],colors=[],indices=[],baseColor=new THREE.Color(color);
    for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
      const x=minX+ix,z=minZ+iz,height=terrainHeight(x,z,hole),shade=THREE.MathUtils.clamp(1+height*.2,.72,1.25);positions.push(x,height,z);colors.push(baseColor.r*shade,baseColor.g*shade,baseColor.b*shade);
      if(ix<nx&&iz<nz){const a=iz*(nx+1)+ix,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const ground=this.mesh(geometry,grassMaterial(material(0xffffff,{vertexColors:true,flatShading:false})),[0,0,0]);ground.castShadow=true;return ground;
  }
  terrainEllipse(x,z,rx,rz,color,offset,hole){
    const segments=64,rings=8,positions=[x,terrainHeight(x,z,hole)+offset,z],indices=[];
    for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2,r=ring/rings;
      const px=x+Math.cos(angle)*rx*r,pz=z+Math.sin(angle)*rz*r;
      positions.push(px,terrainHeight(px,pz,hole)+offset,pz);
    }
    for(let i=0;i<segments;i++){const current=1+i,next=1+(i+1)%segments;indices.push(0,next,current);}
    for(let ring=0;ring<rings-1;ring++)for(let i=0;i<segments;i++){
      const a=1+ring*segments+i,b=1+ring*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    return this.mesh(geometry,material(color,{flatShading:false}),[0,0,0]);
  }
  build(hole,index,themeId='lagoon'){
    this.disposeGroup(this.course);this.hole=hole;this.theme=themes[themeId]||themes.lagoon;
    this.surfaceEffects.clear();this.surfaceEffectIds.clear();
    const theme=this.theme;
    this.scene.background.set(theme.background);this.scene.fog.color.set(theme.fog);this.scene.fog.near=theme.fogNear;this.scene.fog.far=theme.fogFar;
    this.sky.material.color.set(theme.sky);this.ocean.material.color.set(themeId==='lagoon'?0x078fbb:0x429b91);this.hemisphere.color.set(0xfff7df);this.hemisphere.groundColor.set(theme.ambient);this.sun.color.set(theme.sun);
    this.mesh(islandSkirt(hole),material(theme.side,{side:THREE.DoubleSide}),[0,0,0]);
    this.terrainGrid(hole,theme.ground);
    // A finely sampled fairway mesh follows both the hole's curve and its rolling height profile.
    const rows=200,cols=12,width=10,verts=[],vc=[],indices=[];
    for(let row=0;row<=rows;row++){
      const t=row/rows,z=hole.tee[1]+(hole.pin[1]-hole.tee[1])*t;
      const center=hole.tee[0]*(1-t)+hole.pin[0]*t+Math.sin(t*Math.PI)*hole.bend;
      const color=new THREE.Color(Math.floor((z+55)/7)%2?theme.fairwayA:theme.fairwayB);
      for(let col=0;col<=cols;col++){
        const lateral=-width+2*width*col/cols,x=center+lateral;
        const height=terrainHeight(x,z,hole),shade=THREE.MathUtils.clamp(1+height*.16,.75,1.22);verts.push(x,height+.018,z);vc.push(color.r*shade,color.g*shade,color.b*shade);
        if(row<rows&&col<cols){const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
      }
    }
    const fairway=new THREE.BufferGeometry();fairway.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));fairway.setAttribute('color',new THREE.Float32BufferAttribute(vc,3));fairway.setIndex(indices);fairway.computeVertexNormals();
    const fairwayMesh=this.mesh(fairway,grassMaterial(material(0xffffff,{vertexColors:true,flatShading:false})),[0,0,0]);fairwayMesh.castShadow=true;
    this.terrainEllipse(hole.pin[0],hole.pin[1],9.5,9.5,theme.greenOuter,.027,hole);this.terrainEllipse(hole.pin[0],hole.pin[1],8.6,8.6,theme.green,.038,hole);
    for(const [x,z,rx,rz] of hole.sand){this.terrainEllipse(x,z,rx+.45,rz+.45,theme.sandRim,.045,hole);this.terrainEllipse(x,z,rx,rz,theme.sand,.052,hole);}
    for(const [x,z,rx,rz] of hole.water){this.terrainEllipse(x,z,rx+.45,rz+.45,theme.waterRim,.058,hole);this.terrainEllipse(x,z,rx,rz,theme.water,.064,hole);this.terrainEllipse(x-1,z-.8,rx*.8,rz*.75,theme.waterLight,.069,hole);}
    const rockGeometry=new THREE.DodecahedronGeometry(1,0),rockMaterial=material(themeId==='lagoon'?0x999f91:0xb89170);
    const rocks=courseRocks(hole),rockMesh=new THREE.InstancedMesh(rockGeometry,rockMaterial,rocks.length),transform=new THREE.Object3D();
    rocks.forEach((rock,i)=>{
      transform.position.set(rock.x,(rock.baseY??terrainHeight(rock.x,rock.z,hole))+rock.height/2,rock.z);transform.rotation.set(0,rock.rotation||0,0);
      transform.scale.set(rock.radius,rock.height/2,rock.radius);transform.updateMatrix();rockMesh.setMatrixAt(i,transform.matrix);
    });
    rockMesh.castShadow=true;rockMesh.receiveShadow=true;this.course.add(rockMesh);
    this.terrainEllipse(hole.pin[0],hole.pin[1],.67,.67,0x254a3d,.073,hole);
    this.flag=new THREE.Group();this.flag.position.set(hole.pin[0],terrainHeight(hole.pin[0],hole.pin[1],hole),hole.pin[1]);this.course.add(this.flag);
    this.mesh(new THREE.CylinderGeometry(.07,.07,5.5,8),material(0xfffcde),[0,2.8,0],this.flag);
    this.flagPivot=new THREE.Group();this.flagPivot.position.y=5.55;this.flag.add(this.flagPivot);
    const flagGeometry=new THREE.BufferGeometry(),flagVertices=[],flagIndices=[],flagRows=[],subdivisions=8;
    for(let row=0;row<=subdivisions;row++){
      flagRows[row]=[];
      for(let col=0;col<=subdivisions-row;col++){
        const s=col/subdivisions,t=row/subdivisions;flagRows[row][col]=flagVertices.length/3;
        flagVertices.push(2.1*s,-.95*t-.45*s,0);
      }
    }
    for(let row=0;row<subdivisions;row++)for(let col=0;col<subdivisions-row;col++){
      flagIndices.push(flagRows[row][col],flagRows[row][col+1],flagRows[row+1][col]);
      if(col<subdivisions-row-1)flagIndices.push(flagRows[row][col+1],flagRows[row+1][col+1],flagRows[row+1][col]);
    }
    flagGeometry.setAttribute('position',new THREE.Float32BufferAttribute(flagVertices,3));flagGeometry.setIndex(flagIndices);flagGeometry.computeVertexNormals();
    this.flagCloth=this.mesh(flagGeometry,material(0xe17e74,{side:THREE.DoubleSide}),[0,0,0],this.flagPivot);this.flagClothBase=Float32Array.from(flagVertices);
    this.mesh(new THREE.BoxGeometry(5,.08,3),material(0xcee2a4),[hole.tee[0],terrainHeight(hole.tee[0],hole.tee[1],hole)+.04,hole.tee[1]]);
    for(const offset of [-2.5,2.5]){const x=hole.tee[0]+offset,z=hole.tee[1];this.mesh(new THREE.SphereGeometry(.35,10,8),material(0xf2eee0),[x,terrainHeight(x,z,hole)+.32,z]);}
    let seed=index*137+28;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    if(themeId==='lagoon'){
      addIslandScenery(this,hole,rand);
      for(let i=0;i<26;i++){const x=(i%2?1:-1)*(23+rand()*5);const z=-43+rand()*84;if(Math.hypot(x-hole.pin[0],z-hole.pin[1])<12||surfaceAt(x,z,hole)==='water')continue;this.palm(x,z,.75+rand()*.55,rand()*6);}
      for(let i=0;i<33;i++){const x=(i%2?1:-1)*(21+rand()*10),z=rand()*90-45;if(surfaceAt(x,z,hole)!=='rough')continue;this.mesh(new THREE.DodecahedronGeometry(.5+rand()*.65),material(i%3?0x86ac73:0xe8d5b3),[x,terrainHeight(x,z,hole)+.3,z]);}
      this.makeHouse(-26,-24);
      this.mesh(new THREE.BoxGeometry(6,.35,9),material(0xb99977),[33,-1.8,-24]);for(let i=0;i<9;i++)this.mesh(new THREE.BoxGeometry(6,.09,.65),material(0xcdb18b),[33,-1.57,-28+i]);
      for(const x of [30.4,35.6])for(const z of [-27,-21])this.mesh(new THREE.CylinderGeometry(.18,.2,2.4,6),material(0x927a59),[x,-1.7,z]);
      for(let i=0;i<6;i++){const x=-90+rand()*180,z=100+rand()*70;this.ellipse(x,z,10+rand()*20,8+rand()*14,0x95c2aa,-1.7);for(let j=0;j<3;j++)this.palm(x+rand()*8-4,z+rand()*8-4,.7,0);}
      this.ripples=[];for(let i=0;i<30;i++){const x=rand()*240-120,z=rand()*230-100;if(Math.abs(x)<36&&Math.abs(z)<57)continue;const ripple=this.mesh(new THREE.PlaneGeometry(2+rand()*6,.12),new THREE.MeshBasicMaterial({color:0xe1f4eb,transparent:true,opacity:.3}),[x,-2.72,z]);ripple.rotation.x=-Math.PI/2;this.ripples.push(ripple);}
    }else{
      this.ripples=[];
      for(const side of [-1,1])for(let i=0;i<6;i++)this.mesa(side*(39+rand()*12),-62+i*26+(rand()-.5)*10,10+rand()*14,6+rand()*7,rand()*Math.PI);
      for(const side of [-1,1])for(let i=0;i<4;i++)this.mesa(side*(55+rand()*12),-48+i*34+(rand()-.5)*12,16+rand()*13,11+rand()*10,rand()*Math.PI);
      for(let i=0;i<17;i++){
        const x=(i%2?1:-1)*(24+rand()*5),z=-48+rand()*96;
        if(Math.hypot(x-hole.tee[0],z-hole.tee[1])<10||Math.hypot(x-hole.pin[0],z-hole.pin[1])<12||surfaceAt(x,z,hole)!=='rough')continue;
        this.cactus(x,z,.72+rand()*.7,rand()*6);
      }
      for(let i=0;i<24;i++){const x=(i%2?1:-1)*(30+rand()*10),z=rand()*100-50;this.mesh(new THREE.DodecahedronGeometry(.8+rand()*1.8),material(i%2?0x997154:0xd0aa79),[x,terrainHeight(x,z,hole)-.1+rand()*.5,z]);}
    }
    this.setCamera('overview');this.ready=true;
  }
  palm(x,z,scale,rotation){
    const group=new THREE.Group();group.position.set(x,this.hole?terrainHeight(x,z,this.hole):0,z);group.scale.setScalar(scale);group.rotation.y=rotation;this.course.add(group);
    const trunk=this.mesh(new THREE.CylinderGeometry(.3,.5,7,7),material(this.theme?.trunk??colors.trunk),[.45,3.3,0],group);trunk.rotation.z=-.12;trunk.castShadow=true;
    for(let i=0;i<9;i++){
      const length=4.4+(i%3)*.45,positions=[];
      for(let segment=0;segment<7;segment++){
        const t=segment/7,u=(segment+1)/7;
        const point=(v,side)=>[side*Math.sin(v*Math.PI)*.68,Math.sin(v*Math.PI)*.75-v*v*1.5,-v*length];
        positions.push(...point(t,-1),...point(u,-1),...point(t,1),...point(t,1),...point(u,-1),...point(u,1));
      }
      const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.computeVertexNormals();
      const leaf=this.mesh(geom,material(i%2?0x508d24:0x7fae32,{side:THREE.DoubleSide}),[.9,6.7,0],group);leaf.rotation.y=i*Math.PI*2/9;leaf.castShadow=true;
    }
    for(let ring=0;ring<8;ring++)this.mesh(new THREE.CylinderGeometry(.33,.36,.09,7),material(0x8c6845),[.45+(ring-4)*.045,1+ring*.67,0],group);
    for(let i=0;i<3;i++)this.mesh(new THREE.SphereGeometry(.33,8,6),material(0x99765b),[.65+i*.27,6.35,-.2],group);
  }
  makeHouse(x,z){
    const group=new THREE.Group();group.position.set(x,this.hole?terrainHeight(x,z,this.hole):0,z);group.rotation.y=.13;this.course.add(group);
    this.mesh(new THREE.BoxGeometry(5,3.6,6),material(0xffedc8),[0,1.8,0],group).castShadow=true;
    const roof=this.mesh(new THREE.ConeGeometry(5,2.5,4),material(0xd08269),[0,4.8,0],group);roof.rotation.y=Math.PI/4;roof.scale.z=1.1;roof.castShadow=true;
    this.mesh(new THREE.BoxGeometry(1.2,2.6,.08),material(0x7da398),[0,1.4,-3.06],group);
    for(const side of [-1,1])this.mesh(new THREE.BoxGeometry(1,1,.1),material(0x92beb0),[side*1.6,2,-3.07],group);
    this.mesh(new THREE.BoxGeometry(6,.18,2.5),material(0xcebb92),[0,.1,-3.8],group);
  }
  mesa(x,z,height,width,rotation){
    const group=new THREE.Group();group.position.set(x,-2.78,z);group.rotation.y=rotation;this.course.add(group);
    this.mesh(new THREE.CylinderGeometry(width*.7,width,height*.82,5,1),material(0x986349),[0,height*.41,0],group);
    this.mesh(new THREE.CylinderGeometry(width*.93,width*.7,height*.2,5,1),material(0xb87857),[0,height*.82,0],group);
    this.mesh(new THREE.CylinderGeometry(width*.9,width*.93,.24,5,1),material(0xd09a6d),[0,height*.92,0],group);
  }
  cactus(x,z,scale,rotation){
    const group=new THREE.Group();group.position.set(x,this.hole?terrainHeight(x,z,this.hole):0,z);group.scale.setScalar(scale);group.rotation.y=rotation;this.course.add(group);
    const green=material(0x47734f),rib=material(0x709263);
    this.mesh(new THREE.CylinderGeometry(.34,.42,2.6,7),green,[0,1.3,0],group);
    this.mesh(new THREE.SphereGeometry(.34,7,5),green,[0,2.58,0],group);
    for(const side of [-1,1]){
      const arm=this.mesh(new THREE.CylinderGeometry(.14,.17,.82,6),green,[side*.48,1.35,0],group);arm.rotation.z=Math.PI/2;
      this.mesh(new THREE.CylinderGeometry(.17,.2,1.02,6),green,[side*.82,1.93,0],group);
      this.mesh(new THREE.SphereGeometry(.17,6,5),green,[side*.82,2.43,0],group);
    }
    for(let i=-1;i<=1;i++)this.mesh(new THREE.BoxGeometry(.035,1.45,.035),rib,[i*.17,1.42,.33],group);
  }
  setCharacterAppearance(character,outfit){
    this.scene.remove(this.character);this.disposeGroup(this.character);
    this.character=this.makeCharacter({character,outfit});this.scene.add(this.character);
  }
  clearRemotePlayers(){
    for(const remote of this.remotePlayers.values()){
      this.scene.remove(remote.scene);this.disposeGroup(remote.scene);remote.perfectSparkTexture?.dispose();
    }
    this.remotePlayers.clear();this.remoteLabels=[];
    this.setFrustum();
  }
  setRemotePlayers(players){
    const previousCount=this.remotePlayers.size;
    const ids=new Set(players.map(p=>p.id));
    for(const [id,remote] of this.remotePlayers)if(!ids.has(id)){
      this.scene.remove(remote.scene);this.disposeGroup(remote.scene);remote.perfectSparkTexture?.dispose();this.remotePlayers.delete(id);
    }
    for(const player of players){
      let remote=this.remotePlayers.get(player.id);
      if(!remote){
        remote=Object.create(GolfWorld.prototype);remote.scene=new THREE.Group();this.scene.add(remote.scene);
        remote.character=remote.makeCharacter(player.appearance);remote.scene.add(remote.character);
        remote.ball=remote.mesh(new THREE.SphereGeometry(BALL_RADIUS,16,12),material(player.color),[0,0,0],remote.scene);
        remote.ball.castShadow=true;
        remote.ballHalo=remote.mesh(new THREE.RingGeometry(.7,.85,24),new THREE.MeshBasicMaterial({color:player.color,transparent:true,opacity:.9,side:THREE.DoubleSide}),[0,0,0],remote.scene);remote.ballHalo.rotation.x=-Math.PI/2;
        remote.makeShotEffects();remote.displayBall={...player.ball};this.remotePlayers.set(player.id,remote);
      }
      remote.player=player;remote.hole=this.hole;remote.receivedAt=performance.now();
    }
    if(previousCount!==this.remotePlayers.size)this.setFrustum();
  }
  updateRemotePlayers(dt){
    this.remoteLabels=[];
    for(const [id,remote] of this.remotePlayers){
      const p=remote.player;if(!p.ball)continue;
      const blend=Math.min(1,dt*18);
      for(const axis of ['x','y','z'])remote.displayBall[axis]+=(p.ball[axis]-remote.displayBall[axis])*blend;
      remote.displayBall.status=p.ball.status;
      const motion={...p.motion,elapsed:p.motion.elapsed+(p.motion.phase==='swinging'?Math.min(.1,(performance.now()-remote.receivedAt)/1000):0),putting:p.club==='putter'};
      remote.updateBall(remote.displayBall,p.bearing,p.ball.status==='moving'||p.ball.status==='water',motion);
      remote.scene.visible=!p.withdrawn;
      const point=remote.character.position.clone();point.y+=3.2;point.project(this.camera);
      this.remoteLabels.push({id,x:(point.x*.5+.5)*this.canvas.clientWidth,y:(-point.y*.5+.5)*this.canvas.clientHeight,
        visible:!p.withdrawn&&remote.character.visible&&point.z<1&&Math.abs(point.x)<1&&Math.abs(point.y)<1});
    }
  }
  makeCharacter(appearance={}){
    const {group,...rig}=createGolferRig(appearance);Object.assign(this,rig);
    this.poseCharacter(0,false,false);
    return group;
  }
  connectBone(bone,a,b){
    const direction=b.clone().sub(a);bone.position.copy(a).lerp(b,.5);bone.scale.y=direction.length();bone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  }
  poseCharacter(elapsed,swinging,putting,power=100){
    const pose=swingPose(swinging?elapsed:0,putting,power);
    this.hips.position.set(pose.shift,.9-pose.crouch,0);this.hips.rotation.y=pose.hipTurn;
    this.torso.rotation.set(pose.lean,pose.turn,pose.tilt);this.head.rotation.set(0,-(pose.turn+pose.hipTurn)*.7,-pose.tilt*.4);
    // Keep the swing plane aligned to the aim while the hips/shoulders rotate.
    // Without this compensation, the body turn sends the backswing forward.
    this.clubRig.rotation.set(0,pose.wrist-pose.turn-pose.hipTurn,pose.angle);
    this.feet[0].rotation.set(pose.heel*.3,pose.heel*.25,-pose.heel*.35);this.feet[0].position.y=.16+pose.heel*.12;
    this.clubHead.scale.set(putting?.8:1,putting?.65:1,putting?.6:1);
    for(const [index,leg] of this.legs.entries()){
      const hip=new THREE.Vector3(leg.side*.28,-.14,0).applyEuler(this.hips.rotation).add(this.hips.position);
      const ankle=this.feet[index].position.clone();
      const knee=hip.clone().lerp(ankle,.5);knee.z-=.07+pose.crouch*.65;
      this.connectBone(leg.upper,hip,knee);this.connectBone(leg.lower,knee,ankle);
      leg.knee.position.copy(knee);
    }
    for(const arm of this.arms){
      const shoulder=new THREE.Vector3(arm.side*.48,.83,0);
      const hand=new THREE.Vector3(arm.side*.10,-.45,-.3).applyEuler(this.clubRig.rotation).add(this.clubRig.position);
      const elbow=shoulder.clone().lerp(hand,.5);elbow.x+=arm.side*.12;elbow.z-=.13;
      arm.elbow.position.copy(elbow);
      for(const [bone,a,b] of [[arm.upper,shoulder,elbow],[arm.lower,elbow,hand]]){
        this.connectBone(bone,a,b);
      }
    }
  }
  updateBall(ball,bearing,moving,motion){
    this.ball.visible=ball.status!=='water';
    this.ball.position.set(ball.x,ball.y,ball.z);this.ballHalo.position.set(ball.x,terrainHeight(ball.x,ball.z,this.hole)+.09,ball.z);this.ballHalo.visible=!moving&&ball.status!=='holed';
    const swinging=motion.phase==='swinging',anchor=swinging?motion.origin:ball;
    if(!moving||swinging){const x=anchor.x-Math.cos(bearing)*1.5,z=anchor.z+Math.sin(bearing)*1.5;this.character.position.set(x,Math.max(terrainHeight(x-.4,z,this.hole),terrainHeight(x+.4,z,this.hole),terrainHeight(x,z-.4,this.hole),terrainHeight(x,z+.4,this.hole))+.055,z);this.character.rotation.y=bearing-Math.PI/2;}
    this.character.visible=!moving||swinging;
    this.poseCharacter(motion.elapsed,swinging,motion.putting,motion.power);
    this.updateShotEffects(motion);
  }
  receiveSurfaceEffects(playerId,events=[],initial=false){
    const last=this.surfaceEffectIds.get(playerId)||0;
    const fresh=events.filter(e=>e.id>last);
    if(!initial)for(const event of fresh)this.surfaceEffects.emit(event);
    this.surfaceEffectIds.set(playerId,Math.max(last,...events.map(e=>e.id)));
    return initial?[]:fresh;
  }
  makeShotEffects(){
    this.trailPairs=[];const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24*2*3),3));
    const indices=[];for(let i=0;i<23;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}geometry.setIndex(indices);
    this.clubTrail=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xfff3bf,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));this.clubTrail.frustumCulled=false;this.clubTrail.visible=false;this.scene.add(this.clubTrail);
    this.impactFx=new THREE.Group();this.impactFx.visible=false;this.scene.add(this.impactFx);
    this.impactRing=this.mesh(new THREE.RingGeometry(.28,.38,36),new THREE.MeshBasicMaterial({color:0xffe3a0,transparent:true,side:THREE.DoubleSide,depthWrite:false}),[0,.1,0],this.impactFx);this.impactRing.rotation.x=-Math.PI/2;
    this.dust=[];const dustGeo=new THREE.IcosahedronGeometry(.14,0);
    for(let i=0;i<8;i++)this.dust.push(this.mesh(dustGeo,new THREE.MeshBasicMaterial({color:i%2?0xffe4ad:0xf6f4ce,transparent:true,depthWrite:false}),[0,0,0],this.impactFx));
    this.perfectFx=new THREE.Group();this.perfectFx.visible=false;this.scene.add(this.perfectFx);
    this.perfectRings=[
      this.mesh(new THREE.RingGeometry(.35,.48,48),new THREE.MeshBasicMaterial({color:0xeaffad,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),[0,.16,0],this.perfectFx),
      this.mesh(new THREE.RingGeometry(.72,.8,48),new THREE.MeshBasicMaterial({color:0xffdf83,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),[0,.18,0],this.perfectFx),
    ];
    for(const ring of this.perfectRings)ring.rotation.x=-Math.PI/2;
    const sparkCanvas=document.createElement('canvas');sparkCanvas.width=sparkCanvas.height=64;
    const sparkContext=sparkCanvas.getContext('2d'),glow=sparkContext.createRadialGradient(32,32,1,32,32,31);
    glow.addColorStop(0,'rgba(255,255,230,1)');glow.addColorStop(.12,'rgba(255,247,180,.95)');glow.addColorStop(.34,'rgba(214,255,190,.55)');glow.addColorStop(1,'rgba(168,242,220,0)');
    sparkContext.fillStyle=glow;sparkContext.fillRect(0,0,64,64);sparkContext.strokeStyle='rgba(255,255,225,.85)';sparkContext.lineWidth=2;
    sparkContext.beginPath();sparkContext.moveTo(32,3);sparkContext.lineTo(32,61);sparkContext.moveTo(3,32);sparkContext.lineTo(61,32);sparkContext.stroke();
    this.perfectSparkTexture=new THREE.CanvasTexture(sparkCanvas);this.perfectSparkTexture.colorSpace=THREE.SRGBColorSpace;
    const particleCount=40,particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3);
    const palette=[0xffe06e,0xf8ffce,0x9ce7c0,0xffa67e].map(color=>new THREE.Color(color));
    this.perfectParticleData=Array.from({length:particleCount},(_,i)=>{
      const angle=i*Math.PI*2/particleCount+(i%4)*.045,color=palette[i%palette.length];
      particleColors.set([color.r,color.g,color.b],i*3);
      return {angle,speed:3.7+(i%7)*.58,rise:2.5+(i%5)*.62,size:.55+(i%4)*.24};
    });
    const particleGeometry=new THREE.BufferGeometry();
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
    particleGeometry.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
    this.perfectCloud=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xffffff,size:.82,map:this.perfectSparkTexture,vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
    this.perfectCloud.frustumCulled=false;this.perfectCloud.visible=false;this.scene.add(this.perfectCloud);
    const sparkGeo=new THREE.IcosahedronGeometry(.15,0);this.perfectSparks=[];
    for(let i=0;i<16;i++)this.perfectSparks.push(this.mesh(sparkGeo,new THREE.MeshBasicMaterial({color:i%4===0?0xffe77e:i%4===1?0xf7ffcf:i%4===2?0xa9e8c2:0xffa67e,transparent:true,opacity:0,depthWrite:false}),[0,0,0],this.perfectFx));
    this.perfectShardData=Array.from({length:this.perfectSparks.length},(_,i)=>({angle:i*Math.PI*2/this.perfectSparks.length,speed:3.2+(i%5)*.7,rise:2.3+(i%4)*.45,size:.55+(i%3)*.2}));
  }
  updateShotEffects(motion){
    if(!this.clubTrail)return;
    const active=motion.phase==='swinging'&&!motion.putting,elapsed=motion.elapsed;
    if(!active||elapsed<.69){this.trailPairs.length=0;this.clubTrail.visible=false;}
    else if(elapsed<1.15){
      this.character.updateMatrixWorld(true);
      const tip=this.clubHead.getWorldPosition(new THREE.Vector3());
      const inner=this.clubRig.localToWorld(new THREE.Vector3(0,-1.58,-1.19));
      this.trailPairs.push([tip,inner]);if(this.trailPairs.length>24)this.trailPairs.shift();
      const positions=this.clubTrail.geometry.attributes.position;
      this.trailPairs.forEach((pair,i)=>pair.forEach((p,j)=>positions.setXYZ(i*2+j,p.x,p.y,p.z)));
      positions.needsUpdate=true;this.clubTrail.geometry.setDrawRange(0,Math.max(0,this.trailPairs.length-1)*6);
      this.clubTrail.visible=this.trailPairs.length>1;this.clubTrail.material.opacity=.5;
    }else{this.clubTrail.material.opacity=Math.max(0,.5*(1-(elapsed-1.15)/.25));this.clubTrail.visible=elapsed<1.4;}
    const age=elapsed-IMPACT_TIME;
    this.impactFx.visible=active&&age>=0&&age<.38;
    if(this.impactFx.visible){
      const strength=.5+.5*(motion.power||0)/100;
      const sandy=surfaceAt(motion.origin.x,motion.origin.z,this.hole)==='sand';
      this.impactFx.position.set(motion.origin.x,terrainHeight(motion.origin.x,motion.origin.z,this.hole),motion.origin.z);
      this.impactRing.scale.setScalar(1+age*10*strength);this.impactRing.material.opacity=(1-age/.38)*.7;
      this.dust.forEach((p,i)=>{const a=i*Math.PI/4;p.position.set(Math.cos(a)*age*3*strength,.15+age*(1.5+(i%3)*.4)-3*age*age,Math.sin(a)*age*3*strength);p.scale.set(sandy?1: .5,(sandy?1:1.8)+age*2,sandy?1:.6);p.material.color.set(sandy?(i%2?0xffdc94:0xd8ad63):(i%2?0x9fc857:0x547d30));p.material.opacity=(1-age/.38)*.8;});
    }
    const perfect=active&&motion.perfect&&age>=0&&age<.9;
    this.perfectFx.visible=perfect;
    this.perfectCloud.visible=perfect;
    if(perfect){
      const progress=age/.9,fade=1-progress,strength=.7+.3*(motion.power||0)/100;
      this.perfectFx.position.set(motion.origin.x,terrainHeight(motion.origin.x,motion.origin.z,this.hole),motion.origin.z);
      this.perfectCloud.position.set(motion.origin.x,terrainHeight(motion.origin.x,motion.origin.z,this.hole)+.22,motion.origin.z);
      const positions=this.perfectCloud.geometry.attributes.position;
      this.perfectParticleData.forEach((particle,i)=>{
        const travel=age*particle.speed*strength;
        positions.setXYZ(i,Math.cos(particle.angle)*travel,.22+age*particle.rise*strength-4.1*age*age,Math.sin(particle.angle)*travel);
      });
      positions.needsUpdate=true;this.perfectCloud.material.opacity=fade;
      this.perfectRings.forEach((ring,i)=>{
        const delay=i*.09,phase=Math.max(0,age-delay);
        ring.scale.setScalar((.55+phase*9)*strength);
        ring.rotation.z=(i?-.7:1)*age*2.6;
        ring.material.opacity=Math.max(0,1-phase/.78)*(i?.8:1);
      });
      this.perfectSparks.forEach((spark,i)=>{
        const particle=this.perfectShardData[i],travel=.35+age*particle.speed*strength;
        spark.position.set(Math.cos(particle.angle)*travel,.2+age*particle.rise*strength-4.1*age*age,Math.sin(particle.angle)*travel);
        spark.rotation.set(age*8+i,age*5,age*7+i*.5);
        spark.scale.setScalar(Math.max(.05,(1-progress)*particle.size*strength));spark.material.opacity=fade;
      });
    }
  }
  setGuide(points){this.disposeGroup(this.guide);const visible=points.filter((_,i)=>i%3===0);for(const p of visible){this.mesh(new THREE.SphereGeometry(.16,6,5),new THREE.MeshBasicMaterial({color:0xfffcdf,transparent:true,opacity:.65}),[p.x,p.y+.1,p.z],this.guide);}const last=points.at(-1);if(last){const ring=this.mesh(new THREE.RingGeometry(1.1,1.35,32),new THREE.MeshBasicMaterial({color:0xfffcdf,side:THREE.DoubleSide}),[last.x,terrainHeight(last.x,last.z,this.hole)+.11,last.z],this.guide);ring.rotation.x=-Math.PI/2;}}
  render(dt,ball,bearing,moving,motion={phase:'idle',elapsed:0}){
    this.surfaceEffects.update(dt);
    this.clock+=dt;this.ocean.material.userData.time.value=this.clock;
      this.skyTexture.offset.x=(this.clock*.0003)%1;
      this.clouds.forEach(cloud=>{cloud.sprite.position.x+=cloud.speed*dt;if(cloud.sprite.position.x>cloud.range)cloud.sprite.position.x=-cloud.range;if(cloud.sprite.position.x< -cloud.range)cloud.sprite.position.x=cloud.range;cloud.sprite.position.y=cloud.baseY+Math.sin(this.clock*.16+cloud.phase)*.7;});
    if(this.flagPivot&&this.flagCloth){
      const gust=this.clock*(2.2+this.windStrength*2.4),positions=this.flagCloth.geometry.attributes.position;
      this.flagPivot.rotation.y=this.windHeading+Math.sin(gust)*(.025+this.windStrength*.1);
      for(let i=0;i<positions.count;i++){
        const x=this.flagClothBase[i*3],y=this.flagClothBase[i*3+1],edge=Math.min(1,x/2.1);
        positions.array[i*3+2]=Math.sin(gust-x*2.8+y*1.7)*edge*(.025+this.windStrength*.34);
        positions.array[i*3+1]=y+Math.sin(gust-x*1.8)*edge*.025;
      }
      positions.needsUpdate=true;this.flagCloth.geometry.computeVertexNormals();
    }
    this.ballHalo.scale.setScalar(1+Math.sin(this.clock*3)*.08);
    this.ripples?.forEach((r,i)=>{r.material.opacity=.18+Math.sin(this.clock*.6+i)*.1;});
    const sx=Math.sin(bearing),sz=Math.cos(bearing),sideOffset=Math.max(0,Math.min(4,(this.aspect-.65)*5));
    const lookAhead=7/this.zoom;
    // Hold the golfer in view through follow-through before tracking ball flight.
    let focus=motion.phase==='swinging'?motion.origin:ball;
    if(!moving&&motion.phase!=='swinging'&&this.remotePlayers.size){
      const near=[ball,...[...this.remotePlayers.values()].map(r=>r.player).filter(p=>!p.withdrawn&&p.ball.status!=='moving'&&Math.hypot(p.ball.x-ball.x,p.ball.z-ball.z)<7).map(p=>p.ball)];
      focus={x:near.reduce((sum,p)=>sum+p.x,0)/near.length,y:near.reduce((sum,p)=>sum+p.y,0)/near.length,z:near.reduce((sum,p)=>sum+p.z,0)/near.length};
    }
    const target=this.cameraMode==='overview'?new THREE.Vector3(0,0,0):new THREE.Vector3(focus.x+sx*lookAhead,focus.y+1.1,focus.z+sz*lookAhead);
    const pos=this.cameraMode==='overview'?new THREE.Vector3(110,125,-145):new THREE.Vector3(focus.x-sx*14+sz*sideOffset,focus.y+7,focus.z-sz*14-sx*sideOffset);
    if(this.cameraMode==='player'&&motion.phase==='swinging'&&!motion.putting){
      const age=motion.elapsed-IMPACT_TIME,zoomBeat=Math.sin(Math.min(1,motion.elapsed/1.3)*Math.PI)*.8;
      pos.x+=sx*zoomBeat;pos.z+=sz*zoomBeat;
      if(age>=0&&age<.2)pos.y+=Math.sin(age*75)*.1*(1-age/.2);
    }
    if(!this.cameraSnapped){this.cameraTarget.copy(target);this.cameraPosition.copy(pos);this.cameraSnapped=true;}
    this.cameraTarget.lerp(target,Math.min(1,dt*4));this.cameraPosition.lerp(pos,Math.min(1,dt*4));this.camera.position.copy(this.cameraPosition);this.camera.lookAt(this.cameraTarget);
    this.updateBall(ball,bearing,moving,motion);this.updateRemotePlayers(dt);this.renderer.render(this.scene,this.camera);
    const p=this.ball.position.clone();p.y+=1.2;p.project(this.camera);return {x:(p.x*.5+.5)*this.canvas.clientWidth,y:(-p.y*.5+.5)*this.canvas.clientHeight,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};
  }
}


