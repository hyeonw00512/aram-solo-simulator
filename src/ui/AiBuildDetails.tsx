import type {Unit} from '../engine/types';
import {itemMap} from '../engine/items';
export function AiBuildDetails({unit}:{unit:Unit}){
 const p=unit.aiBuild;if(!p)return null;
 return <details className="ai-build-plan"><summary>구매 성향 · {p.style==='standard'?'정석 선호':p.style==='adaptive'?'상황에 맞게 변형':'독자 빌드 선호'}</summary><p>{p.reason}</p><div className="planned-items">{p.route.map((id,i)=><span key={id} title={itemMap[id]?.name}><small>{i+1}</small><img src={`/assets/items/${id}.png`} alt={itemMap[id]?.name}/><span>{itemMap[id]?.name}</span></span>)}</div>{p.source&&<p><a href={p.source} target="_blank" rel="noreferrer">OP.GG 챔피언 빌드 · {p.patch}</a><small> 핵심 아이템 참고 자료 · 나머지 구매 순서와 변형은 게임 내 판단입니다.</small></p>}</details>;
}
