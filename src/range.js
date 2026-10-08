import {distance,predict} from './physics.js';

export const METERS_PER_UNIT=2.5;

// Power changes launch speed, so distance is not linear in power. Sample the
// same flight/roll model as gameplay rather than dividing distance by a label.
export function rangeProfile(position,club,hole,wind) {
  const pin={x:hole.pin[0],z:hole.pin[1]};
  const targetMeters=distance(position,pin)*METERS_PER_UNIT;
  const bearing=Math.atan2(pin.x-position.x,pin.z-position.z);
  const samples=Array.from({length:101},(_,power)=>{
    const forecast=predict(position,club,power,bearing,hole,wind);
    return distance(position,forecast.ball)*METERS_PER_UNIT;
  });
  const maxMeters=Math.max(...samples);
  let targetPower=0,error=Infinity;
  for(let power=0;power<=100;power++){
    const difference=Math.abs(samples[power]-targetMeters);
    if(difference<error){error=difference;targetPower=power;}
  }
  const reachable=targetMeters<=maxMeters+1;
  return {targetMeters,maxMeters,targetPower:reachable?targetPower:100,reachable,
    ticks:[0,25,50,75,100].map(power=>({power,meters:samples[power]})),samples};
}
