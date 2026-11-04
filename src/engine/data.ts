import rawChampions from "../../data/champions.json";
import rawAugments from "../../data/augments.json";
import growthStats from '../../data/champion-growth.json';
import {expandedAugments} from './augment-catalog';
import type { Augment, Champion, Role, Tier } from "./types";

const REVIEWED = new Set(["Ornn", "Garen", "Aatrox", "Ahri", "Ashe", "Blitzcrank", "Darius", "Evelynn", "Janna", "Kaisa", "Kennen", "Leona", "Lux", "Malphite", "Morgana", "Nami", "Sona", "Veigar", "Vex", "Yasuo"]);
const roleMap: Record<string, Role> = { Tank: "tank", Fighter: "fighter", Mage: "mage", Marksman: "marksman", Support: "support", Assassin: "assassin" };
export const champions: Champion[] = (rawChampions.data as any[]).map((c) => ({
  id: c.id, name: c.name, title: c.title, roles: c.tags.map((tag: string) => roleMap[tag]).filter(Boolean),
  attack: Math.round(c.info.attack * 10), magic: Math.round(c.info.magic * 10), durability: Math.round(c.info.defense * 10), mobility: Math.round(c.info.difficulty * 10),
  skills: [c.passive?.name, ...(c.spells ?? []).map((spell: any) => spell.name)].filter(Boolean), playable: REVIEWED.has(c.id),
  stats: {...c.stats,...(growthStats.champions as Record<string,{attackdamageperlevel:number;attackspeedratio:number}>)[c.id]},
}));
const chosen = [
  ["강타자", "silver", 8, ["basic-attack"]], ["능력치!", "silver", 9, ["adaptive"]], ["응급 처치 키트", "silver", 7, ["heal-shield"]], ["마법사 (물리)", "silver", 10, ["attack"]], ["감쇠 광선", "gold", 10, ["basic-attack"]], ["극악무도", "gold", 15, ["ability-power"]], ["급속 성장", "gold", 13, ["summoner"]], ["마법 미사일", "gold", 12, ["damage"]], ["보석 건틀릿", "prism", 19, ["damage"]], ["거석상의 용기 (★★★★)", "prism", 20, ["durability"]], ["거인 (★★★)", "prism", 19, ["durability"]], ["거인 학살자 (★★★)", "prism", 18, ["damage"]], ["궁극기 대변혁 (★★)", "prism", 21, ["ultimate"]],
] as const;
// Six fresh cards per round: three offers and one replacement per slot.
// Each tier can repeat four times; the expanded catalog reserves 24 per tier.
const additional = [
 ["능수능란", "silver", 9, ["basic-attack"]], ["육중한 힘", "silver", 9, ["attack"]],
 ["되풀이", "gold", 12, ["ability-power"]], ["치명적인 공격", "gold", 12, ["basic-attack"]],
 ["능력치 더하기 능력치 더하기 능력치!", "prism", 18, ["adaptive"]],
 ["유레카", "prism", 19, ["ability-power"]], ["최상급 조준경 부착", "prism", 18, ["basic-attack"]],
 ["프로틴 음료 (-)", "prism", 19, ["heal-shield"]], ["신비한 주먹 (-)", "prism", 19, ["basic-attack"]],
 ["유리 대포", "prism", 20, ["damage"]], ["미친 과학자 (★★)", "prism", 19, ["adaptive"]],
] as const;
const originalAugments: Augment[] = [...chosen,...additional].map(([name, tier, power, tags], index) => {
  const source = (rawAugments.data as any[]).find((item) => item.name === name);
  return { id: source?.id ?? `reviewed-${index}`, name, tier: tier as Tier, effect: source?.effectSummary?.split("추가 시기")[0]?.replace(/&#91;편집&#93;/g, "").trim() ?? "검수된 전투 보정", power, tags: [...tags] };
});
export const augments:Augment[]=[...originalAugments,...expandedAugments.map(([id,tag,description])=>{
 const source=rawAugments.data.find(a=>a.id===id);if(!source)throw new Error(`Missing augment source: ${id}`);
 return {id,name:source.name,tier:source.tier as Tier,power:source.tier==='silver'?9:source.tier==='gold'?13:19,tags:[tag],effect:description};
})];
export const playableChampions = champions.filter((champion) => champion.playable);

// Only descriptions explicitly mentioning a damage type can label a damaging
// cast. Do not describe healing/shield/movement skills as direct damage.
export const damageSkillNames: Record<string, string[]> = Object.fromEntries(
  rawChampions.data.map(c => [c.id, c.spells.filter(s => /(?:물리|마법|고정) 피해/.test(s.description.replace(/<[^>]+>/g, ""))).map(s => s.name)]),
);
export const damageSkills = Object.fromEntries(rawChampions.data.map(c => [c.id,
  c.spells.filter(s => /(?:물리|마법|고정) 피해/.test(s.description.replace(/<[^>]+>/g, ""))).map(s => ({ name: s.name, type: s.description.includes("고정 피해") ? "true" : s.description.includes("물리 피해") ? "physical" : "magic" }))
]));
