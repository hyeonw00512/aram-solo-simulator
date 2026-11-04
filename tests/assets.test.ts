import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import icons from '../data/augment-icons.json';
import raw from '../data/augments.json';
import {itemMap} from '../src/engine/items';
import {augments} from '../src/engine/data';
const png=(path:string)=>expect([...readFileSync(path).subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
it('has a local PNG for every source item including recipe components',()=>{for(const id of Object.keys(itemMap))png(`public/assets/items/${id}.png`)});
it('maps every collected and selectable augment to a downloaded source icon',()=>{
 expect(icons.missing).toEqual([]);expect(icons.failed).toEqual([]);
 const catalog=icons.data as Record<string,{file:string;sourceName:string}>;
 for(const a of [...raw.data,...augments]){expect(catalog[a.id]?.sourceName).toBeTruthy();png(`public${catalog[a.id].file}`)}
});
