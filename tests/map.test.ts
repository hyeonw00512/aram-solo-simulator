import {describe,it,expect} from 'vitest';
import {mapPoint,mapPolygon} from '../src/ui/mapGeometry';
describe('Howling Abyss spectator projection',()=>{
 it('maps blue home to bottom-left and red home to top-right',()=>{const blue=mapPoint(0),red=mapPoint(100);expect(blue.x).toBeLessThan(red.x);expect(blue.y).toBeGreaterThan(red.y)});
 it('preserves progression and remains inside the viewport for all display slots',()=>{for(let distance=0;distance<=100;distance++){const p=mapPoint(distance);expect(p.x).toBeLessThan(mapPoint(distance+1).x);for(const lateral of [-68,0,68]){const q=mapPoint(distance,lateral);expect(q.x).toBeGreaterThan(0);expect(q.x).toBeLessThan(900);expect(q.y).toBeGreaterThan(0);expect(q.y).toBeLessThan(535)}}});
 it('creates finite four-corner bridge tiles',()=>{const corners=mapPolygon(10,20,-80,80).split(' ');expect(corners).toHaveLength(4);expect(corners.every(c=>c.split(',').every(v=>Number.isFinite(Number(v))))).toBe(true)});
});
