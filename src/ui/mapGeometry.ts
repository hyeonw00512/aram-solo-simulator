// Uniform ground-plane projection shared with engine/map-layout.ts.
export const mapPoint = (position: number, lateral = 0) => ({
  x: 65 + position * 7.7 + lateral * 340 / Math.hypot(770,340),
  y: 450 - position * 3.4 + lateral * 770 / Math.hypot(770,340),
});
export const mapPolygon = (start: number, end: number, near: number, far: number) =>
  [[start, near], [end, near], [end, far], [start, far]].map(([p, l]) => {
    const point = mapPoint(p, l); return `${point.x},${point.y}`;
  }).join(' ');
