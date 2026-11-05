import type {Game} from '../engine/types';
import {buildSource,buildSourceDate} from '../engine/ai-builds';
import {componentQuote,itemMap,purchaseReason,shopItems,itemPurchasePlan} from '../engine/items';
import {unavailableItems} from '../engine/item-effects';

const supported=new Set(shopItems.filter(i=>!unavailableItems[i.id]).map(i=>i.id));
export function ShopRecommendations({game,selected,onInspect,onPurchase}:{game:Game;selected:string;onInspect:(id:string)=>void;onPurchase?:(id:string)=>void}){
 const unit=game.blue[0],source=buildSource(unit.champion.id);
 if(!source)return <aside className="shop-recommendations">현재 챔피언의 추천 자료가 없습니다.</aside>;
 const core=source.cores[0]??[],boot=source.boots.flat().find(id=>supported.has(id));
 const ids=[...new Set([...core,...(boot?[boot]:[])])].filter(id=>supported.has(id));
 return <aside className="shop-recommendations" aria-label={`${unit.champion.name} OP.GG 추천 아이템`}>
  <div className="recommendation-heading"><strong>{unit.champion.name} 추천</strong><a href={source.url} target="_blank" rel="noreferrer">OP.GG 아수라장 ↗</a><small>{buildSourceDate} 수집 · {source.patch}</small></div>
  <div className="recommendation-items">{ids.map(id=>{
   const item=itemMap[id],owned=unit.items.includes(id),price=componentQuote(id,unit.items).price,reason=purchaseReason(game,unit,id),plan=itemPurchasePlan(game,unit,id);
   return <button key={id} className={`recommendation-item${selected===id?' selected':''}${owned?' owned':''}`} aria-pressed={selected===id} aria-label={`${item.name} 추천 아이템 상세 보기`} title={`${item.name} · ${owned?'보유 중':reason??'지금 구매 가능'} · 클릭하여 상세 확인 · 더블클릭하여 구매`} onClick={()=>onInspect(id)} onDoubleClick={()=>onPurchase?.(id)}>
    <img src={`/assets/items/${id}.png`} alt=""/><span><strong>{item.name}</strong><small className={owned?'owned-label':!reason?'gold':''}>{owned?'✓ 보유 중':`${price.toLocaleString()}G`}{!owned&&!reason?' · 구매 가능':!owned&&plan.components&&plan.steps.length?` · 재료 ${plan.total}G`:''}</small></span>
   </button>;
  })}</div>
  {core.some(id=>!supported.has(id))&&<small className="recommendation-note">이 게임에서 구매 가능한 추천 아이템만 표시합니다.</small>}
 </aside>;
}
