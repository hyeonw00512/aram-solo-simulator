import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame} from '../src/engine/game';
import {playableChampions} from '../src/engine/data';
import {buildSource} from '../src/engine/ai-builds';
import {ShopRecommendations} from '../src/ui/ShopRecommendations';
import {componentQuote,itemMap} from '../src/engine/items';

it('offers champion-specific source links and inspectable items for every playable champion without changing the match',()=>{
 const g=createGame(415);
 for(const champion of playableChampions){
  g.blue[0].champion=champion;const before=structuredClone(g);
  const html=renderToStaticMarkup(<ShopRecommendations game={g} selected="" onInspect={()=>{}}/>);
  expect(html).toContain(buildSource(champion.id).url);expect(html).toContain(`${champion.name} 추천`);
  expect((html.match(/추천 아이템 상세 보기/g)??[]).length,champion.id).toBeGreaterThanOrEqual(3);
  expect(html).toContain('2026-10-31 수집');expect(g).toEqual(before);
 }
});
it('shows component discounts, purchase availability and owned items in the recommendation strip',()=>{
 const g=createGame(415),u=g.blue[0];g.phase='shop';u.champion=playableChampions.find(c=>c.id==='Kennen')!;u.gold=10000;u.items=['3145'];
 const core=buildSource('Kennen').cores[0][0],price=componentQuote(core,u.items).price;
 expect(price).toBeLessThan(itemMap[core].gold.total);
 let html=renderToStaticMarkup(<ShopRecommendations game={g} selected={core} onInspect={()=>{}}/>);
 expect(html).toContain(`${price.toLocaleString()}G`);expect(html).toContain('구매 가능');expect(html).toContain('aria-pressed="true"');
 u.items=[core];html=renderToStaticMarkup(<ShopRecommendations game={g} selected={core} onInspect={()=>{}}/>);expect(html).toContain('✓ 보유 중');
});
