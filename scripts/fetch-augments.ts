import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RAW_DIR = join(process.cwd(), "data", "raw");
const OUTPUT = join(process.cwd(), "data", "augments.json");
const REVIEW_OUTPUT = join(process.cwd(), "data", "review-needed.json");
const SOURCES = [
  ["silver", "https://namu.wiki/w/%EB%A6%AC%EA%B7%B8%20%EC%98%A4%EB%B8%8C%20%EB%A0%88%EC%A0%84%EB%93%9C/%EC%A6%9D%EA%B0%95/%EC%8B%A4%EB%B2%84"],
  ["gold", "https://namu.wiki/w/%EB%A6%AC%EA%B7%B8%20%EC%98%A4%EB%B8%8C%20%EB%A0%88%EC%A0%84%EB%93%9C/%EC%A6%9D%EA%B0%95/%EA%B3%A8%EB%93%9C"],
  ["prism", "https://namu.wiki/w/%EB%A6%AC%EA%B7%B8%20%EC%98%A4%EB%B8%8C%20%EB%A0%88%EC%A0%84%EB%93%9C/%EC%A6%9D%EA%B0%95/%ED%94%84%EB%A6%AC%EC%A6%98"],
] as const;

async function downloadRawSources() {
  await mkdir(RAW_DIR, { recursive: true });
  const results = await Promise.all(SOURCES.map(async ([tier, url]) => {
    try {
      const response = await fetch(url, { headers: { "user-agent": "text-chaos-brawl data collector" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      await writeFile(join(RAW_DIR, `augment-${tier}.html`), await response.text());
      return { tier, url, status: "downloaded" };
    } catch (error) {
      return { tier, url, status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }));
  return results;
}

/**
 * The source pages place live Asura Jang augments below heading 2.x. Other
 * sections contain removed, unused, or mode-specific content and are excluded.
 * The game only consumes effects whose simulation parameters are explicitly approved.
 */
function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseActiveAugments(raw: string, tier: string, sourceUrl: string) {
  const heading = /<h3[^>]*>\s*<a id='s-2\.(\d+)'[^>]*>[^<]*<\/a>\s*<span id='([^']+)'[^>]*>/g;
  const matches = [...raw.matchAll(heading)];
  return matches.map((match, index) => {
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? raw.length;
    const sourceText = decodeHtml(raw.slice(contentStart, contentEnd)).slice(0, 700);
    const name = decodeHtml(match[2]);
    return {
      id: `${tier}-${String(match[1]).padStart(3, "0")}`,
      name,
      tier,
      effectSummary: sourceText,
      simulationParameters: null,
      tags: [],
      exclusionConditions: [],
      sourceUrl,
      collectedAt: new Date().toISOString(),
      status: "needs-simulation-review",
    };
  });
}

async function main() {
  const downloads = process.argv.includes("--download") ? await downloadRawSources() : [];
  const files = (await readdir(RAW_DIR)).filter((file) => /augment.*\.(html|txt)$/i.test(file));
  const sources = await Promise.all(files.map(async (file) => ({ file, raw: await readFile(join(RAW_DIR, file), "utf8") })));
  const parsed = sources.flatMap(({ file, raw }) => {
    const tier = /augment-(silver|gold|prism)\./.exec(file)?.[1];
    const source = SOURCES.find(([sourceTier]) => sourceTier === tier);
    return tier && source ? parseActiveAugments(raw, tier, source[1]) : [];
  });
  const result = {
    source: "Namu Wiki raw export",
    collectedAt: new Date().toISOString(),
    status: parsed.length ? "needs-simulation-review" : (files.length ? "needs-parser-review" : "awaiting-raw-source"),
    data: parsed,
    rawFiles: sources.map(({ file }) => file),
    downloads,
  };
  const review = {
    generatedAt: new Date().toISOString(),
    items: parsed.length
      ? parsed.map(({ name, tier }) => ({ category: "augment-simulation", tier, name, message: "효과 수치를 게임 파라미터로 변환하기 전 검토가 필요합니다." }))
      : [{ category: "augment-source", message: "나무위키 원본이 없습니다. data/raw/augment-*.html 또는 .txt 파일을 넣어 주세요." }],
  };
  await Promise.all([
    writeFile(OUTPUT, JSON.stringify(result, null, 2) + "\n"),
    writeFile(REVIEW_OUTPUT, JSON.stringify(review, null, 2) + "\n"),
  ]);
  console.log(JSON.stringify({ rawFiles: files.length, status: result.status, downloads }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
