import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame} from '../src/engine/game';
import {itemPurchasePlan,componentQuote,shopItems,itemMap} from '../src/engine/items';
import {buyItemGoal,advanceForges} from '../src/engine/shop';
import {playableChampions} from '../src/engine/data';
import {Shop} from '../src/ui/Shop';
function shop(gold:number,items:string[]=[]){const g=createGame(415);g.phase='shop';g.blue[0].champion=playableChampions.find(c=>c.id==='Ahri')!;g.blue[0].gold=gold;g.blue[0].items=items;return g;}
describe('buy a goal or affordable missing components',()=>{
 it('buys Lost Chapter for a 1200G Luden goal, with exact gold and remaining recipe cost',()=>{
  const g=shop(1200),before=structuredClone(g),plan=itemPurchasePlan(g,g.blue[0],'6655');
  expect(plan).toMatchObject({components:true,total:1200,steps:[{id:'3802',price:1200}]});expect(g).toEqual(before);
  expect(buyItemGoal(g,'6655')).toBe(true);expect(g.blue[0].items).toEqual(['3802']);expect(g.blue[0].gold).toBe(0);expect(componentQuote('6655',g.blue[0].items).price).toBe(1550);
 });
 it('prefers affordable direct components, then buys multiple deeper components with the remaining gold',()=>{
  const direct=shop(1100);buyItemGoal(direct,'6655');expect(direct.blue[0].items).toEqual(['3145']);
  const multiple=shop(1600);expect(itemPurchasePlan(multiple,multiple.blue[0],'6655').steps.map(s=>s.id)).toEqual(['3802','1052']);buyItemGoal(multiple,'6655');expect(multiple.blue[0].gold).toBe(0);
  const small=shop(1000);buyItemGoal(small,'6655');expect(small.blue[0].items).toEqual(['1052','1027','2022']);expect(small.blue[0].gold).toBe(50);
 });
 it('credits owned components, finishes the goal when affordable, and never repurchases parts below an owned parent',()=>{
  const g=shop(1550,['3802']);expect(itemPurchasePlan(g,g.blue[0],'6655').components).toBe(false);buyItemGoal(g,'6655');expect(g.blue[0].items).toEqual(['6655']);expect(g.blue[0].gold).toBe(0);
  const partial=shop(800,['3802']);buyItemGoal(partial,'6655');expect(partial.blue[0].items).toEqual(['3802','1052','1052']);
  const combine=shop(400,['3802','3145']),before=structuredClone(combine);expect(buyItemGoal(combine,'6655')).toBe(false);expect(combine).toEqual(before);
 });
 it('combines materials at six slots when possible, but never sells or exceeds the inventory limit',()=>{
  const g=shop(300,['1052','1052','1001','1042','1036','1054']);expect(itemPurchasePlan(g,g.blue[0],'6655').steps).toEqual([{id:'3145',price:300}]);buyItemGoal(g,'6655');expect(g.blue[0].items).toEqual(['1001','1042','1036','1054','3145']);
  const full=shop(1200,Array(6).fill('1036')),before=structuredClone(full);expect(buyItemGoal(full,'6655')).toBe(false);expect(full).toEqual(before);
 });
 it('does not bypass complete-item uniqueness, boot restrictions, invalid goals, phase or purchase location',()=>{
  for(const [goal,items] of [['6655',['6655']],['3047',['3111']],['does-not-exist',[]]] as [string,string[]][]){const g=shop(1200,items),before=structuredClone(g);expect(buyItemGoal(g,goal)).toBe(false);expect(g).toEqual(before)}
  const g=shop(1200);g.phase='playing';g.time=100;g.blue[0].atFountain=false;const before=structuredClone(g);expect(buyItemGoal(g,'6655')).toBe(false);expect(g).toEqual(before);
  g.blue[0].alive=false;expect(buyItemGoal(g,'6655')).toBe(true);
  const finished=shop(1200);finished.phase='finished';expect(buyItemGoal(finished,'6655')).toBe(false);
 });
 it('preserves Ornn field craft timing and only starts one component craft per purchase',()=>{
  const g=shop(1600),u=g.blue[0];u.champion=playableChampions.find(c=>c.id==='Ornn')!;g.phase='playing';g.time=100;u.atFountain=false;u.position=20;u.combat=undefined;g.red.forEach(e=>e.atFountain=true);
  expect(itemPurchasePlan(g,u,'6655').steps.map(s=>s.id)).toEqual(['3802']);expect(buyItemGoal(g,'6655')).toBe(true);expect(u.forge?.itemId).toBe('3802');expect(u.gold).toBe(1600);expect(u.items).toEqual([]);
  expect(buyItemGoal(g,'6655')).toBe(false);g.time+=3;advanceForges(g);expect(u.items).toEqual(['3802']);expect(u.gold).toBe(400);
 });
 it('conserves gold and recipe credit across the full composite catalog, including repeated materials',()=>{
  for(const item of shopItems.filter(i=>i.from?.length))for(const budget of [400,1200,2500]){
   const g=shop(budget),u=g.blue[0],before=componentQuote(item.id,u.items).price,plan=itemPurchasePlan(g,u,item.id);
   expect(plan.total).toBeLessThanOrEqual(budget);if(!plan.steps.length)continue;
   expect(buyItemGoal(g,item.id),item.name).toBe(true);expect(u.gold).toBe(budget-plan.total);expect(u.items.length).toBeLessThanOrEqual(6);
   if(plan.components)expect(before-componentQuote(item.id,u.items).price,item.name).toBe(plan.total);else expect(u.items).toContain(item.id);
   expect(u.items.every(id=>!!itemMap[id])).toBe(true);
  }
 });
 it('keeps inspection read-only and explains double-click and partial purchases in the shop',()=>{
  const g=shop(1200),before=structuredClone(g),html=renderToStaticMarkup(<Shop game={g} update={()=>{}}/>);
  expect(html).toContain('더블클릭');expect(html).toContain('하위 재료');expect(g).toEqual(before);
 });
});
