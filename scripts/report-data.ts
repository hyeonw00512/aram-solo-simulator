import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function json(name: string) { return JSON.parse(await readFile(join(process.cwd(), "data", name), "utf8")) as { data: unknown }; }
async function main() {
  const [champions, items, summoners, augments] = await Promise.all([json("champions.json"), json("items.json"), json("summoners.json"), json("augments.json")]);
  const byGrade = Object.values((augments.data ?? []) as { tier: string }[]).reduce<Record<string, number>>((acc, value) => { acc[value.tier] = (acc[value.tier] ?? 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ champions: (champions.data as unknown[]).length, items: Object.keys(items.data as object).length, summoners: Object.keys(summoners.data as object).length, augments: byGrade }, null, 2));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
