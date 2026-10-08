export const CLUBS = {
  driver: { name: 'Driver', label: '1W', speed: 27, loft: 34, range: 210 },
  iron: { name: 'Iron', label: '7I', speed: 20, loft: 48, range: 130 },
  wedge: { name: 'Wedge', label: 'SW', speed: 13, loft: 58, range: 60 },
  putter: { name: 'Putter', label: 'PT', speed: 10, loft: 0, range: 45 },
};
export function randomWind(random=Math.random) {
  const speed=.5+random()*5;
  const direction=random()*Math.PI*2;
  return {x:Math.sin(direction)*speed,z:Math.cos(direction)*speed};
}
export const HOLES = [
  { name: 'Palm Opening', par: 4, tee: [-9,-38], pin: [8,37], bend: -6, sand: [[14,25,6,4],[-9,38,5,3]], water: [] },
  { name: 'Lagoon Crossing', par: 4, tee: [8,-37], pin: [-7,37], bend: 8, sand: [[-16,30,5,5]], water: [[0,0,23,8]] },
  { name: 'The Short & Sweet', par: 3, tee: [-8,-24], pin: [6,22], bend: -2, sand: [[-3,20,5,4],[15,16,4,5]], water: [] },
  { name: 'Coconut Curve', par: 5, tee: [-12,-43], pin: [12,43], bend: 13, sand: [[12,13,6,4],[-5,40,5,5]], water: [[-19,4,6,15]] },
  { name: 'Island Green', par: 3, tee: [0,-29], pin: [0,29], bend: 0, sand: [[10,25,4,3]], water: [[0,9,29,8]] },
  { name: 'Sandy Sunday', par: 4, tee: [10,-37], pin: [-10,37], bend: -9, sand: [[-7,0,6,7],[3,28,8,4]], water: [] },
  { name: 'Trade Winds', par: 5, tee: [-12,-43], pin: [8,43], bend: 9, sand: [[12,15,5,7]], water: [[-17,28,7,15]] },
  { name: 'Pink Horizon', par: 4, tee: [9,-38], pin: [-8,36], bend: 4, sand: [[-15,23,4,7],[3,38,6,4]], water: [] },
  { name: 'Homeward Bound', par: 4, tee: [-9,-38], pin: [9,40], bend: -5, sand: [[-2,32,5,5]], water: [[18,-5,8,13]] },
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
export function launch(position, club, power, bearing) {
  const c=CLUBS[club], speed=c.speed*power/100, angle=c.loft*Math.PI/180;
  return { x:position.x, y:.23, z:position.z, vx:Math.sin(bearing)*speed*Math.cos(angle), vz:Math.cos(bearing)*speed*Math.cos(angle), vy:speed*Math.sin(angle), status:'moving', bounces:0 };
}
export function stepBall(b,dt,hole,wind={x:0,z:0}) {
  if(b.status!=='moving') return b;
  const oldX=b.x, oldZ=b.z;
  const airborne=b.y>.231 || b.vy>0;
  if(airborne) { b.vy-=9.81*dt; b.vx+=wind.x*.09*dt; b.vz+=wind.z*.09*dt; }
  else {
    const surface=surfaceAt(b.x,b.z,hole);
    const friction={green:2.5,fairway:3.6,rough:7,sand:13,water:4}[surface];
    const speed=Math.hypot(b.vx,b.vz), next=Math.max(0,speed-friction*dt);
    if(speed>0) { b.vx*=next/speed; b.vz*=next/speed; }
  }
  b.x+=b.vx*dt; b.z+=b.vz*dt; b.y+=b.vy*dt;
  if(b.y<=.23) {
    b.y=.23;
    const surface=surfaceAt(b.x,b.z,hole);
    if(surface==='water') { b.status='water'; return b; }
    if(b.vy < -2 && b.bounces<2 && surface!=='sand') { b.vy=-b.vy*.23; b.vx*=.72;b.vz*=.72;b.bounces++; }
    else { b.vy=0; }
  }
  const dx=b.x-oldX,dz=b.z-oldZ,l=dx*dx+dz*dz;
  const t=l ? Math.max(0,Math.min(1,((hole.pin[0]-oldX)*dx+(hole.pin[1]-oldZ)*dz)/l)) : 0;
  if(b.y<.5 && Math.hypot(b.vx,b.vz)<8 && Math.hypot(oldX+dx*t-hole.pin[0],oldZ+dz*t-hole.pin[1])<.7) {
    b.x=hole.pin[0];b.z=hole.pin[1];b.y=.05;b.status='holed';
  } else if(b.y<=.23 && b.vy===0 && Math.hypot(b.vx,b.vz)<.08) { b.vx=0;b.vz=0;b.status='stopped'; }
  return b;
}
export function predict(position,club,power,bearing,hole,wind) {
  const b=launch(position,club,power,bearing), points=[];
  for(let i=0;i<2400 && b.status==='moving';i++){stepBall(b,1/120,hole,wind);if(i%12===0)points.push({x:b.x,y:b.y,z:b.z});}
  return { ball:b,points };
}
