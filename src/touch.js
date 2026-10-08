// A short single-finger tap advances shot timing. Drags and pinch only move/zoom.
export function createTouchTap(onTap) {
  const pointers = new Map();
  let cancelled = false;
  let lastTouchEnd = -Infinity;
  const moved = (start, event) => Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10;
  return {
    down(event) {
      if (event.pointerType !== 'touch') return;
      if (pointers.size === 0) cancelled = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp });
      if (pointers.size > 1) cancelled = true;
    },
    move(event) {
      const start = pointers.get(event.pointerId);
      if (start && moved(start, event)) cancelled = true;
    },
    up(event) {
      const start = pointers.get(event.pointerId);
      if (!start) return;
      lastTouchEnd = event.timeStamp;
      const tapped = pointers.size === 1 && !cancelled && !moved(start, event) && event.timeStamp - start.time <= 350;
      pointers.delete(event.pointerId);
      if (tapped) onTap();
    },
    cancel(event) {
      if (!pointers.has(event.pointerId)) return;
      cancelled = true;
      pointers.delete(event.pointerId);
    },
    shouldHandleClick(event) {
      if (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) return false;
      // Some mobile WebViews dispatch a compatibility click without identifying it as touch.
      // Pointer-up already handled the tap, so don't advance the shot state twice.
      return event.timeStamp - lastTouchEnd > 800;
    },
  };
}
