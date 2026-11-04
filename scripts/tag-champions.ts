import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type DragonChampion = { id: string; name: string; tags: string[]; partype: string; passive?: { name: string; description: string }; spells?: { id: string; name: string; description: string; effectBurn: string[]; }[] };
const DATA_DIR = join(process.cwd(), "data");
const clean = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const has = (text: string, words: string[]) => words.some((word) => text.includes(word));
function classify(name: string, description: string) {
  const text = clean(description);
  const tags = [
    ...(has(text, ["물리 피해"]) ? ["physical"] : []), ...(has(text, ["마법 피해"]) ? ["magic"] : []), ...(has(text, ["고정 피해"]) ? ["true-damage"] : []),
    ...(has(text, ["기절", "속박", "공중에", "둔화", "침묵", "도발", "공포", "매혹", "제압"]) ? ["crowd-control"] : []),
    ...(has(text, ["돌진", "돌진합니다", "점멸", "돌진해", "이동 속도", "은신"]) ? ["mobility"] : []),
    ...(has(text, ["회복", "보호막", "치유"]) ? ["ally-support"] : []), ...(has(text, ["주변", "모든 적", "범위", "적중한 적들"]) ? ["area"] : ["single"]),
  ];
  const confidence = tags.length >= 2 && text.length > 30 ? "medium" : "low";
  return { name, tags, confidence, sourceText: text };
}
async function main() {
  const raw = JSON.parse(await readFile(join(DATA_DIR, "champions.json"), "utf8")) as { version: string; data: DragonChampion[] };
  const champions = raw.data.map((champion) => {
    const skills = [champion.passive && classify(champion.passive.name, champion.passive.description), ...(champion.spells ?? []).map((spell) => classify(spell.name, spell.description))].filter(Boolean);
    const allTags = skills.flatMap((skill) => skill!.tags);
    return { id: champion.id, name: champion.name, roles: champion.tags, usesMana: champion.partype === "마나", hasMobility: allTags.includes("mobility"), hasSupport: allTags.includes("ally-support"), skills };
  });
  const review = champions.filter((champion) => champion.skills.some((skill) => skill!.confidence === "low")).map((champion) => ({ category: "champion-skill-tags", id: champion.id, name: champion.name, message: "설명문 기반 태그의 확신도가 낮아 수동 검토가 필요합니다." }));
  await Promise.all([
    writeFile(join(DATA_DIR, "skill-tags.json"), JSON.stringify({ source: "Riot Data Dragon skill descriptions", version: raw.version, generatedAt: new Date().toISOString(), data: champions }, null, 2) + "\n"),
    writeFile(join(DATA_DIR, "champion-tag-review-needed.json"), JSON.stringify({ generatedAt: new Date().toISOString(), items: review }, null, 2) + "\n"),
  ]);
  console.log(JSON.stringify({ champions: champions.length, reviewNeeded: review.length }, null, 2));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
