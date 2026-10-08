export const IMPACT_TIME = .88;
export const SWING_DURATION = 2.05;
const CHARGE_TRAVEL = 1.25;
export const ACCURACY_TARGET=15;
const ACCURACY_SPEED=60;

// Start, lock power, then catch the returning cursor at the accuracy line.
export class ShotControl {
  constructor() { this.reset(); }
  reset() { this.phase='idle'; this.elapsed=0; this.power=0; this.cursor=0; this.error=0; this.rating=''; this.impacted=false; }
  press() {
    if(this.phase==='idle') { this.phase='charging'; this.elapsed=0; this.power=0; return 'charge'; }
    if(this.phase==='charging') { this.phase='accuracy'; this.elapsed=0; this.power=Math.round(this.power); this.cursor=Math.max(30,this.power); return 'accuracy'; }
    if(this.phase==='accuracy') { this.lockAccuracy(); return 'swing'; }
    return null;
  }
  lockAccuracy() {
    this.error=this.cursor-ACCURACY_TARGET;
    const miss=Math.abs(this.error);
    this.rating=miss<=2?'Perfect!':miss<=5?'Nice!':miss<=10?'Good':this.error<0?'ช้าไป · ลูกเบนขวา':'เร็วไป · ลูกเบนซ้าย';
    this.phase='swinging'; this.elapsed=0;
  }
  tick(dt) {
    let impact=false, complete=false, autoSwing=false;
    if(this.phase==='charging') {
      this.elapsed+=dt;
      const travel=(this.elapsed/CHARGE_TRAVEL)%2;
      this.power=(travel<=1?travel:2-travel)*100;
    } else if(this.phase==='accuracy') {
      this.cursor=Math.max(0,this.cursor-dt*ACCURACY_SPEED);
      if(this.cursor===0) { this.lockAccuracy(); autoSwing=true; }
    } else if(this.phase==='swinging') {
      this.elapsed+=dt;
      if(!this.impacted&&this.elapsed>=IMPACT_TIME) { this.impacted=true; impact=true; }
      if(this.elapsed>=SWING_DURATION) { this.phase='flight'; complete=true; }
    }
    return {impact,complete,autoSwing};
  }
  cancel() { if(this.phase==='charging'||this.phase==='accuracy') { this.reset(); return true; } return false; }
}

// The central timing window keeps the selected aim. Outside it, an early click
// pulls left and a late click slices right, with a small loss of distance.
export function shotAccuracy(error) {
  const miss=Math.max(0,Math.abs(error)-5);
  return {bearingOffset:miss===0?0:-Math.sign(error)*Math.min(18,miss*.55)*Math.PI/180,powerScale:1-Math.min(.18,miss*.006)};
}

const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const neutral={angle:0,turn:0,hipTurn:0,lean:0,tilt:0,shift:0,crouch:0,heel:0,wrist:0};
function interpolatePose(keys,time) {
  if(time>=keys.at(-1)[0])return {...neutral};
  for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){
    const [a,from]=keys[i-1],[b,to]=keys[i],t=ease((time-a)/(b-a));
    return Object.fromEntries(Object.keys(neutral).map(key=>[key,(from[key]||0)+((to[key]||0)-(from[key]||0))*t]));
  }
  return {...neutral};
}
// Anticipation, a held coil, fast wrist release, then a balanced high finish.
// All body and club transforms return to address exactly at ball impact.
export function swingPose(elapsed,putting=false,power=100) {
  if(putting)return interpolatePose([[0,neutral],[.6,{angle:-.5,turn:.04}],
    [IMPACT_TIME,neutral],[1.15,{angle:.5,turn:-.04}],[SWING_DURATION,neutral]],elapsed);
  const strength=.55+.45*Math.sqrt(Math.max(0,Math.min(100,power))/100);
  const coil={angle:-2.75,turn:.62,hipTurn:.42,lean:.1,tilt:-.11,shift:-.17,crouch:.13,heel:.12,wrist:-.18};
  const finish={angle:2.65,turn:-.82,hipTurn:-.55,lean:-.12,tilt:.15,shift:.27,crouch:-.045,heel:.9,wrist:.22};
  const pose=interpolatePose([[0,neutral],[.16,{angle:-.16,crouch:.09,shift:-.05}],
    [.58,coil],[.69,coil],[IMPACT_TIME,neutral],[1.1,finish],[1.52,finish],[SWING_DURATION,neutral]],elapsed);
  return Object.fromEntries(Object.entries(pose).map(([key,value])=>[key,value*strength]));
}
