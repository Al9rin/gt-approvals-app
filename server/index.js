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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
// Reasoning model for SEO/geo modes — reasons through keyword placement more naturally
const OPENAI_SEO_MODEL = process.env.OPENAI_SEO_MODEL || "o4-mini";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const MAX_NARRATIVE_CHARS = Number(process.env.MAX_NARRATIVE_CHARS || 6000);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20_000);
const OPENAI_SEO_TIMEOUT_MS = Number(process.env.OPENAI_SEO_TIMEOUT_MS || 90_000);
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
  {
    pattern: /\b(somatic|body-based|body awareness|somatic experiencing)\b/i,
    suggestions: ["somatic therapy", "somatic experiencing"],
  },
  {
    pattern: /\b(ifs|internal family systems)\b/i,
    suggestions: ["IFS therapy", "internal family systems therapy"],
  },
  {
    pattern: /\b(mindfulness|mbsr|mindfulness-based)\b/i,
    suggestions: ["mindfulness-based therapy", "mindfulness counseling"],
  },
  {
    pattern: /\b(person-centered|humanistic|client-centered)\b/i,
    suggestions: ["person-centered therapy", "humanistic therapy"],
  },
  {
    pattern: /\b(perinatal|postpartum|prenatal|postnatal)\b/i,
    suggestions: ["perinatal mental health", "postpartum therapy"],
  },
  {
    pattern: /\b(lgbtq|queer|gender identity|gender.affirming|nonbinary|transgender)\b/i,
    suggestions: ["LGBTQ therapy", "gender-affirming therapy"],
  },
  {
    pattern: /\b(cptsd|complex trauma|complex ptsd)\b/i,
    suggestions: ["complex trauma therapy", "CPTSD therapy", "trauma-informed therapy"],
  },
  {
    pattern: /\b(teletherapy|video sessions|video therapy|telehealth sessions)\b/i,
    suggestions: ["teletherapy", "online therapy"],
  },
  {
    pattern: /\b(bipoc|multicultural|culturally|cultural humility|poc therapist)\b/i,
    suggestions: ["multicultural therapy", "culturally responsive therapy"],
  },
  {
    pattern: /\b(older adults|seniors|elderly|aging)\b/i,
    suggestions: ["therapy for older adults", "senior therapy"],
  },
];

const licenseKeywordMap = {
  LMFT:  ["marriage and family therapy", "couples therapy", "family therapy"],
  LCSW:  ["licensed clinical social worker", "social work therapy"],
  LPC:   ["licensed professional counselor", "individual therapy"],
  LPCC:  ["licensed professional clinical counselor", "individual therapy"],
  MFT:   ["marriage and family therapy", "couples counseling"],
  LMHC:  ["licensed mental health counselor", "mental health counseling"],
  LCPC:  ["licensed clinical professional counselor", "counseling"],
  LSW:   ["licensed social worker", "counseling"],
  PhD:   ["psychologist", "psychology"],
  PsyD:  ["psychologist", "psychology"],
  LCAT:  ["creative arts therapist", "expressive arts therapy"],
  ATR:   ["art therapist", "art therapy"],
  PMHNP: ["psychiatric mental health nurse practitioner", "mental health"],
  AMFT:  ["associate marriage and family therapist", "couples therapy"],
};

const blockedKeywordFragments = [
  "talk therapy",
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

const acronymExpansionRules = [
  {
    acronym: "OCD",
    supportPattern: /\b(obsessive-compulsive|OCD)\b/i,
    expansion: "obsessive-compulsive challenges (OCD)",
    expandedPattern: /\bobsessive[- ]compulsive(?:\s+(?:disorder|condition|issue|diagnosis|challenge|challenges))?\s*\(OCD\)/i,
    disorderPattern: /\bobsessive[- ]compulsive disorder\s*\(OCD\)/gi,
  },
  {
    acronym: "PTSD",
    supportPattern: /\b(posttraumatic stress|post-traumatic stress|PTSD)\b/i,
    expansion: "posttraumatic stress (PTSD)",
    expandedPattern: /\bpost[- ]?traumatic stress(?:\s+(?:disorder|condition|issue|diagnosis|challenge|challenges))?\s*\(PTSD\)/i,
    disorderPattern: /\bpost[- ]?traumatic stress disorder\s*\(PTSD\)/gi,
  },
  {
    acronym: "ADHD",
    supportPattern: /\b(attention[- ]deficit\/?[ -]?hyperactivity|ADHD)\b/i,
    expansion: "attention-deficit hyperactivity (ADHD)",
    expandedPattern: /\battention[- ]deficit\/?[ -]?hyperactivity(?:\s+(?:disorder|condition|issue|diagnosis|challenge|challenges))?\s*\(ADHD\)/i,
    disorderPattern: /\battention[- ]deficit\/?[ -]?hyperactivity disorder\s*\(ADHD\)/gi,
  },
  {
    acronym: "CBT",
    supportPattern: /\b(cognitive behavioral therapy|CBT)\b/i,
    expansion: "cognitive behavioral therapy (CBT)",
    expandedPattern: /\bcognitive behavioral therapy\s*\(CBT\)/i,
  },
  {
    acronym: "DBT",
    supportPattern: /\b(dialectical behavior therapy|DBT)\b/i,
    expansion: "dialectical behavior therapy (DBT)",
    expandedPattern: /\bdialectical behavior therapy\s*\(DBT\)/i,
  },
  {
    acronym: "EMDR",
    supportPattern: /\b(eye movement desensitization and reprocessing|EMDR)\b/i,
    expansion: "eye movement desensitization and reprocessing (EMDR)",
    expandedPattern: /\beye movement desensitization and reprocessing\s*\(EMDR\)/i,
  },
  {
    acronym: "ERP",
    supportPattern: /\b(exposure and response prevention|ERP)\b/i,
    expansion: "exposure and response prevention (ERP)",
    expandedPattern: /\bexposure and response prevention\s*\(ERP\)/i,
  },
];

// License abbreviation → Title Case full form on first use
const licenseExpansionRules = [
  {
    acronym: "LMFT",
    supportPattern: /\bLMFT\b/i,
    expansion: "Licensed Marriage and Family Therapist (LMFT)",
    expandedPattern: /\bLicensed Marriage and Family Therapist\s*\(LMFT\)/i,
  },
  {
    acronym: "LCSW",
    supportPattern: /\bLCSW\b/i,
    expansion: "Licensed Clinical Social Worker (LCSW)",
    expandedPattern: /\bLicensed Clinical Social Worker\s*\(LCSW\)/i,
  },
  {
    acronym: "LMHC",
    supportPattern: /\bLMHC\b/i,
    expansion: "Licensed Mental Health Counselor (LMHC)",
    expandedPattern: /\bLicensed Mental Health Counselor\s*\(LMHC\)/i,
  },
  {
    acronym: "LPC",
    supportPattern: /\bLPC\b/i,
    expansion: "Licensed Professional Counselor (LPC)",
    expandedPattern: /\bLicensed Professional Counselor\s*\(LPC\)/i,
  },
  {
    acronym: "LPCC",
    supportPattern: /\bLPCC\b/i,
    expansion: "Licensed Professional Clinical Counselor (LPCC)",
    expandedPattern: /\bLicensed Professional Clinical Counselor\s*\(LPCC\)/i,
  },
  {
    acronym: "AMFT",
    supportPattern: /\bAMFT\b/i,
    expansion: "Associate Marriage and Family Therapist (AMFT)",
    expandedPattern: /\bAssociate Marriage and Family Therapist\s*\(AMFT\)/i,
  },
  {
    acronym: "ACSW",
    supportPattern: /\bACSW\b/i,
    expansion: "Associate Clinical Social Worker (ACSW)",
    expandedPattern: /\bAssociate Clinical Social Worker\s*\(ACSW\)/i,
  },
  {
    acronym: "PMHNP",
    supportPattern: /\bPMHNP\b/i,
    expansion: "Psychiatric Mental Health Nurse Practitioner (PMHNP)",
    expandedPattern: /\bPsychiatric Mental Health Nurse Practitioner\s*\(PMHNP\)/i,
  },
  {
    acronym: "MFT",
    supportPattern: /\bMFT\b/i,
    expansion: "Marriage and Family Therapist (MFT)",
    expandedPattern: /\bMarriage and Family Therapist\s*\(MFT\)/i,
  },
];

const unsupportedModalityRules = [
  {
    supportPattern: /\b(exposure and response prevention|ERP)\b/i,
    clausePatterns: [
      /\s*,?\s*whether you['’]re looking for[^.?!;]*?(?:exposure and response prevention\s*\(ERP\)|ERP)[^.?!;]*/gi,
      /\s*,?\s*if you['’]re looking for[^.?!;]*?(?:exposure and response prevention\s*\(ERP\)|ERP)[^.?!;]*/gi,
    ],
    removalPatterns: [
      /\s*,?\s*including exposure and response prevention\s*\(ERP\)\s+therapy/gi,
      /\s*,?\s*including ERP therapy/gi,
      /\s*,?\s*as well as exposure and response prevention\s*\(ERP\)\s+therapy/gi,
      /\s*,?\s*as well as ERP therapy/gi,
      /\bexposure and response prevention\s*\(ERP\)\s+therapy\b/gi,
      /\bERP therapy\b/gi,
      /\bexposure and response prevention\s*\(ERP\)\b/gi,
      /\bERP\b/gi,
    ],
  },
  {
    supportPattern: /\b(eye movement desensitization and reprocessing|EMDR)\b/i,
    clausePatterns: [
      /\s*,?\s*whether you['’]re looking for[^.?!;]*?(?:eye movement desensitization and reprocessing\s*\(EMDR\)|EMDR)[^.?!;]*/gi,
      /\s*,?\s*if you['’]re looking for[^.?!;]*?(?:eye movement desensitization and reprocessing\s*\(EMDR\)|EMDR)[^.?!;]*/gi,
    ],
    removalPatterns: [
      /\s*,?\s*including eye movement desensitization and reprocessing\s*\(EMDR\)\s+therapy/gi,
      /\s*,?\s*including EMDR therapy/gi,
      /\s*,?\s*as well as eye movement desensitization and reprocessing\s*\(EMDR\)\s+therapy/gi,
      /\s*,?\s*as well as EMDR therapy/gi,
      /\beye movement desensitization and reprocessing\s*\(EMDR\)\s+therapy\b/gi,
      /\bEMDR therapy\b/gi,
      /\beye movement desensitization and reprocessing\s*\(EMDR\)\b/gi,
      /\bEMDR\b/gi,
    ],
  },
  {
    supportPattern: /\b(cognitive behavioral therapy|CBT)\b/i,
    clausePatterns: [
      /\s*,?\s*whether you['’]re looking for[^.?!;]*?(?:cognitive behavioral therapy\s*\(CBT\)|CBT)[^.?!;]*/gi,
      /\s*,?\s*if you['’]re looking for[^.?!;]*?(?:cognitive behavioral therapy\s*\(CBT\)|CBT)[^.?!;]*/gi,
    ],
    removalPatterns: [
      /\s*,?\s*including cognitive behavioral therapy\s*\(CBT\)/gi,
      /\s*,?\s*including CBT/gi,
      /\s*,?\s*as well as cognitive behavioral therapy\s*\(CBT\)/gi,
      /\s*,?\s*as well as CBT/gi,
      /\bcognitive behavioral therapy\s*\(CBT\)\b/gi,
      /\bCBT\b/gi,
    ],
  },
];

const supportedServicePhraseRules = [
  {
    phrases: [
      /\banxiety therapy\b/gi,
      /\banxiety counseling\b/gi,
    ],
    supportPattern: /\b(anxiety|anxious|panic)\b/i,
  },
  {
    phrases: [
      /\bobsessive-compulsive challenges\s*\(OCD\)\s+therapy\b/gi,
      /\bobsessive-compulsive therapy\b/gi,
      /\bOCD therapy\b/gi,
    ],
    supportPattern: /\b(ocd|obsessive compulsive)\b/i,
  },
  {
    phrases: [
      /\bcouple therapy\b/gi,
      /\bcouples therapy\b/gi,
      /\bcouples counseling\b/gi,
      /\brelationship counseling\b/gi,
    ],
    supportPattern: /\b(couples?|relationship|marriage)\b/i,
  },
  {
    phrases: [
      /\bfamily therapy\b/gi,
      /\bfamily counseling\b/gi,
      /\bfamily counselling\b/gi,
      /\bfamily therapist\b/gi,
      /\bfamily counseling services\b/gi,
    ],
    supportPattern: /\b(family|parenting)\b/i,
  },
  {
    phrases: [
      /\bonline therapy\b/gi,
      /\bvirtual therapy\b/gi,
    ],
    supportPattern: /\b(online|virtual|telehealth)\b/i,
  },
  {
    phrases: [
      /\btrauma therapy\b/gi,
    ],
    supportPattern: /\b(trauma|posttraumatic stress|ptsd)\b/i,
  },
  {
    phrases: [
      /\bgrief counseling\b/gi,
      /\bgrief therapy\b/gi,
    ],
    supportPattern: /\b(grief|loss|bereave(?:d|ment)?)\b/i,
  },
  {
    phrases: [
      /\bstress counseling\b/gi,
      /\bburnout therapy\b/gi,
    ],
    supportPattern: /\b(stress|burnout)\b/i,
  },
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

const editorialPrompt = `
You are a narrative compliance assistant for GoodTherapy. Your task is to lightly refine therapist marketing narratives so they read cleanly, stay true to the therapist's voice, and follow GoodTherapy editorial guidance.

Follow these instructions exactly:

1. Correct grammar, punctuation, spelling, and obvious clarity issues. Ensure every sentence is grammatically complete: verbs like "offer" or "provide" must have an object (e.g. "I offer therapy when..." or "I'm a therapist who offers support when...", not "who offers when it's a good fit" without an object). Fix run-on or fragmented clauses so each sentence reads as a complete thought.
2. Preserve the therapist's original voice, warmth, rhythm, and point of view.
3. Keep the writing casual, natural, and human. Do not make it sound corporate, generic, stiff, or overly polished.
4. Do NOT change the meaning, add unsupported claims, invent specialties, or rewrite the structure unless clarity requires it. Do not add phrases or concepts that are not in the original narrative (e.g. do not add "when it's a good fit", "we'll move at a pace", or similar stock phrases unless the original text explicitly says something equivalent).
5. Never introduce a new modality, specialty, diagnosis, acronym, treatment approach, or service line unless it is explicitly supported by the original narrative or selected context.
6. Apply GoodTherapy editorial rules, including:
   - Expand all acronyms on first use with correct capitalization and terminology.
   - For example: obsessive-compulsive challenges (OCD), posttraumatic stress (PTSD), attention-deficit hyperactivity (ADHD), cognitive behavioral therapy (CBT), exposure and response prevention (ERP), and eye movement desensitization and reprocessing (EMDR).
   - Do not include the word "disorder" as part of expanded mental health terms.
   - Replace unnecessary uses of "disorder" with better alternatives such as issue, condition, diagnosis, or challenge.
   - Use people-first language unless identity-first language is preferred by that community.
   - Use lowercase for therapy types and mental health issues unless standard capitalization is required.
   - Avoid stigmatizing, cold, or clinical-sounding labels.
   - Use the Oxford comma.
   - Avoid em dashes (—); use commas, parentheses, or rephrase instead.
   - If degrees and licenses are listed together, put degrees first.
   - When mentioning a license abbreviation (LMFT, LCSW, LPC, LMHC, LPCC, AMFT, PMHNP, etc.) for the first time, write the full credential name in Title Case followed by the abbreviation in parentheses. Example: "Licensed Marriage and Family Therapist (LMFT)". After first use, the abbreviation alone is fine.
7. Do not add SEO phrasing, keyword themes, service lists, or local SEO language.
8. Keep the output roughly the same length as the original unless a small increase improves clarity naturally.
9. Do not use the phrase "talk therapy" unless it explicitly appears in the original narrative. If it does appear, you may preserve it naturally. Do not add it if it is not there.
10. Do not repeat a key specialty or descriptor from the opening sentence in the body. If the opening already names a specialty, refer to it differently or omit the restatement.
11. If therapist website content is provided in the context, actively extract relevant facts from it (specialties, services, populations served, locations, credentials, years of experience) and naturally incorporate them into the narrative where they add truthful, useful detail. Synthesize the information into the therapist's voice — do not quote the website verbatim.

Return ONLY the final revised narrative. No explanation, notes, labels, or bullets.
`;

const seoPrompt = `You are a narrative compliance assistant for GoodTherapy. Your task is to refine therapist marketing narratives so they read cleanly, stay true to the therapist's voice, follow GoodTherapy editorial guidance, improve search discoverability, and support AI citation readiness — all without sounding SEO-written.

Follow these instructions exactly:

1. Correct grammar, punctuation, spelling, and obvious clarity issues. Ensure every sentence is grammatically complete.
2. Do NOT join two independent clauses with "and" when each could stand alone as its own sentence. Use a period or semicolon instead. CORRECT: "My clients typically heal in 6 to 22 sessions. Therapy does not have to be a long-term commitment." WRONG: "...sessions and therapy does not have to be a long-term commitment."
3. Preserve the therapist's original voice, warmth, rhythm, and point of view. Keep it casual, natural, and human — not corporate or overly polished.
4. Do NOT change the meaning, add unsupported claims, or invent specialties. Do not add phrases not in the original (e.g. do not add "when it's a good fit", "we'll move at a pace", or similar).
5. Never introduce a new modality, specialty, diagnosis, or acronym unless explicitly supported by the original narrative or provided context.
6. Do NOT create a new standalone sentence just to introduce an SEO phrase. Keywords must fit naturally into existing sentence structure only. If a keyword cannot be woven in without writing a brand-new sentence the therapist did not write, skip that keyword.
7. Apply GoodTherapy editorial rules, including:
   - Expand all acronyms on first use with correct capitalization and terminology.
   - For example: obsessive-compulsive challenges (OCD), posttraumatic stress (PTSD), attention-deficit hyperactivity (ADHD), cognitive behavioral therapy (CBT), exposure and response prevention (ERP), and eye movement desensitization and reprocessing (EMDR).
   - Do not include the word "disorder" as part of expanded mental health terms.
   - Replace unnecessary uses of "disorder" with better alternatives such as issue, condition, diagnosis, or challenge.
   - Use people-first language unless identity-first language is preferred by that community.
   - Use lowercase for therapy types and mental health issues unless standard capitalization is required.
   - Avoid stigmatizing, cold, or clinical-sounding labels.
   - Use the Oxford comma.
   - Avoid em dashes (—); use commas, parentheses, or rephrase instead.
   - If degrees and licenses are listed together, put degrees first.
   - When mentioning a license abbreviation (LMFT, LCSW, LPC, LMHC, LPCC, AMFT, PMHNP, etc.) for the first time, write the full credential name in Title Case followed by the abbreviation in parentheses. Example: "Licensed Marriage and Family Therapist (LMFT)". After first use, the abbreviation alone is fine.
8. Apply SEO enhancement in a natural, truthful way:
   - Work in 3 to 5 relevant phrases from the allowed list. Integrate them by SUBSTITUTION — replace the therapist's existing description with the SEO phrase where it fits perfectly — or embed mid-sentence where the phrase completes a thought already in motion.
   - NEVER append a keyword phrase to the tail of a sentence using "through [keyword]", "including [keyword]", "via [keyword]", or similar trailing constructions unless that exact construction was already in the original text. Tacking "through couples therapy" or "through relationship counseling" onto an existing sentence's ending is forbidden.
   - When several closely related keyword phrases all describe the same topic (e.g. "couples counseling", "relationship counseling", "couples therapy", "marriage counseling"), do NOT scatter them across multiple sentences. Instead, either: (a) use the single best-fitting one as a natural substitution, OR (b) group two of them naturally in one sentence where the therapist already lists or describes those services (e.g. "Whether you're navigating relationship challenges or looking for couples counseling or marriage therapy, we're here."). Never force more than two of these synonyms into the narrative.
   - Only use phrases from the provided allowed list that are supported by the original narrative or context.
   - If location or license context is provided, you may reinforce it once in a natural way; do not force phrases like "near me".
9. Opening sentence quality:
   - If the therapist's name appears anywhere in the narrative, the FIRST sentence MUST begin with that name. Connect the name naturally to their credential and location in one flowing sentence. Example: "My name is Sarah Chen, and I am a Licensed Marriage and Family Therapist (LMFT) serving clients in Austin, Texas." or "I'm David Park, a Licensed Clinical Social Worker (LCSW) providing anxiety therapy and trauma therapy in Seattle, Washington." NEVER lead with a credential, title, or job description and then introduce the name as a separate sentence.
   - If no name is present, lead with the credential and specialty instead.
   - The opening sentence must include: name (if known), credential type in full, primary specialty or focus, and service area or delivery method. It must function as a standalone search snippet.
   - Avoid vague openers like "I help people..." that convey no credentials or geography.
10. Location — do NOT repeat:
    - Mention the city/state at most once in a natural context. If the city appears in the opening sentence, do NOT write a separate sentence immediately after that restates the same location as a standalone geographic fact. Combine instead: "I am an LMFT in Denver, Colorado, offering in-person and online therapy" — not two separate sentences saying "in Denver" and then "I see clients in Denver."
11. E-E-A-T trust signals:
    - Preserve all mentions of years of experience, training, certifications, and credential language. These are trust signals; do not soften or remove them.
12. Entity clarity for AI citation:
    - State key facts explicitly. Use full city and state name. If service delivery is mentioned (in-person, online, or both), state it explicitly in a natural sentence. Write out full modality names at least once.
13. Keep the output roughly the same length as the original unless a small increase improves clarity or search intent naturally.
14. Do not use the phrase "talk therapy" unless it explicitly appears in the original narrative. If it does appear, you may preserve it naturally. Do not add it if it is not there.
15. Do not repeat a key specialty or descriptor from the opening sentence in the body. If the opening already names a specialty, refer to it differently or omit the restatement in subsequent sentences.
16. If city names are provided in the context under "Cities served", you MUST naturally include at least one of them somewhere in the narrative. Do not skip them.
17. If therapist website content is provided in the context, extract relevant facts (specialties, challenges treated, methods, populations served, credentials) and weave them into the narrative naturally — as if the therapist themselves wrote it. Do NOT produce a list or mechanical enumeration of extracted facts. The result must read as a cohesive, first-person narrative paragraph, not a data dump.
18. Natural sentence structure: every sentence must flow conversationally. Avoid constructions like "[Credential] offering to [population] in [city]. I'm [Name]." — credentials must be attached to the person, not floated as a standalone subject. Bad: "Licensed Clinical Social Worker (LCSW) offering services in Delaware." Good: "I am a Licensed Clinical Social Worker (LCSW) serving clients in Wilmington, Delaware."

OUTPUT FORMAT: Return a single JSON object with exactly two keys:
- "narrative": the full revised narrative as a string.
- "editsSummary": an array of bullet points describing all changes made. Put the keyword bullet FIRST. You MUST include:
  (1) As the first bullet: "Keyword phrases used: [phrase1], [phrase2], ..." or "Keyword phrases used: (none—no natural fit from allowed list)".
  (2) Remaining bullets covering: opening sentence, grammar and punctuation, structure or clarity, any other notable changes.
  Aim for 4 to 8 bullets total. You may wrap the JSON in a markdown code block (\`\`\`json ... \`\`\`) if you prefer.
`;

const geoPrompt = `You are a narrative compliance assistant for GoodTherapy with expertise in generative engine optimization (GEO). Your task is to rewrite therapist marketing narratives so they are clearly structured for AI citation, entity extraction, and direct-answer engines — while preserving the therapist's authentic voice and following GoodTherapy editorial standards.

Follow these instructions exactly:

1. Correct grammar, punctuation, spelling, and obvious clarity issues. Ensure every sentence is grammatically complete. Fix run-on or fragmented clauses.
2. Preserve the therapist's original voice, warmth, and authenticity. Do not make it sound corporate or generic.
3. Apply GoodTherapy editorial rules:
   - Expand all acronyms on first use with correct capitalization and terminology.
   - For example: obsessive-compulsive challenges (OCD), posttraumatic stress (PTSD), attention-deficit hyperactivity (ADHD), cognitive behavioral therapy (CBT), exposure and response prevention (ERP), and eye movement desensitization and reprocessing (EMDR).
   - Do not include the word "disorder" as part of expanded mental health terms.
   - Use people-first language unless identity-first language is preferred by that community.
   - Use lowercase for therapy types and mental health issues unless standard capitalization is required.
   - Avoid stigmatizing or clinical-sounding labels.
   - Use the Oxford comma.
   - Avoid em dashes (—); use commas, parentheses, or rephrase instead.
   - If degrees and licenses are listed together, put degrees first.
   - When mentioning a license abbreviation (LMFT, LCSW, LPC, LMHC, LPCC, AMFT, PMHNP, etc.) for the first time, write the full credential name in Title Case followed by the abbreviation in parentheses. Example: "Licensed Marriage and Family Therapist (LMFT)". After first use, the abbreviation alone is fine.
4. Entity-rich opening sentence:
   - If the therapist's name appears in the narrative, the FIRST sentence MUST begin with that name and connect naturally to their credential and location. Example: "My name is Sarah Chen, and I am a Licensed Marriage and Family Therapist (LMFT) serving clients in Austin, Texas." NEVER lead with a credential or title as a standalone subject then introduce the name as a separate follow-up sentence.
   - If no name is present, lead with the credential and specialty.
   - The sentence must include: name (if known), full credential name, primary specialty or population, and geographic location or delivery method. It must work as a self-contained factual statement that an AI can cite.
5. Explicit fact statements: State all key facts in complete, declarable sentences. Do not imply credentials, location, or specialties — state them directly. For example: "I am a licensed clinical social worker providing anxiety therapy and trauma therapy in Denver, Colorado, with over 10 years of experience."
6. Full modality names: Write out the complete name of every therapy approach at least once (e.g. "eye movement desensitization and reprocessing (EMDR)" not just "EMDR"). License type should be stated in full at least once.
7. Geographic anchors: Use the full city and state name whenever location is mentioned. If the therapist serves multiple cities, list them explicitly. If online therapy is offered, state it clearly in a complete sentence (e.g. "I also offer online therapy to clients throughout [state].").
8. Service delivery statement: Explicitly state whether sessions are in-person, online, or both in at least one sentence.
9. E-E-A-T trust signals: Preserve and surface all mentions of years of experience, training programs, certifications, clinical supervision, and credentials. These must appear in specific, verifiable statements.
10. Do NOT add SEO keyword density, keyword stuffing, or phrases that exist only to match search queries. The goal is factual clarity and AI-citation readiness, not keyword volume.
11. Do NOT add unsupported claims, invent specialties, or introduce modalities not mentioned in the original narrative or provided context.
12. Keep the output roughly the same length or slightly longer than the original if additional explicit fact statements are needed for clarity.
13. Do not use the phrase "talk therapy" unless it explicitly appears in the original narrative. If it does appear, you may preserve it naturally. Do not add it if it is not there.
14. Do not repeat a key specialty or descriptor from the opening sentence in the body. If the opening already names a specialty, refer to it differently or omit the restatement in subsequent sentences.
15. If city names are provided in the context under "Cities served", you MUST naturally include at least one of them somewhere in the narrative. Do not skip them.
16. If therapist website content is provided in the context, extract relevant facts (specialties, challenges treated, methods, populations served, credentials) and weave them into the narrative as natural first-person sentences. Do NOT produce a list or mechanical enumeration of extracted facts. The result must read as a cohesive, flowing narrative — not a data dump.
17. Natural sentence structure: every sentence must flow conversationally. Credentials must always be attached to the person, never floated as a standalone grammatical subject. Bad: "Licensed Clinical Social Worker (LCSW) offering services in Delaware. I'm Azhar Waheed." Good: "My name is Azhar Waheed, and I am a Licensed Clinical Social Worker (LCSW) serving clients in Wilmington, Delaware and Philadelphia, Pennsylvania."

OUTPUT FORMAT: Return a single JSON object with exactly two keys:
- "narrative": the full revised narrative as a string.
- "editsSummary": an array of bullet points describing all changes made. You MUST include:
  (1) As the first bullet: "Mode: AI-Ready / GEO"
  (2) Bullets covering: opening sentence rewrite, explicit fact statements added, geographic anchors used, service delivery statement, E-E-A-T signals preserved or surfaced, GoodTherapy editorial corrections, and any other notable changes.
  Aim for 4 to 8 bullets total. You may wrap the JSON in a markdown code block (\`\`\`json ... \`\`\`) if you prefer.
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

    if (license && licenseKeywordMap[license] &&
        licenseKeywordMap[license].some((kw) => normalizeKeyword(kw) === normalizeKeyword(keyword))) {
      return true;
    }

    return /\b(therapy|therapist|counseling|counselling|psychologist|psychology|mental health)\b/i.test(keyword);
  }

  return supportPattern.test(narrative);
}

function ensureFirstAcronymExpansion(text, rule) {
  if (!rule.supportPattern.test(text)) {
    return text;
  }

  if (rule.disorderPattern) {
    text = text.replace(rule.disorderPattern, rule.expansion);
  }

  if (rule.expandedPattern.test(text)) {
    return text.replace(rule.expandedPattern, rule.expansion);
  }

  const acronymPattern = new RegExp(`\\b${rule.acronym}\\b`, "i");
  return text.replace(acronymPattern, rule.expansion);
}

function stripUnsupportedModalities(text, narrative) {
  let sanitized = text;

  for (const rule of unsupportedModalityRules) {
    if (rule.supportPattern.test(narrative)) {
      continue;
    }

    for (const pattern of rule.clausePatterns || []) {
      sanitized = sanitized.replace(pattern, "");
    }

    for (const pattern of rule.removalPatterns) {
      sanitized = sanitized.replace(pattern, "");
    }
  }

  return sanitized;
}

function stripUnsupportedServicePhrases(text, narrative) {
  let sanitized = text;

  for (const rule of supportedServicePhraseRules) {
    if (rule.supportPattern.test(narrative)) {
      continue;
    }

    for (const pattern of rule.phrases) {
      sanitized = sanitized.replace(pattern, "");
    }
  }

  return sanitized;
}

function cleanupNarrativeText(text) {
  // Process each paragraph separately to preserve line breaks
  return text
    .split(/(\r?\n\r?\n|\r?\n)/)
    .map((segment) => {
      // Only clean non-newline segments (actual text content)
      if (/^\r?\n/.test(segment)) return segment;
      return segment
        .replace(/\s+,/g, ",")
        .replace(/,\s*,/g, ", ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+\./g, ".")
        .replace(/\s+([?!;:])/g, "$1")
        .replace(/,\s*(?=\.|$)/g, "")
        .replace(/\b(?:or|and)\s*(?=\.|,|$)/gi, "")
        .replace(/,\s*(and|or)\s*,/gi, ", ")
        .replace(/, and\b/g, " and");
    })
    .join("")
    .trim();
}

function enforceEditorialTerms(text, narrative) {
  let sanitized = stripUnsupportedModalities(text, narrative);
  sanitized = stripUnsupportedServicePhrases(sanitized, narrative);

  for (const rule of acronymExpansionRules) {
    if (rule.supportPattern.test(narrative) || rule.supportPattern.test(sanitized)) {
      sanitized = ensureFirstAcronymExpansion(sanitized, rule);
    }
  }

  for (const rule of licenseExpansionRules) {
    if (rule.supportPattern.test(sanitized)) {
      sanitized = ensureFirstAcronymExpansion(sanitized, rule);
    }
  }

  sanitized = sanitized
    .replace(/\bobsessive[- ]compulsive disorder\b/gi, "obsessive-compulsive challenges")
    .replace(/\bpost[- ]?traumatic stress disorder\b/gi, "posttraumatic stress")
    .replace(/\battention[- ]deficit hyperactivity disorder\b/gi, "attention-deficit hyperactivity");

  return cleanupNarrativeText(sanitized);
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

function buildFallbackSeoHints({ narrative, state, license, city }) {
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
    if (licenseKeywordMap[license]) {
      licenseKeywordMap[license].forEach((kw) => keywordSet.add(kw));
    }
  }

  if (city) {
    const cities = city.split(",").map((c) => c.trim()).filter(Boolean);
    for (const c of cities) {
      keywordSet.add(`therapist in ${c}`);
      keywordSet.add(`therapy in ${c}`);
      keywordSet.add(`counseling in ${c}`);
      if (state) {
        keywordSet.add(`therapist in ${c}, ${state}`);
      }
    }
  }

  return Array.from(keywordSet)
    .filter((keyword) => isNarrativeSupportedKeyword(keyword, { narrative, state, license }))
    .slice(0, 24);
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

async function buildSeoHints({ narrative, state, license, city }) {
  const fallbackHints = buildFallbackSeoHints({ narrative, state, license, city });

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

// Sections we WANT to capture from a therapist profile page
const WANTED_SECTION_RE = /^#+\s*(about|challenges?\s+treated|specialt|methods?|modalities|client\s+focus|services?|approach|qualif|education|language|experience|training|focus|background)/im;
// Sections that are noise — skip the entire section
const SKIP_SECTION_RE = /^#+\s*(choose\s+a\s+time|schedule|availab|book|billing|insurance|carrier|cash\s+rate|faq|review|testimonial|similar|location\s+&|related)/im;

function extractProfileContent(rawText) {
  // Normalize setext headings ("Foo\n====" → "# Foo", "Bar\n----" → "## Bar")
  const normalized = rawText
    .replace(/^(.+)\n={3,}$/gm, (_, title) => `# ${title.trim()}`)
    .replace(/^(.+)\n-{3,}$/gm, (_, title) => `## ${title.trim()}`);

  const lines = normalized.split("\n");
  const result = [];
  let inWantedSection = false;
  let inSkipSection = false;
  let preHeaderChars = 0;
  let charCount = 0;
  const MAX_CHARS = 3500;
  const MAX_PREHEADER = 400;

  for (const line of lines) {
    const isHeading = /^#+\s/.test(line);

    if (isHeading) {
      if (SKIP_SECTION_RE.test(line)) {
        inSkipSection = true;
        inWantedSection = false;
        continue;
      } else if (WANTED_SECTION_RE.test(line)) {
        inWantedSection = true;
        inSkipSection = false;
        result.push(line);
        charCount += line.length + 1;
      } else {
        inSkipSection = false;
        inWantedSection = false;
      }
      continue;
    }

    if (inSkipSection) continue;

    if (inWantedSection) {
      result.push(line);
      charCount += line.length + 1;
    } else if (preHeaderChars < MAX_PREHEADER && line.trim()) {
      // Capture the short header block at top of profile: name, credential, location
      result.push(line);
      preHeaderChars += line.length + 1;
      charCount += line.length + 1;
    }

    if (charCount >= MAX_CHARS) break;
  }

  return result.join("\n").trim();
}

async function fetchWebsiteContext(url) {
  if (!url || typeof url !== "string") return "";
  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  try {
    new URL(normalizedUrl);
  } catch {
    return "";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) return "";
    const text = await response.text();
    const extracted = extractProfileContent(text);
    console.log(`Website context fetched for ${url}: ${text.length} raw → ${extracted.length} extracted chars`);
    return extracted;
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function buildUserPrompt({ narrative, state, license, city, websiteUrl, mode }) {
  const [seoHints, websiteContext] = await Promise.all([
    (mode === "seo" || mode === "geo")
      ? buildSeoHints({ narrative, state, license, city })
      : Promise.resolve([]),
    websiteUrl ? fetchWebsiteContext(websiteUrl) : Promise.resolve(""),
  ]);

  const contextLines = [
    state ? `Selected location context: ${state}` : null,
    license ? `Selected license context: ${license}` : null,
    city ? `Cities served: ${city}` : null,
    seoHints.length > 0 ? `Allowed SEO phrases: ${seoHints.join(", ")}` : null,
    websiteContext ? `Therapist website content — extract from this: (1) practice city/state if not already provided above, (2) services and specialties offered, (3) any relevant keywords that reflect the practice focus. Use these to inform SEO phrase selection and location context:\n${websiteContext}` : null,
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

const MAX_EDIT_SUMMARY_ITEMS = 10;

function parseSeoStructuredResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { narrative: "", editsSummary: [] };
  }
  const trimmed = rawText.trim();
  let jsonStr = trimmed;
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object") {
      return { narrative: trimmed, editsSummary: [] };
    }
    const narrative =
      typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
    const editsSummary = Array.isArray(parsed.editsSummary)
      ? parsed.editsSummary
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
        .slice(0, MAX_EDIT_SUMMARY_ITEMS)
      : [];
    if (!narrative) {
      return { narrative: trimmed, editsSummary: [] };
    }
    return { narrative, editsSummary };
  } catch {
    return { narrative: trimmed, editsSummary: [] };
  }
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
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "24kb" }));
app.use(rateLimit);

app.post("/api/clean-narrative", async (req, res) => {
  const { narrative, state, license, mode, city, websiteUrl } = req.body ?? {};

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI is not configured on the server." });
  }

  if (!narrative || typeof narrative !== "string") {
    return res.status(400).json({ error: "Narrative required" });
  }

  const trimmedNarrative = narrative.trim();
  const transformMode = mode === "geo" ? "geo" : mode === "seo" ? "seo" : "editorial";
  if (!trimmedNarrative) {
    return res.status(400).json({ error: "Narrative required" });
  }

  if (trimmedNarrative.length > MAX_NARRATIVE_CHARS) {
    return res.status(400).json({
      error: `Narratives must be ${MAX_NARRATIVE_CHARS} characters or fewer.`,
    });
  }

  const isSeoOrGeo = transformMode === "seo" || transformMode === "geo";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), isSeoOrGeo ? OPENAI_SEO_TIMEOUT_MS : OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(await (async () => {
        const isSeoMode = transformMode === "seo" || transformMode === "geo";
        const model = isSeoMode ? OPENAI_SEO_MODEL : OPENAI_MODEL;
        const isReasoningModel = /^o\d/.test(model);
        const userPrompt = await buildUserPrompt({
          narrative: trimmedNarrative,
          state: typeof state === "string" ? state : "",
          license: typeof license === "string" ? license : "",
          city: typeof city === "string" ? city : "",
          websiteUrl: typeof websiteUrl === "string" ? websiteUrl : "",
          mode: transformMode,
        });
        const systemPrompt = transformMode === "geo" ? geoPrompt : transformMode === "seo" ? seoPrompt : editorialPrompt;
        return {
          model,
          store: false,
          instructions: systemPrompt,
          input: userPrompt,
          text: { format: { type: "text" } },
          ...(isReasoningModel ? {} : { temperature: 0.2 }),
        };
      })()),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || "OpenAI request failed while processing the narrative.";
      console.error("OpenAI API error:", errorMessage);
      return res.status(502).json({ error: "The AI service could not process this request." });
    }

    const rawText = extractResponseText(data);
    if (!rawText) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    if (transformMode === "seo" || transformMode === "geo") {
      const { narrative: parsedNarrative, editsSummary } = parseSeoStructuredResponse(rawText);
      const cleaned = parsedNarrative || rawText;
      const sanitized = enforceEditorialTerms(cleaned, trimmedNarrative);
      const payload = { cleaned: sanitized };
      if (editsSummary.length > 0) {
        payload.editsSummary = editsSummary;
      }
      return res.json(payload);
    }

    return res.json({ cleaned: enforceEditorialTerms(rawText, trimmedNarrative) });
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
