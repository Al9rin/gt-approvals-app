import dotenv from "dotenv";
import fetch from "node-fetch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, "..");

const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "";
const SEMRUSH_DATABASE = process.env.SEMRUSH_DATABASE || "us";
const SEMRUSH_EXPORT_LIMIT = Number(process.env.SEMRUSH_EXPORT_LIMIT || 25);
const SEMRUSH_TIMEOUT_MS = Number(process.env.SEMRUSH_TIMEOUT_MS || 8000);
const snapshotPath = process.env.SEMRUSH_SNAPSHOT_PATH
  || path.join(serverDir, "data", "semrush-keywords.json");
const seedsFilePath = process.env.SEO_SNAPSHOT_SEEDS_FILE
  || path.join(serverDir, "data", "keyword-seeds.json");

function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSemrushRows(rawText) {
  const rows = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length <= 1 || rows[0].startsWith("ERROR")) {
    return [];
  }

  return rows.slice(1).map((row) => {
    const [keyword = "", searchVolume = "", intent = "", difficulty = ""] = row.split(";");
    return {
      keyword: keyword.trim(),
      searchVolume: Number(searchVolume) || 0,
      intent: intent.trim().toLowerCase(),
      difficulty: Number(difficulty) || 0,
    };
  });
}

function loadSeeds() {
  const envSeeds = parseCsv(process.env.SEO_SNAPSHOT_SEEDS);
  if (envSeeds.length > 0) {
    return envSeeds;
  }

  if (!existsSync(seedsFilePath)) {
    throw new Error(
      `No seeds found. Set SEO_SNAPSHOT_SEEDS or create ${seedsFilePath} from keyword-seeds.example.json.`
    );
  }

  const parsed = JSON.parse(readFileSync(seedsFilePath, "utf8"));
  const seeds = Array.isArray(parsed?.seeds) ? parsed.seeds : [];
  return seeds
    .map((seed) => (typeof seed === "string" ? seed.trim() : ""))
    .filter(Boolean);
}

async function fetchRelatedKeywords(seedPhrase) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEMRUSH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      type: "phrase_related",
      key: SEMRUSH_API_KEY,
      phrase: seedPhrase,
      database: SEMRUSH_DATABASE,
      display_limit: String(SEMRUSH_EXPORT_LIMIT),
      display_sort: "nq_desc",
      export_columns: "Ph,Nq,In,Kd",
      export_decode: "1",
      export_escape: "0",
    });

    const response = await fetch(`https://api.semrush.com/?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok || text.startsWith("ERROR")) {
      throw new Error(text || `Semrush request failed for "${seedPhrase}"`);
    }

    return parseSemrushRows(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  if (!SEMRUSH_API_KEY) {
    throw new Error("SEMRUSH_API_KEY is required to export a snapshot.");
  }

  const seeds = loadSeeds();
  if (seeds.length === 0) {
    throw new Error("At least one snapshot seed is required.");
  }

  const seedResults = [];
  const dedupedKeywords = new Map();

  for (const seed of seeds) {
    const keywords = await fetchRelatedKeywords(seed);
    seedResults.push({ seed, keywords });

    for (const entry of keywords) {
      if (!dedupedKeywords.has(entry.keyword)) {
        dedupedKeywords.set(entry.keyword, entry);
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    database: SEMRUSH_DATABASE,
    exportLimitPerSeed: SEMRUSH_EXPORT_LIMIT,
    seeds: seedResults,
    allKeywords: Array.from(dedupedKeywords.values()),
  };

  mkdirSync(path.dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));

  console.log(`Wrote ${payload.allKeywords.length} keywords to ${snapshotPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
