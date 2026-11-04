import rawItems from "../../data/items.json";
import type { Game, Unit } from "./types";
import {unavailableItems,itemEffects} from "./item-effects";
import config from "../../data/simulation.json";

export interface Item { id: string; name: string; description: string; plaintext: string; gold: { total: number; sell: number; base: number; purchasable: boolean }; tags: string[]; stats: Record<string, number>; from?: string[]; into?: string[]; inStore?: boolean; requiredChampion?: string; requiredAlly?: string; depth?: number; maps: Record<string, boolean>; }
export const itemMap = Object.fromEntries(Object.entries(rawItems.data).map(([id, item]) => [id, { ...item, id }])) as Record<string, Item>;
export const plain = (html: string) => html.replace(/<br\s*\/?\s*>/gi, " · ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
// The snapshot also includes a separate 77xxxx item/recipe family. Do not mix
// those components into the standard shop: their mode-unlock rules are not modeled.
// Keep the full source in itemMap for auditing, but expose the standard-ID catalog.
const names = new Set<string>();
export const shopItems = Object.values(itemMap).filter(i => Number(i.id) < 70000 && i.maps["12"] && i.gold.purchasable && i.inStore !== false && !i.requiredAlly)
  .sort((a, b) => Number(a.id) - Number(b.id)).filter(i => { if (names.has(i.name)) return false; names.add(i.name); return true; });
export function componentQuote(itemId: string, inventory: string[]) {
  const remaining = [...inventory], consumed: string[] = [];
  const visit = (id: string, path = new Set<string>()) => {
    if (path.has(id)) return;
    const index = remaining.indexOf(id);
    if (index >= 0) { remaining.splice(index, 1); consumed.push(id); return; }
    for (const child of itemMap[id]?.from ?? []) visit(child, new Set([...path, id]));
  };
  for (const id of itemMap[itemId]?.from ?? []) visit(id);
  const price = Math.max(0, (itemMap[itemId]?.gold.total ?? Infinity) - consumed.reduce((sum, id) => sum + itemMap[id].gold.total, 0));
  return { price, consumed, remaining };
}
export function baseShop(game: Game, unit: Unit) { return game.phase !== "finished" && (game.phase === "shop" || !unit.alive || unit.atFountain && (unit.shopUnlocked ?? game.time===0)); }
export function forgeReason(g:Game,u:Unit):string|undefined {
 if(u.champion.id!=='Ornn')return '오른만 현장 제작이 가능합니다';
 if(g.phase!=='playing')return '경기가 진행 중일 때 제작할 수 있습니다';
 if(!u.alive||u.portal)return '현재 제작할 수 없습니다';
 if(u.forge)return `제작 중 · ${Math.max(0,u.forge.finishAt-g.time)}초`;
 if((u.combat?.procs.forgeReadyAt??0)>g.time)return `대장간 재사용 ${Math.ceil(u.combat!.procs.forgeReadyAt-g.time)}초`;
 if(g.time-(u.combat?.lastDamage??-100)<8||u.combat?.effects.some(e=>['stun','root','charm','silence','stasis'].includes(e.kind)&&e.until>g.time))return '전투를 벗어난 뒤 제작할 수 있습니다';
 if([...g.blue,...g.red].some(v=>v.team!==u.team&&v.alive&&!v.atFountain&&!v.portal&&Math.abs(v.position-u.position)<25))return '적과 거리를 벌린 뒤 제작할 수 있습니다';
}
export function canShop(game:Game,unit:Unit){return baseShop(game,unit)||!forgeReason(game,unit);}
export function purchaseReason(game: Game, unit: Unit, id: string) {
  const item = itemMap[id];
  if(unit.forge)return '현재 아이템을 제작 중입니다';
  if(!baseShop(game,unit)&&unit.champion.id==='Ornn'){
   const reason=forgeReason(game,unit);if(reason)return reason;
   if(item?.tags.includes('Consumable'))return '현장 제작으로 소모품을 만들 수 없습니다';
  }
  if (!canShop(game, unit)) return "사망 중 또는 부활 후 기지를 떠나기 전에만 구매할 수 있습니다";
  if (!shopItems.some(i => i.id === id)) return "일반 칼바람 상점 구매 대상이 아닙니다";
  if (item.requiredChampion && ![unit.champion.id, unit.champion.name].includes(item.requiredChampion)) return "다른 챔피언 전용 아이템입니다";
  if (unavailableItems[id]) return unavailableItems[id]+" · 아직 구매할 수 없습니다";
  if(item.tags.includes("Consumable")&&!itemEffects[id])return "이 소모품 효과는 아직 지원되지 않습니다";
  const quote = componentQuote(id, unit.items);
  if (quote.price > unit.gold) return `${quote.price - unit.gold}G 부족`;
  if (quote.remaining.length >= config.economy.inventorySlots) return "아이템 슬롯이 가득 찼습니다";
  const completed = (item.depth ?? 0) >= 3 || (!!item.from?.length && !item.into?.length);
  if (quote.remaining.includes(id) && completed) return "이 완성 아이템을 이미 보유하고 있습니다";
  if (item.tags.includes("Boots") && quote.remaining.some(i => itemMap[i]?.tags.includes("Boots"))) return "장화는 하나만 보유할 수 있습니다";
  return undefined;
}

export function itemBonuses(inventory: string[]) {
  const sum: Record<string, number> = {};
  for (const id of inventory) {
    const item = itemMap[id]; if (!item) continue;
    for (const [key, value] of Object.entries(item.stats)) sum[key] = (sum[key] ?? 0) + value;
    const statBlock = /<stats>([\s\S]*?)<\/stats>/.exec(item.description)?.[1] ?? "";
    const haste = /스킬 가속\s*(\d+)/.exec(plain(statBlock));
    if (haste) sum.haste = (sum.haste ?? 0) + Number(haste[1]);
    const text=plain(statBlock);
    for(const [key,pattern] of Object.entries({lethality:/물리 관통력\s*(\d+)/,flatMagicPen:/마법 관통력\s*(\d+)(?![\d%])(?: ·|$)/,healPower:/체력 회복 및 보호막(?: 효과)?\s*(\d+)/,manaRegenPercent:/기본 마나 재생\s*(\d+)/,hpRegenPercent:/기본 체력 재생\s*(\d+)/,tenacity:/강인함\s*(\d+)/})){const m=pattern.exec(text);if(m)sum[key]=(sum[key]??0)+Number(m[1]);}
  }
  return sum;
}

// Show the actual simulation bonuses; basic components do not need a fictitious passive.
export function itemStatLines(id:string){
 return bonusStatLines(itemBonuses([id]));
}
export function bonusStatLines(bonuses:Record<string,number>){
 const labels:Record<string,[string,boolean]>={FlatHPPoolMod:['체력',false],FlatMPPoolMod:['마나',false],FlatPhysicalDamageMod:['공격력',false],FlatMagicDamageMod:['주문력',false],FlatArmorMod:['방어력',false],FlatSpellBlockMod:['마법 저항력',false],FlatMovementSpeedMod:['이동 속도',false],PercentMovementSpeedMod:['이동 속도',true],PercentAttackSpeedMod:['공격 속도',true],FlatCritChanceMod:['치명타 확률',true],PercentLifeStealMod:['생명력 흡수',true],haste:['스킬 가속',false],lethality:['물리 관통력',false],flatMagicPen:['마법 관통력',false],healPower:['회복·보호막 효과',false],manaRegenPercent:['기본 마나 재생 %',false],hpRegenPercent:['기본 체력 재생 %',false],tenacity:['강인함 %',false]};
 return Object.entries(bonuses).filter(([,v])=>v!==0).map(([k,v])=>{const [label,percent]=labels[k]??[k,false];return `${label} +${Math.round(v*(percent?100:1)*100)/100}${percent?'%':''}`});
}
export function hasOriginalItemEffect(id:string){return !!plain((itemMap[id]?.description??'').replace(/<stats>[\s\S]*?<\/stats>/g,'')).replace(/[·\s]/g,'').length;}
