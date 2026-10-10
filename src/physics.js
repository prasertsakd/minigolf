export const CLUBS = {
  driver: { name: 'Driver', label: '1W', speed: 27, loft: 34, range: 210 },
  iron: { name: 'Iron', label: '7I', speed: 20, loft: 48, range: 130 },
  wedge: { name: 'Wedge', label: 'SW', speed: 13, loft: 58, range: 60 },
  putter: { name: 'Putter', label: 'PT', speed: 10, loft: 0, range: 45 },
};
export const BALL_RADIUS = .23;
export function randomWind(random=Math.random) {
  const speed=.5+random()*5;
  const direction=random()*Math.PI*2;
  return {x:Math.sin(direction)*speed,z:Math.cos(direction)*speed};
}
export const HOLES = [
  { name: 'Palm Opening', par: 4, tee: [-9,-38], pin: [8,37], bend: -6, sand: [[14,25,6,4],[-9,38,5,3]], water: [], terrain: { grade: -.8, crossfall: .012, ridge: 1.2, ridgeAt: .48, ridgeWidth: 8, wave: .16, phase: 0 } },
  { name: 'Lagoon Crossing', par: 4, tee: [8,-37], pin: [-7,37], bend: 8, sand: [[-16,30,5,5]], water: [[0,0,23,8]], terrain: { grade: .6, crossfall: -.014, ridge: -.85, ridgeAt: .55, ridgeWidth: 9, wave: .2, phase: 1 } },
  { name: 'The Short & Sweet', par: 3, tee: [-8,-24], pin: [6,22], bend: -2, sand: [[-3,20,5,4],[15,16,4,5]], water: [], terrain: { grade: .35, crossfall: .01, ridge: .8, ridgeAt: .62, ridgeWidth: 6, wave: .12, phase: 2 } },
  { name: 'Coconut Curve', par: 5, tee: [-12,-43], pin: [12,43], bend: 13, sand: [[12,13,6,4],[-5,40,5,5]], water: [[-19,4,6,15]], terrain: { grade: -1, crossfall: .018, ridge: 1.5, ridgeAt: .43, ridgeWidth: 10, wave: .24, phase: 3 } },
  { name: 'Island Green', par: 3, tee: [0,-29], pin: [0,29], bend: 0, sand: [[10,25,4,3]], water: [[0,9,29,8]], terrain: { grade: .9, crossfall: -.01, ridge: -.9, ridgeAt: .53, ridgeWidth: 7, wave: .18, phase: 4 } },
  { name: 'Sandy Sunday', par: 4, tee: [10,-37], pin: [-10,37], bend: -9, sand: [[-7,0,6,7],[3,28,8,4]], water: [], terrain: { grade: -.45, crossfall: -.018, ridge: 1, ridgeAt: .38, ridgeWidth: 8, wave: .22, phase: 5 } },
  { name: 'Trade Winds', par: 5, tee: [-12,-43], pin: [8,43], bend: 9, sand: [[12,15,5,7]], water: [[-17,28,7,15]], terrain: { grade: .75, crossfall: .014, ridge: -.95, ridgeAt: .52, ridgeWidth: 9, wave: .2, phase: 6 } },
  { name: 'Pink Horizon', par: 4, tee: [9,-38], pin: [-8,36], bend: 4, sand: [[-15,23,4,7],[3,38,6,4]], water: [], terrain: { grade: -.3, crossfall: .016, ridge: .8, ridgeAt: .58, ridgeWidth: 7, wave: .14, phase: 7 } },
  { name: 'Homeward Bound', par: 4, tee: [-9,-38], pin: [9,40], bend: -5, sand: [[-2,32,5,5]], water: [[18,-5,8,13]], terrain: { grade: .5, crossfall: -.012, ridge: 1.2, ridgeAt: .45, ridgeWidth: 8, wave: .18, phase: 8 } },
];
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function surfaceAt(x,z,hole) {
  if (Math.abs(x)>31 || Math.abs(z)>51) return 'water';
  if (hole.water.some(([cx,cz,rx,rz]) => ((x-cx)/rx)**2+((z-cz)/rz)**2 < 1)) return 'water';
  if (hole.sand.some(([cx,cz,rx,rz]) => ((x-cx)/rx)**2+((z-cz)/rz)**2 < 1)) return 'sand';
  if (Math.hypot(x-hole.pin[0],z-hole.pin[1]) < 9) return 'green';
  const t=Math.max(0,Math.min(1,(z-hole.tee[1])/(hole.pin[1]-hole.tee[1])));
  const center=hole.tee[0]*(1-t)+hole.pin[0]*t+Math.sin(t*Math.PI)*hole.bend;
  return Math.abs(x-center)<10 ? 'fairway' : 'rough';
}
const rockCache = new WeakMap();
export function createCourseRocks(hole, random) {
  if (!random) {
    let seed = 2166136261;
    for (const c of `${hole.name}:${hole.tee}:${hole.pin}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  const rocks = [],targetCount=hole.rockCount??19;
  for (let attempt = 0; attempt < 160 && rocks.length < targetCount; attempt++) {
    const t = .15 + random() * .66, z = hole.tee[1] + (hole.pin[1] - hole.tee[1]) * t;
    const center = hole.tee[0] * (1-t) + hole.pin[0] * t + Math.sin(t*Math.PI) * hole.bend;
    const x = center + (random() - .5) * 19;
    if (!['fairway','rough'].includes(surfaceAt(x,z,hole)) || Math.hypot(x-hole.tee[0],z-hole.tee[1]) < 9 ||
      Math.hypot(x-hole.pin[0],z-hole.pin[1]) < 12 || rocks.some(r => Math.hypot(x-r.x,z-r.z) < 2.5)) continue;
    const size=random(),scale=size<.65?.2:size<.9?.4:.6;
    // Reuse the original size draw so the seeded positions stay unchanged.
    // Most are tiny pebbles (80% smaller), with a few medium and larger stones.
    rocks.push(Object.freeze({x,z,baseY:terrainHeight(x,z,hole),radius:(.4+size*.3)*scale,height:(.38+random()*.3)*scale,rotation:random()*Math.PI*2}));
  }
  return Object.freeze(rocks);
}
export function courseRocks(hole) {
  if (hole.rocks) return hole.rocks; // Explicit obstacle layouts are also supported.
  if (!rockCache.has(hole)) rockCache.set(hole, createCourseRocks(hole));
  return rockCache.get(hole);
}
function recordImpact(ball, kind, hole, strength, y = terrainHeight(ball.x,ball.z,hole)+.07) {
  ball.impactSerial = (ball.impactSerial || 0) + 1;
  ball.impacts = [...(ball.impacts || []), {id:ball.impactSerial,kind,x:ball.x,y,z:ball.z,strength}].slice(-8);
}
function collideRocks(ball, from, hole) {
  const dx=ball.x-from.x,dy=ball.y-from.y,dz=ball.z-from.z;
  let contact=null;
  for (const rock of courseRocks(hole)) {
    const rx=rock.radius+BALL_RADIUS,ry=rock.height/2+BALL_RADIUS;
    if(Math.min(from.x,ball.x)>rock.x+rx||Math.max(from.x,ball.x)<rock.x-rx||
      Math.min(from.z,ball.z)>rock.z+rx||Math.max(from.z,ball.z)<rock.z-rx)continue;
    const cy=(rock.baseY??terrainHeight(rock.x,rock.z,hole))+rock.height/2;
    const ox=(from.x-rock.x)/rx,oy=(from.y-cy)/ry,oz=(from.z-rock.z)/rx;
    const sx=dx/rx,sy=dy/ry,sz=dz/rx;
    const a=sx*sx+sy*sy+sz*sz,c=ox*ox+oy*oy+oz*oz-1,b=2*(ox*sx+oy*sy+oz*sz);
    let t;
    if(c<0)t=0;
    else { const d=b*b-4*a*c;if(a<1e-12||d<0)continue;t=(-b-Math.sqrt(d))/(2*a);if(t<0||t>1)continue; }
    if(contact&&t>=contact.t)continue;
    const x=from.x+dx*t,y=from.y+dy*t,z=from.z+dz*t;
    let nx=(x-rock.x)/(rx*rx),ny=Math.max(0,(y-cy)/(ry*ry)),nz=(z-rock.z)/(rx*rx);
    const length=Math.hypot(nx,ny,nz);
    if(length<1e-9)continue;nx/=length;ny/=length;nz/=length;
    const incoming=ball.vx*nx+ball.vy*ny+ball.vz*nz;
    if(incoming>=0)continue;
    contact={t,x,y,z,nx,ny,nz,incoming,rock,cy,rx,ry};
  }
  if(!contact)return;
  const {x,y,z,nx,ny,nz,incoming,rock,cy,rx,ry}=contact;
  const speed=Math.hypot(ball.vx,ball.vy,ball.vz);
  // Reflect against the visible rounded rock, with a small hop for ground contact.
  ball.vx=(ball.vx-1.65*incoming*nx)*.9;
  ball.vy=(ball.vy-1.65*incoming*ny)*.9;
  ball.vz=(ball.vz-1.65*incoming*nz)*.9;
  ball.vy=Math.max(ball.vy,Math.min(1.8,speed*.18));
  const extent=1/Math.sqrt(nx*nx/(rx*rx)+ny*ny/(ry*ry)+nz*nz/(rx*rx));
  ball.x=rock.x+nx*(extent+.015);ball.z=rock.z+nz*(extent+.015);
  ball.y=Math.max(cy+ny*(extent+.015),terrainHeight(ball.x,ball.z,hole)+BALL_RADIUS);
  recordImpact(ball,'rock',hole,speed,Math.max(y-BALL_RADIUS,terrainHeight(x,z,hole)+.12));
}
export function terrainHeight(x,z,hole) {
  if(!hole?.terrain)return 0;
  const [tx,tz]=hole.tee,[px,pz]=hole.pin,span=pz-tz;
  const t=Math.max(-.15,Math.min(1.15,(z-tz)/span));
  const center=tx*(1-t)+px*t+Math.sin(t*Math.PI)*hole.bend;
  const lateral=x-center,terrain=hole.terrain;
  const along=(t-terrain.ridgeAt)*Math.abs(span),across=lateral/8;
  const ridge=terrain.ridge*Math.exp(-.5*(along/terrain.ridgeWidth)**2)*(.62+.38*Math.exp(-.5*across*across));
  const teeRidge=terrain.ridge*Math.exp(-.5*((terrain.ridgeAt*Math.abs(span))/terrain.ridgeWidth)**2);
  const wave=terrain.wave*Math.sin(t*Math.PI*2+terrain.phase)*Math.sin(t*Math.PI);
  return terrain.grade*t+terrain.crossfall*1.2*lateral+(ridge-teeRidge)*1.3+wave*1.2;
}
export function terrainSlope(x,z,hole) {
  const sample=.25;
  return { x:(terrainHeight(x+sample,z,hole)-terrainHeight(x-sample,z,hole))/(2*sample), z:(terrainHeight(x,z+sample,hole)-terrainHeight(x,z-sample,hole))/(2*sample) };
}
export function launch(position, club, power, bearing, hole) {
  const c=CLUBS[club], speed=c.speed*power/100, angle=c.loft*Math.PI/180;
  return { x:position.x, y:terrainHeight(position.x,position.z,hole)+BALL_RADIUS, z:position.z, vx:Math.sin(bearing)*speed*Math.cos(angle), vz:Math.cos(bearing)*speed*Math.cos(angle), vy:speed*Math.sin(angle), status:'moving', bounces:0, impactSerial:0, impacts:[] };
}
export function stepBall(b,dt,hole,wind={x:0,z:0}) {
  if(b.status!=='moving') return b;
  const oldX=b.x, oldZ=b.z,oldY=b.y,oldSurface=surfaceAt(b.x,b.z,hole);
  const groundY=terrainHeight(b.x,b.z,hole)+BALL_RADIUS;
  const airborne=b.y>groundY+.001 || b.vy>0;
  if(airborne) { b.vy-=9.81*dt; b.vx+=wind.x*.09*dt; b.vz+=wind.z*.09*dt; }
  else {
    const surface=surfaceAt(b.x,b.z,hole);
    const friction={green:2.5,fairway:3.6,rough:7,sand:13,water:4}[surface];
    const slope=terrainSlope(b.x,b.z,hole);
    b.vx-=9.81*slope.x*dt;b.vz-=9.81*slope.z*dt;
    const speed=Math.hypot(b.vx,b.vz),next=Math.max(0,speed-friction*dt);
    if(speed>0) { b.vx*=next/speed;b.vz*=next/speed; }
  }
  b.x+=b.vx*dt; b.z+=b.vz*dt; b.y+=b.vy*dt;
  const nextGroundY=terrainHeight(b.x,b.z,hole)+BALL_RADIUS;
  let grounded=!airborne;
  if(!airborne){b.y=nextGroundY;b.vy=0;}
  else if(b.y<=nextGroundY) {
    b.y=nextGroundY;grounded=true;
    const surface=surfaceAt(b.x,b.z,hole);
    const strength=Math.hypot(b.vx,b.vy,b.vz);
    if(surface==='water') { recordImpact(b,'water',hole,strength);b.status='water'; return b; }
    if(b.vy<-.6)recordImpact(b,surface==='sand'?'sand':'grass',hole,strength);
    if(b.vy < -2 && b.bounces<2 && surface!=='sand') { b.vy=-b.vy*.23; b.vx*=.72;b.vz*=.72;b.bounces++; }
    else { b.vy=0; }
  }
  const nextSurface=surfaceAt(b.x,b.z,hole);
  if(grounded&&nextSurface==='water'){recordImpact(b,'water',hole,Math.hypot(b.vx,b.vz));b.status='water';return b;}
  if(!airborne&&nextSurface==='sand'&&oldSurface!=='sand')recordImpact(b,'sand',hole,Math.hypot(b.vx,b.vz));
  collideRocks(b,{x:oldX,y:oldY,z:oldZ},hole);
  grounded=b.y<=terrainHeight(b.x,b.z,hole)+BALL_RADIUS+.001&&b.vy===0;
  const dx=b.x-oldX,dz=b.z-oldZ,l=dx*dx+dz*dz;
  const t=l ? Math.max(0,Math.min(1,((hole.pin[0]-oldX)*dx+(hole.pin[1]-oldZ)*dz)/l)) : 0;
  if(grounded && Math.hypot(b.vx,b.vz)<8 && Math.hypot(oldX+dx*t-hole.pin[0],oldZ+dz*t-hole.pin[1])<.7) {
    b.x=hole.pin[0];b.z=hole.pin[1];b.y=terrainHeight(b.x,b.z,hole)+.05;b.status='holed';
  } else if(grounded && b.vy===0 && Math.hypot(b.vx,b.vz)<.08) { b.vx=0;b.vz=0;b.status='stopped'; }
  return b;
}
export function predict(position,club,power,bearing,hole,wind) {
  const b=launch(position,club,power,bearing,hole), points=[];
  for(let i=0;i<2400 && b.status==='moving';i++){stepBall(b,1/120,hole,wind);if(i%12===0)points.push({x:b.x,y:b.y,z:b.z});}
  return { ball:b,points };
}
