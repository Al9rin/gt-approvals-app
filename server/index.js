import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const APP_ACCESS_TOKEN = process.env.APP_ACCESS_TOKEN || "";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const MAX_NARRATIVE_CHARS = Number(process.env.MAX_NARRATIVE_CHARS || 6000);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20_000);
const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "";
const SEMRUSH_DATABASE = process.env.SEMRUSH_DATABASE || "us";
const SEMRUSH_RESULTS_PER_SEED = Number(process.env.SEMRUSH_RESULTS_PER_SEED || 8);
const SEMRUSH_TIMEOUT_MS = Number(process.env.SEMRUSH_TIMEOUT_MS || 8000);
const SEO_CACHE_TTL_MS = Number(process.env.SEO_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const SEMRUSH_SNAPSHOT_PATH = process.env.SEMRUSH_SNAPSHOT_PATH
  || path.join(__dirname, "data", "semrush-keywords.json");
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const requestCounts = new Map();
const seoKeywordCache = new Map();
const semrushInformedKeywordGroups = [
  "therapy",
  "therapist",
  "counseling",
  "online therapy",
  "anxiety therapy",
  "trauma therapy",
  "couples therapy",
  "couples counseling",
  "relationship counseling",
  "family therapy",
];

const keywordRules = [
  {
    pattern: /\b(anxiety|anxious|panic)\b/i,
    suggestions: ["anxiety therapy", "anxiety counseling"],
  },
  {
    pattern: /\b(trauma|posttraumatic stress|ptsd|emdr)\b/i,
    suggestions: ["trauma therapy"],
  },
  {
    pattern: /\bcouples?|relationship|marriage\b/i,
    suggestions: ["couples therapy", "couples counseling", "relationship counseling"],
  },
  {
    pattern: /\bfamily|parenting\b/i,
    suggestions: ["family therapy"],
  },
  {
    pattern: /\b(depression|depressed)\b/i,
    suggestions: ["depression therapy"],
  },
  {
    pattern: /\b(teen|adolescent|child|children)\b/i,
    suggestions: ["teen therapy", "child therapy"],
  },
  {
    pattern: /\b(online|virtual|telehealth)\b/i,
    suggestions: ["online therapy"],
  },
  {
    pattern: /\b(grief|loss|bereave(?:d|ment)?)\b/i,
    suggestions: ["grief counseling", "grief therapy"],
  },
  {
    pattern: /\b(stress|burnout)\b/i,
    suggestions: ["stress counseling", "burnout therapy"],
  },
  {
    pattern: /\b(ocd|obsessive compulsive)\b/i,
    suggestions: ["ocd therapy"],
  },
  {
    pattern: /\b(adhd|attention deficit)\b/i,
    suggestions: ["adhd therapy"],
  },
  {
    pattern: /\bemdr\b/i,
    suggestions: ["EMDR therapy"],
  },
  {
    pattern: /\b(self-esteem|confidence)\b/i,
    suggestions: ["self-esteem counseling"],
  },
  {
    pattern: /\b(life transition|major change|career change)\b/i,
    suggestions: ["life transitions counseling"],
  },
];

const blockedKeywordFragments = [
  "betterhelp",
  "psychology today",
  "headway",
  "grow therapy",
  "physical therapy",
  "physical therapist",
  "occupational therapy",
  "speech therapy",
  "massage therapy",
  "chiropractor",
  "rehab",
  "rehabilitation",
  "lifestance",
  "indeed",
  "salary",
  "jobs",
  "worksheet",
  "worksheets",
  "pdf",
  "icd",
  "dsm",
];

function loadSemrushSnapshot() {
  if (!existsSync(SEMRUSH_SNAPSHOT_PATH)) {
    return {
      loaded: false,
      keywordsBySeed: new Map(),
      allKeywords: [],
    };
  }

  try {
    const raw = readFileSync(SEMRUSH_SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const keywordsBySeed = new Map();
    const seeds = Array.isArray(parsed?.seeds) ? parsed.seeds : [];

    for (const seedEntry of seeds) {
      if (!seedEntry?.seed || !Array.isArray(seedEntry?.keywords)) {
        continue;
      }

      keywordsBySeed.set(
        normalizeKeyword(seedEntry.seed),
        seedEntry.keywords
          .filter((entry) => entry && typeof entry.keyword === "string")
          .map((entry) => ({
            keyword: entry.keyword,
            searchVolume: Number(entry.searchVolume) || 0,
            intent: typeof entry.intent === "string" ? entry.intent : "",
            difficulty: Number(entry.difficulty) || 0,
          }))
      );
    }

    return {
      loaded: true,
      generatedAt: parsed?.generatedAt || "",
      keywordsBySeed,
      allKeywords: Array.isArray(parsed?.allKeywords)
        ? parsed.allKeywords.filter((entry) => entry && typeof entry.keyword === "string")
        : [],
    };
  } catch (error) {
    console.error(`Failed to load Semrush snapshot from ${SEMRUSH_SNAPSHOT_PATH}: ${error.message}`);
    return {
      loaded: false,
      keywordsBySeed: new Map(),
      allKeywords: [],
    };
  }
}

const semrushSnapshot = loadSemrushSnapshot();

const systemPrompt = `
You are a narrative compliance assistant for GoodTherapy. Your task is to lightly refine therapist marketing narratives so they read cleanly, stay true to the therapist's voice, follow GoodTherapy editorial guidance, and improve search discoverability without sounding SEO-written.

Follow these instructions exactly:

1. Correct grammar, punctuation, spelling, and obvious clarity issues.
2. Preserve the therapist's original voice, warmth, rhythm, and point of view.
3. Keep the writing casual, natural, and human. Do not make it sound corporate, generic, stiff, or overly polished.
4. Do NOT change the meaning, add unsupported claims, invent specialties, or rewrite the structure unless clarity requires it.
5. Never introduce a new modality, specialty, diagnosis, acronym, or treatment approach unless it is explicitly supported by the original narrative or selected context.
6. Never add an explanatory sentence just to fit SEO. If a keyword would require new claims or a new concept, skip it.
7. Apply GoodTherapy editorial rules, including:
   - Expand all acronyms on first use with correct capitalization and terminology.
   - Do not include the word "disorder" as part of expanded mental health terms.
   - Replace unnecessary uses of "disorder" with better alternatives such as issue, condition, diagnosis, or challenge.
   - Use people-first language unless identity-first language is preferred by that community.
   - Use lowercase for therapy types and mental health issues unless standard capitalization is required.
   - Avoid stigmatizing, cold, or clinical-sounding labels.
   - Use the Oxford comma.
   - If degrees and licenses are listed together, put degrees first.
8. Apply light SEO enhancement only when it can be done naturally and truthfully:
   - Work in no more than 2 to 4 relevant keyword phrases.
   - Only use keywords that are supported by the original narrative or the provided context.
   - If there is no clearly safe keyword fit, do not force SEO at all.
   - Favor clear service-intent phrasing such as therapy, therapist, counseling, online therapy, anxiety therapy, trauma therapy, EMDR therapy, couples therapy, couples counseling, relationship counseling, and family therapy when relevant.
   - If location or license context is provided, you may reinforce it once in a natural way, but do not force awkward local SEO phrases like "near me".
   - Never keyword stuff, repeat phrases unnaturally, or flatten the therapist's personality.
9. Keep the output roughly the same length as the original unless a small increase improves clarity or search intent naturally.

Return ONLY the final revised narrative. No explanation, notes, labels, or bullets.
`;

function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getKeywordSupportPattern(keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (/\bonline therapy\b/.test(normalizedKeyword)) {
    return /\b(online|virtual|telehealth)\b/i;
  }

  if (/\banxiety\b/.test(normalizedKeyword)) {
    return /\b(anxiety|anxious|panic)\b/i;
  }

  if (/\btrauma\b/.test(normalizedKeyword)) {
    return /\b(trauma|posttraumatic stress|ptsd)\b/i;
  }

  if (/\bemdr\b/.test(normalizedKeyword)) {
    return /\bemdr\b/i;
  }

  if (/\b(couples|relationship|marriage)\b/.test(normalizedKeyword)) {
    return /\b(couples?|relationship|marriage)\b/i;
  }

  if (/\bfamily\b/.test(normalizedKeyword)) {
    return /\b(family|parenting)\b/i;
  }

  if (/\bdepression\b/.test(normalizedKeyword)) {
    return /\b(depression|depressed)\b/i;
  }

  if (/\b(teen|child|adolescent)\b/.test(normalizedKeyword)) {
    return /\b(teen|adolescent|child|children)\b/i;
  }

  if (/\b(grief|loss|bereave)\b/.test(normalizedKeyword)) {
    return /\b(grief|loss|bereave(?:d|ment)?)\b/i;
  }

  if (/\b(stress|burnout)\b/.test(normalizedKeyword)) {
    return /\b(stress|burnout)\b/i;
  }

  if (/\bocd\b/.test(normalizedKeyword)) {
    return /\b(ocd|obsessive compulsive)\b/i;
  }

  if (/\badhd\b/.test(normalizedKeyword)) {
    return /\b(adhd|attention deficit)\b/i;
  }

  if (/\b(self-esteem|confidence)\b/.test(normalizedKeyword)) {
    return /\b(self-esteem|confidence)\b/i;
  }

  if (/\blife transitions?\b/.test(normalizedKeyword)) {
    return /\b(life transition|life transitions|major change|career change)\b/i;
  }

  return null;
}

function isNarrativeSupportedKeyword(keyword, { narrative, state, license }) {
  const supportPattern = getKeywordSupportPattern(keyword);

  if (!supportPattern) {
    if (
      state
      && (normalizeKeyword(keyword).includes(state.toLowerCase()) || normalizeKeyword(keyword) === `therapy in ${state.toLowerCase()}`)
    ) {
      return true;
    }

    if (license && normalizeKeyword(keyword).includes(license.toLowerCase())) {
      return true;
    }

    return /\b(therapy|therapist|counseling|counselling)\b/i.test(keyword);
  }

  return supportPattern.test(narrative);
}

function getAllowedOrigins() {
  const configured = parseCsv(process.env.ALLOWED_ORIGINS);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || "unknown";
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const entry = requestCounts.get(clientIp);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  entry.count += 1;
  return next();
}

function requireAccessToken(req, res, next) {
  if (!APP_ACCESS_TOKEN) {
    return next();
  }

  const providedToken = req.header("x-app-access-token");
  if (!providedToken || providedToken !== APP_ACCESS_TOKEN) {
    return res.status(401).json({ error: "A valid app access code is required." });
  }

  return next();
}

function buildFallbackSeoHints({ narrative, state, license }) {
  const keywordSet = new Set(semrushInformedKeywordGroups);
  const customKeywords = parseCsv(process.env.SEO_KEYWORDS);

  customKeywords
    .filter((keyword) => isNarrativeSupportedKeyword(keyword, { narrative, state, license }))
    .forEach((keyword) => keywordSet.add(keyword));

  for (const rule of keywordRules) {
    if (rule.pattern.test(narrative)) {
      rule.suggestions.forEach((keyword) => keywordSet.add(keyword));
    }
  }

  if (state) {
    keywordSet.add(`therapy in ${state}`);
    keywordSet.add(`${state} therapist`);
  }

  if (license) {
    keywordSet.add(license);
  }

  return Array.from(keywordSet)
    .filter((keyword) => isNarrativeSupportedKeyword(keyword, { narrative, state, license }))
    .slice(0, 16);
}

function normalizeKeyword(value) {
  return value.trim().toLowerCase();
}

function buildSeedPhrases({ narrative }) {
  const seedSet = new Set();

  for (const rule of keywordRules) {
    if (rule.pattern.test(narrative)) {
      rule.suggestions.forEach((keyword) => seedSet.add(keyword));
    }
  }

  if (seedSet.size === 0) {
    ["therapy", "therapist", "counseling"].forEach((keyword) => seedSet.add(keyword));
  }

  return Array.from(seedSet).slice(0, 4);
}

function parseSemrushRows(rawText) {
  const rows = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length <= 1) {
    return [];
  }

  if (rows[0].startsWith("ERROR")) {
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

function getSnapshotKeywords(seedPhrase) {
  if (!semrushSnapshot.loaded) {
    return [];
  }

  const normalizedSeed = normalizeKeyword(seedPhrase);
  const exactMatch = semrushSnapshot.keywordsBySeed.get(normalizedSeed);
  if (exactMatch && exactMatch.length > 0) {
    return exactMatch;
  }

  const fallbackMatches = semrushSnapshot.allKeywords.filter((entry) => {
    const keyword = normalizeKeyword(entry.keyword);
    return normalizedSeed
      .split(/\s+/)
      .some((word) => word.length > 3 && keyword.includes(word));
  });

  return fallbackMatches.slice(0, SEMRUSH_RESULTS_PER_SEED);
}

function keywordHasBlockedFragment(keyword) {
  const lowerKeyword = normalizeKeyword(keyword);
  return blockedKeywordFragments.some((fragment) => lowerKeyword.includes(fragment));
}

function isRelevantSeoKeyword(keyword) {
  const lowerKeyword = normalizeKeyword(keyword);

  if (!lowerKeyword || keywordHasBlockedFragment(lowerKeyword)) {
    return false;
  }

  return /\b(therapy|therapist|counseling|counselling|counselor|counsellor|emdr|mental health)\b/i.test(lowerKeyword);
}

function scoreSeoKeyword({ keyword, searchVolume, difficulty }, { narrative, state, seedPhrase }) {
  const lowerKeyword = normalizeKeyword(keyword);
  const lowerNarrative = narrative.toLowerCase();
  let score = 0;

  if (/\b(therapy|therapist)\b/.test(lowerKeyword)) {
    score += 8;
  }

  if (/\b(counseling|counselling|counselor|counsellor)\b/.test(lowerKeyword)) {
    score += 7;
  }

  if (/\bonline|virtual|telehealth\b/.test(lowerKeyword) && /\bonline|virtual|telehealth\b/.test(lowerNarrative)) {
    score += 4;
  }

  if (/\bnear me\b/.test(lowerKeyword)) {
    score -= 6;
  }

  if (state && lowerKeyword.includes(state.toLowerCase())) {
    score += 3;
  }

  if (seedPhrase && lowerKeyword.includes(seedPhrase.toLowerCase())) {
    score += 6;
  }

  for (const rule of keywordRules) {
    if (rule.pattern.test(lowerNarrative)) {
      for (const suggestion of rule.suggestions) {
        const suggestionWords = suggestion.toLowerCase().split(/\s+/);
        if (suggestionWords.some((word) => word.length > 3 && lowerKeyword.includes(word))) {
          score += 4;
          break;
        }
      }
    }
  }

  score += Math.min(12, Math.log10(searchVolume + 1) * 4);
  score -= Math.min(4, difficulty / 25);

  return score;
}

async function fetchSemrushKeywords(seedPhrase) {
  const cacheKey = `${SEMRUSH_DATABASE}:${normalizeKeyword(seedPhrase)}`;
  const cached = seoKeywordCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.keywords;
  }

  const snapshotKeywords = getSnapshotKeywords(seedPhrase);
  if (snapshotKeywords.length > 0) {
    seoKeywordCache.set(cacheKey, {
      keywords: snapshotKeywords,
      expiresAt: Date.now() + SEO_CACHE_TTL_MS,
    });
    return snapshotKeywords;
  }

  if (!SEMRUSH_API_KEY) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEMRUSH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      type: "phrase_related",
      key: SEMRUSH_API_KEY,
      phrase: seedPhrase,
      database: SEMRUSH_DATABASE,
      display_limit: String(SEMRUSH_RESULTS_PER_SEED),
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
      throw new Error(text || "Semrush request failed.");
    }

    const keywords = parseSemrushRows(text);
    seoKeywordCache.set(cacheKey, {
      keywords,
      expiresAt: Date.now() + SEO_CACHE_TTL_MS,
    });
    return keywords;
  } catch (error) {
    const message = error?.name === "AbortError"
      ? `Semrush request timed out for "${seedPhrase}".`
      : `Semrush request failed for "${seedPhrase}": ${error.message}`;
    console.error(message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function buildSeoHints({ narrative, state, license }) {
  const fallbackHints = buildFallbackSeoHints({ narrative, state, license });

  if (!SEMRUSH_API_KEY && !semrushSnapshot.loaded) {
    return fallbackHints;
  }

  const seedPhrases = buildSeedPhrases({ narrative });
  if (seedPhrases.length === 0) {
    return fallbackHints;
  }

  const semrushResults = await Promise.all(seedPhrases.map((seedPhrase) => fetchSemrushKeywords(seedPhrase)));
  const rankedKeywords = semrushResults
    .flatMap((keywords, index) => keywords.map((entry) => ({
      ...entry,
      seedPhrase: seedPhrases[index],
    })))
    .filter((entry) => isRelevantSeoKeyword(entry.keyword))
    .filter((entry) => isNarrativeSupportedKeyword(entry.keyword, { narrative, state, license }))
    .map((entry) => ({
      keyword: entry.keyword,
      score: scoreSeoKeyword(entry, {
        narrative,
        state,
        seedPhrase: entry.seedPhrase,
      }),
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.keyword);

  return Array.from(new Set([...rankedKeywords, ...fallbackHints])).slice(0, 16);
}

async function buildUserPrompt({ narrative, state, license }) {
  const seoHints = await buildSeoHints({ narrative, state, license });
  const contextLines = [
    state ? `Selected location context: ${state}` : null,
    license ? `Selected license context: ${license}` : null,
    seoHints.length > 0 ? `SEO keyword themes: ${seoHints.join(", ")}` : null,
  ].filter(Boolean);

  return [
    contextLines.length > 0 ? `Useful context:\n${contextLines.map((line) => `- ${line}`).join("\n")}` : null,
    "Original narrative:",
    narrative,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputItems = Array.isArray(data?.output) ? data.output : [];

  for (const item of outputItems) {
    const contents = Array.isArray(item?.content) ? item.content : [];

    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return "";
}

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

setInterval(() => {
  const now = Date.now();

  for (const [clientIp, entry] of requestCounts.entries()) {
    if (now > entry.resetAt) {
      requestCounts.delete(clientIp);
    }
  }

  for (const [cacheKey, entry] of seoKeywordCache.entries()) {
    if (now > entry.expiresAt) {
      seoKeywordCache.delete(cacheKey);
    }
  }
}, RATE_LIMIT_WINDOW_MS).unref();

app.set("trust proxy", 1);
app.use((req, res, next) => {
  setNoStoreHeaders(res);
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed"));
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-App-Access-Token"],
  })
);
app.use(express.json({ limit: "24kb" }));
app.use(rateLimit);

app.post("/api/clean-narrative", requireAccessToken, async (req, res) => {
  const { narrative, state, license } = req.body ?? {};

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI is not configured on the server." });
  }

  if (!narrative || typeof narrative !== "string") {
    return res.status(400).json({ error: "Narrative required" });
  }

  const trimmedNarrative = narrative.trim();
  if (!trimmedNarrative) {
    return res.status(400).json({ error: "Narrative required" });
  }

  if (trimmedNarrative.length > MAX_NARRATIVE_CHARS) {
    return res.status(400).json({
      error: `Narratives must be ${MAX_NARRATIVE_CHARS} characters or fewer.`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        instructions: systemPrompt,
        input: await buildUserPrompt({
          narrative: trimmedNarrative,
          state: typeof state === "string" ? state : "",
          license: typeof license === "string" ? license : "",
        }),
        text: {
          format: {
            type: "text",
          },
        },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || "OpenAI request failed while processing the narrative.";
      console.error("OpenAI API error:", errorMessage);
      return res.status(502).json({ error: "The AI service could not process this request." });
    }

    const cleaned = extractResponseText(data);
    if (!cleaned) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    return res.json({ cleaned });
  } catch (err) {
    const errorMessage = err.name === "AbortError"
      ? "OpenAI request timed out."
      : "Failed to clean narrative.";
    console.error("Error calling OpenAI API:", errorMessage);
    return res.status(500).json({ error: "Failed to clean narrative" });
  } finally {
    clearTimeout(timeout);
  }
});

app.use((err, req, res, next) => {
  if (err?.message === "Origin not allowed") {
    return res.status(403).json({ error: "This origin is not allowed to access the API." });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
