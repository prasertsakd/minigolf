// Single-finger horizontal drag aims; two fingers are reserved for the world's pinch zoom.
export function createTouchAim(onDrag, canAim = () => true, onTap = () => {}, canTap = () => false) {
  const pointers=new Map();let cancelled=false,mode=null,lastTouchEnd=-Infinity;
  return {
    down(event){
      if(event.pointerType!=='touch')return;
      if(!pointers.size){mode=canAim()?'aim':canTap()?'tap':null;cancelled=!mode;}
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,lastX:event.clientX,dragging:false});
      if(pointers.size>1)cancelled=true;
    },
    move(event){
      const p=pointers.get(event.pointerId);
      if(!p||cancelled||pointers.size!==1)return;
      if(mode==='tap'){
        if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>8)cancelled=true;
        return;
      }
      if(mode!=='aim'||!canAim()){cancelled=true;return;}
      if(!p.dragging){
        if(Math.abs(event.clientY-p.y)>Math.abs(event.clientX-p.x)&&Math.abs(event.clientY-p.y)>8){cancelled=true;return;}
        if(Math.abs(event.clientX-p.x)<8)return;p.dragging=true;
      }
      onDrag(event.clientX-p.lastX);p.lastX=event.clientX;
    },
    up(event){
      if(!pointers.has(event.pointerId))return;
      lastTouchEnd=event.timeStamp;
      if(mode==='tap'&&!cancelled&&pointers.size===1&&canTap())onTap();
      pointers.delete(event.pointerId);
      if(!pointers.size){cancelled=false;mode=null;}
    },
    cancel(event){
      if(!pointers.has(event.pointerId))return;
      cancelled=true;lastTouchEnd=event.timeStamp;pointers.delete(event.pointerId);
      if(!pointers.size){cancelled=false;mode=null;}
    },
    shouldHandleClick(event){return event.pointerType!=='touch'&&!event.sourceCapabilities?.firesTouchEvents&&event.timeStamp-lastTouchEnd>800;},
  };
}
