import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const LOCALE = "ko_KR";
const ARAM_MAP_ID = "12";

type DragonRecord = Record<string, unknown>;
type DragonResponse = { data: Record<string, DragonRecord> };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json() as Promise<T>;
}

function isAvailableOnAram(entry: DragonRecord): boolean {
  const maps = entry.maps as Record<string, boolean> | undefined;
  const modes = entry.modes as string[] | undefined;
  return maps?.[ARAM_MAP_ID] === true || modes?.includes("ARAM") === true;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const [version] = await getJson<string[]>("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!version) throw new Error("Data Dragon version list was empty.");

  const base = `https://ddragon.leagueoflegends.com/cdn/${version}/data/${LOCALE}`;
  const championIndex = await getJson<DragonResponse>(`${base}/champion.json`);
  const championEntries = await Promise.all(
    Object.keys(championIndex.data).sort().map(async (id) => {
      const detail = await getJson<DragonResponse>(`${base}/champion/${id}.json`);
      return detail.data[id];
    }),
  );
  const itemIndex = await getJson<DragonResponse>(`${base}/item.json`);
  const summonerIndex = await getJson<DragonResponse>(`${base}/summoner.json`);
  const items = Object.fromEntries(Object.entries(itemIndex.data).filter(([, item]) => isAvailableOnAram(item)));
  const summoners = Object.fromEntries(Object.entries(summonerIndex.data).filter(([, spell]) => isAvailableOnAram(spell)));
  const collectedAt = new Date().toISOString();
  const envelope = (data: unknown) => ({ source: "Riot Data Dragon", version, locale: LOCALE, collectedAt, data });

  await Promise.all([
    writeFile(join(DATA_DIR, "champions.json"), JSON.stringify(envelope(championEntries), null, 2) + "\n"),
    writeFile(join(DATA_DIR, "items.json"), JSON.stringify(envelope(items), null, 2) + "\n"),
    writeFile(join(DATA_DIR, "summoners.json"), JSON.stringify(envelope(summoners), null, 2) + "\n"),
  ]);
  console.log(JSON.stringify({ version, champions: championEntries.length, items: Object.keys(items).length, summoners: Object.keys(summoners).length }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
