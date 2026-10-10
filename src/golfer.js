import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cloth = color => new THREE.MeshStandardMaterial({color,roughness:.9});
const tint = (color,amount) => new THREE.Color(color).multiplyScalar(amount);

// All details are original geometry. Bake static pieces together by material so
// the extra face, fabric and shoe detail stays inexpensive on mobile devices.
function batchDetails(root){
  root.traverse(parent=>{
    if(parent.isMesh)return;
    const batches=new Map();
    for(const child of parent.children)if(child.isMesh&&!child.children.length){
      const parts=batches.get(child.material)||[];parts.push(child);batches.set(child.material,parts);
    }
    for(const [material,parts] of batches){
      if(parts.length<2)continue;
      const geometries=parts.map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
      const geometry=mergeGeometries(geometries,false);
      geometries.forEach(part=>part.dispose());
      if(!geometry)continue;
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
      parts.forEach(part=>{parent.remove(part);part.geometry.dispose();});parent.add(mesh);
    }
  });
}

export function createGolferRig(appearance={}){
  const male=appearance.character==='male',outfit=appearance.outfit||{};
  const shirtColor=outfit.shirt??0xe39b94,capColor=outfit.cap??shirtColor,bottomColor=outfit.bottom??0xfff9e9;
  const mats={
    skin:cloth(0xf1c7a3),ear:cloth(0xdca383),cheek:cloth(0xeab19c),
    shirt:cloth(shirtColor),shirtShade:cloth(tint(shirtColor,.72)),hat:cloth(capColor),hatSeam:cloth(tint(capColor,.72)),
    bottom:cloth(bottomColor),bottomShade:cloth(tint(bottomColor,.78)),
    shoe:cloth(outfit.shoes??0xfff9e9),white:cloth(0xfff9eb),sole:cloth(0xcdd8cd),
    dark:cloth(0x30413c),hair:cloth(male?0x423126:0x664434),hairLight:cloth(male?0x624739:0x8a5c40),
    eye:cloth(0x282f2c),iris:cloth(0x79543b),mouth:cloth(0x955f4d),
    metal:new THREE.MeshStandardMaterial({color:0xc7d5d5,roughness:.3,metalness:.65}),
    gold:new THREE.MeshStandardMaterial({color:0xe5be70,roughness:.45,metalness:.35}),
  };
  const group=new THREE.Group();group.name=male?'golfer-male':'golfer-female';
  const add=(geometry,mat,pos,parent=group)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const oval=(radius,scale,mat,pos,parent)=>{const mesh=add(new THREE.SphereGeometry(radius,16,12),mat,pos,parent);mesh.scale.set(...scale);return mesh;};
  const box=(size,mat,pos,parent)=>add(new THREE.BoxGeometry(...size),mat,pos,parent);
  const curve=(points,radius,mat,parent)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,radius,5,false),mat,[0,0,0],parent);
  const panel=(points,mat,parent)=>{
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const mesh=add(new THREE.ShapeGeometry(shape),mat,[0,0,0],parent);mesh.rotation.y=Math.PI;return mesh;
  };
  const hips=new THREE.Group();hips.name='hips';hips.position.y=.9;group.add(hips);
  const torso=new THREE.Group();torso.name='torso';torso.position.y=.25;hips.add(torso);
  const head=new THREE.Group();head.name='head';head.position.y=1.45;torso.add(head);

  // A softer face with inset ears, layered eyes and a small curved smile.
  oval(.75,[.92,1,.92],mats.skin,[0,0,0],head);
  add(new THREE.CylinderGeometry(.14,.16,.26,12),mats.skin,[0,1.01,0],torso);
  for(const side of [-1,1]){
    oval(.14,[.6,1,.65],mats.skin,[side*.68,-.03,0],head);
    oval(.09,[.3,.7,.6],mats.ear,[side*.735,-.03,-.035],head);
    oval(.11,[1,.8,.2],mats.cheek,[side*.4,-.17,-.552],head);
    oval(.105,[.85,1.1,.32],mats.white,[side*.25,.055,-.644],head);
    oval(.073,[.74,1,.28],mats.iris,[side*.243,.05,-.674],head);
    oval(.049,[.8,1,.3],mats.eye,[side*.24,.05,-.692],head);
    oval(.021,[1,1,.4],mats.white,[side*.24-.016,.077,-.706],head);
    curve([[side*.16,.225,-.635],[side*.25,.254,-.639],[side*.34,.229,-.615]],.018,mats.hair,head);
    if(!male)curve([[side*.17,.129,-.664],[side*.25,.161,-.667],[side*.34,.136,-.641],[side*.38,.171,-.616]],.014,mats.eye,head);
  }
  oval(.075,[.72,.85,.85],mats.skin,[0,-.12,-.691],head);
  curve([[-.12,-.293,-.629],[0,-.328,-.629],[.12,-.293,-.629]],.012,mats.mouth,head);

  // Hair sits under the headwear, rather than forming a second oversized head.
  add(new THREE.SphereGeometry(.713,20,12,0,Math.PI*2,0,Math.PI*.56),mats.hair,[0,.1,.028],head);
  for(const side of [-1,1]){
    oval(.13,[.48,1.55,.62],mats.hair,[side*.62,.08,.02],head);
    if(!male){
      const lock=oval(.15,[.62,1.9,.58],mats.hair,[side*.57,-.12,-.12],head);lock.rotation.z=side*.13;
      curve([[side*.57,.1,-.2],[side*.6,-.15,-.2],[side*.59,-.33,-.15]],.015,mats.hairLight,head);
    }
  }
  if(male){
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const lock=oval(.1,[.48,1,.7],mats.hairLight,[side*(.6-i*.016),.01+i*.09,.3],head);lock.rotation.z=side*.23;
    }
  }else{
    const ponytail=new THREE.Group();ponytail.name='ponytail';ponytail.position.set(0,.05,.63);head.add(ponytail);
    oval(.22,[1,.88,.8],mats.hair,[0,-.05,.03],ponytail);
    const tail=oval(.23,[.85,2,1],mats.hair,[0,-.36,.17],ponytail);tail.rotation.x=-.3;
    oval(.15,[.8,1.1,1],mats.hair,[0,-.69,.28],ponytail);
    add(new THREE.TorusGeometry(.16,.035,6,16),mats.hat,[0,-.1,.08],ponytail).rotation.x=Math.PI/2;
    for(const side of [-1,1])curve([[side*.09,-.14,.25],[side*.12,-.39,.37],[side*.06,-.63,.4]],.015,mats.hairLight,ponytail);
  }

  if(male){
    add(new THREE.SphereGeometry(.75,24,12,0,Math.PI*2,0,Math.PI*.48),mats.hat,[0,.14,0],head);
    add(new THREE.CylinderGeometry(.745,.76,.11,24),mats.hat,[0,.16,0],head);
    oval(1,[.59,.048,.36],mats.hat,[0,.16,-.56],head);
    oval(1,[.57,.017,.35],mats.hatSeam,[0,.126,-.56],head);
    for(let i=0;i<6;i++){
      const phi=i*Math.PI/3,points=[];
      for(let j=0;j<=8;j++){const theta=.08+j/8*1.4;points.push([Math.sin(phi)*Math.sin(theta)*.756,.14+Math.cos(theta)*.756,Math.cos(phi)*Math.sin(theta)*.756]);}
      curve(points,.008,mats.hatSeam,head);
    }
    oval(.054,[1,.55,1],mats.hat,[0,.895,0],head);
    box([.3,.065,.035],mats.hatSeam,[0,.17,.751],head);
    for(const x of [-.09,0,.09])box([.025,.025,.01],mats.dark,[x,.17,.776],head);
  }else{
    // Golf visor exposes the hair and ponytail; its contrasting rim is visible
    // from the side, which is the main play-camera angle.
    add(new THREE.CylinderGeometry(.726,.741,.17,24,1,true),mats.hat,[0,.35,0],head);
    add(new THREE.CylinderGeometry(.742,.748,.035,24,1,true),mats.white,[0,.26,0],head);
    oval(1,[.74,.055,.39],mats.hat,[0,.26,-.55],head);
    oval(1,[.72,.014,.38],mats.hatSeam,[0,.216,-.55],head);
  }
  // Original diamond badge on the cap and a matching small chest crest.
  const badge=box([.13,.13,.022],mats.white,[0,male?.4:.35,male?-.719:-.737],head);badge.rotation.z=Math.PI/4;
  const badgeCore=box([.058,.058,.024],mats.gold,[0,male?.4:.35,male?-.733:-.752],head);badgeCore.rotation.z=Math.PI/4;

  // Fitted golf polo, collar tips, placket, buttons and hem piping.
  add(new THREE.CylinderGeometry(male?.43:.4,male?.47:.48,1.1,16),mats.shirt,[0,.35,0],torso);
  add(new THREE.CylinderGeometry(.205,.3,.13,16),mats.white,[0,.905,0],torso);
  for(const side of [-1,1]){
    const collar=panel([[side*.035,.87],[side*.26,.88],[side*.16,.63]],mats.white,torso);collar.position.z=-.447;
  }
  box([.066,.27,.03],mats.shirtShade,[0,.66,-.45],torso);
  for(const y of [.73,.62,.51])oval(.018,[1,1,.45],mats.white,[0,y,-.474],torso);
  add(new THREE.CylinderGeometry(.474,.482,.045,16),mats.shirtShade,[0,-.18,0],torso);
  const crest=box([.10,.12,.018],mats.white,[-.22,.6,-.373],torso);crest.rotation.z=-.12;
  box([.055,.034,.02],mats.gold,[-.22,.6,-.386],torso);
  // Back yoke and a short seam add structure in the follow-through view.
  curve([[-.31,.73,.28],[0,.73,.424],[.31,.73,.28]],.013,mats.shirtShade,torso);

  if(male){
    add(new THREE.CylinderGeometry(.47,.45,.34,16),mats.bottom,[0,-.12,0],hips);
    add(new THREE.CylinderGeometry(.478,.476,.065,16),mats.dark,[0,.025,0],hips);
    box([.12,.075,.04],mats.gold,[0,.025,-.475],hips);
    for(const side of [-1,1]){
      curve([[side*.22,0,-.419],[side*.32,-.1,-.326],[side*.34,-.22,-.297]],.01,mats.bottomShade,hips);
      box([.14,.14,.015],mats.bottomShade,[side*.22,-.13,.411],hips);
      box([.035,.09,.025],mats.bottom,[side*.24,.025,-.408],hips);
    }
  }else{
    // Alternate pleat faces give the skirt readable folds even at play distance.
    const geometry=new THREE.CylinderGeometry(.45,.61,.43,24,1,true),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++)if(positions.getY(i)<0){const angle=Math.atan2(positions.getZ(i),positions.getX(i)),factor=1+Math.cos(angle*12)*.055;positions.setX(i,positions.getX(i)*factor);positions.setZ(i,positions.getZ(i)*factor);}
    geometry.computeVertexNormals();add(geometry,mats.bottom,[0,-.135,0],hips);
    add(new THREE.CylinderGeometry(.48,.475,.055,24),mats.shirtShade,[0,.055,0],hips);
    for(let i=0;i<12;i++){
      const angle=i/12*Math.PI*2;
      curve([[Math.sin(angle)*.45,.055,Math.cos(angle)*.45],[Math.sin(angle)*.53,-.155,Math.cos(angle)*.53],[Math.sin(angle)*.644,-.345,Math.cos(angle)*.644]],.009,mats.bottomShade,hips);
    }
    box([.085,.05,.025],mats.gold,[0,.055,-.478],hips);
  }

  const arms=[],feet=[],legs=[];
  for(const side of [-1,1]){
    const upper=new THREE.Group(),lower=new THREE.Group();group.add(upper,lower);
    add(new THREE.CylinderGeometry(.15,.135,1,10),male?mats.bottom:mats.skin,[0,0,0],upper);
    add(new THREE.CylinderGeometry(.135,.12,1,10),male?mats.bottom:mats.skin,[0,0,0],lower);
    if(male){
      box([.018,.84,.019],mats.bottomShade,[side*.11,0,-.07],upper);
      add(new THREE.CylinderGeometry(.14,.145,.12,10),mats.bottomShade,[0,-.39,0],lower);
    }else{
      add(new THREE.CylinderGeometry(.127,.129,.37,10),mats.white,[0,-.3,0],lower);
      add(new THREE.CylinderGeometry(.13,.13,.045,10),mats.shirt,[0,-.14,0],lower);
    }
    const knee=new THREE.Group();knee.name=`knee-${side}`;group.add(knee);
    oval(.13,[1,1,1],male?mats.bottom:mats.skin,[0,0,0],knee);
    legs.push({side,upper,lower,knee});
    const foot=new THREE.Group();foot.position.set(side*.36,.16,-.1);group.add(foot);feet.push(foot);
    oval(1,[.205,.13,.325],mats.shoe,[0,.025,-.045],foot);
    oval(1,[.21,.045,.34],mats.sole,[0,-.09,-.045],foot);
    box([.23,.035,.13],mats.dark,[0,-.12,.16],foot);
    oval(1,[.145,.05,.16],mats.white,[0,.105,-.10],foot);
    box([.19,.12,.045],mats.shirt,[0,.015,.236],foot);
    for(let i=0;i<3;i++){const lace=box([.18,.017,.023],mats.sole,[0,.149-i*.01,-.1-i*.045],foot);lace.rotation.y=i%2?.13:-.13;}
    for(const edge of [-1,1])curve([[edge*.18,.055,.13],[edge*.194,.025,-.02],[edge*.16,.005,-.18]],.013,mats.shirt,foot);

    const upperArm=new THREE.Group(),forearm=new THREE.Group();torso.add(upperArm,forearm);
    add(new THREE.CylinderGeometry(.125,.12,1,10),mats.skin,[0,0,0],upperArm);
    add(new THREE.CylinderGeometry(.165,.145,.53,12),mats.shirt,[0,.24,0],upperArm);
    add(new THREE.CylinderGeometry(.15,.15,.065,12),mats.white,[0,-.01,0],upperArm);
    add(new THREE.CylinderGeometry(.11,.12,1,10),mats.skin,[0,0,0],forearm);
    const elbow=new THREE.Group();elbow.name=`elbow-${side}`;torso.add(elbow);
    oval(.12,[1,1,1],mats.skin,[0,0,0],elbow);
    arms.push({side,upper:upperArm,lower:forearm,elbow});
  }

  const clubRig=new THREE.Group();clubRig.name='club';clubRig.position.set(0,.9,-.12);torso.add(clubRig);
  for(const side of [-1,1]){
    oval(.14,[.83,1,.87],mats.white,[side*.10,-.45,-.3],clubRig);
    oval(.055,[.8,1.4,.8],mats.white,[side*.19,-.46,-.32],clubRig);
    box([.09,.045,.025],mats.shirt,[side*.10,-.415,-.426],clubRig);
    for(let i=0;i<3;i++)box([.007,.06,.012],mats.sole,[side*.10-.029+i*.024,-.485,-.423],clubRig);
  }
  const shaft=add(new THREE.CylinderGeometry(.035,.035,1.745,10),mats.metal,[0,-1.135,-.84],clubRig);shaft.rotation.x=Math.atan2(1.08,1.37);
  const grip=add(new THREE.CylinderGeometry(.055,.055,.35,10),mats.dark,[0,-.59,-.41],clubRig);grip.rotation.x=shaft.rotation.x;
  const clubHead=new THREE.Group();clubHead.position.set(0,-1.82,-1.38);clubRig.add(clubHead);
  box([.42,.2,.3],mats.dark,[0,0,0],clubHead);
  box([.035,.155,.255],mats.metal,[.215,0,0],clubHead);
  box([.29,.02,.17],mats.metal,[0,.104,0],clubHead);
  batchDetails(group);
  return {group,hips,torso,head,arms,feet,legs,clubRig,clubHead};
}
