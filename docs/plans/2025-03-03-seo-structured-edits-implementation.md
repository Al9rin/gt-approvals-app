# SEO Structured Edits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Return structured SEO output (narrative + editsSummary) from one API call and show "Edits applied" below the narrative when the user runs "Add SEO".

**Architecture:** Server parses JSON from the model response (with fallback to plain narrative), returns `{ cleaned, editsSummary? }` for SEO mode. Client stores `editsSummary` and renders a bullet list below the result block only when last run was SEO and list is non-empty. Design: `docs/plans/2025-03-03-seo-structured-edits-design.md`.

**Tech Stack:** Node/Express (server), React (client), OpenAI Responses API.

---

## Task 1: Add SEO response parser (server)

**Files:**
- Modify: `server/index.js` (add function after `extractResponseText`, ~line 918)

**Step 1: Add parser function**

Insert after `function extractResponseText(data) { ... }` (after line 917):

```javascript
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
```

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat(server): add parseSeoStructuredResponse for SEO JSON output"
```

---

## Task 2: Expand SEO prompt and require JSON output (server)

**Files:**
- Modify: `server/index.js` (replace `seoPrompt` constant, lines 374–405)

**Step 1: Replace seoPrompt**

Replace the entire `const seoPrompt = \`...\`;` block (from line 374 through the closing backtick and semicolon before `function parseCsv`) with:

```javascript
const seoPrompt = `You are a narrative compliance assistant for GoodTherapy. Your task is to refine therapist marketing narratives so they read cleanly, stay true to the therapist's voice, follow GoodTherapy editorial guidance, and improve search discoverability without sounding SEO-written.

Follow these instructions exactly:

1. Correct grammar, punctuation, spelling, and obvious clarity issues.
2. Preserve the therapist's original voice, warmth, rhythm, and point of view.
3. Keep the writing casual, natural, and human. Do not make it sound corporate, generic, stiff, or overly polished.
4. Do NOT change the meaning, add unsupported claims, invent specialties, or rewrite the structure unless clarity requires it.
5. Never introduce a new modality, specialty, diagnosis, acronym, or treatment approach unless it is explicitly supported by the original narrative or selected context.
6. Never add an explanatory sentence just to fit SEO. If a keyword would require new claims or a new concept, skip it.
7. Apply GoodTherapy editorial rules, including:
   - Expand all acronyms on first use with correct capitalization and terminology.
   - For example: obsessive-compulsive challenges (OCD), posttraumatic stress (PTSD), attention-deficit hyperactivity (ADHD), cognitive behavioral therapy (CBT), exposure and response prevention (ERP), and eye movement desensitization and reprocessing (EMDR).
   - Do not include the word "disorder" as part of expanded mental health terms.
   - Replace unnecessary uses of "disorder" with better alternatives such as issue, condition, diagnosis, or challenge.
   - Use people-first language unless identity-first language is preferred by that community.
   - Use lowercase for therapy types and mental health issues unless standard capitalization is required.
   - Avoid stigmatizing, cold, or clinical-sounding labels.
   - Use the Oxford comma.
   - If degrees and licenses are listed together, put degrees first.
8. Apply SEO enhancement in a natural, truthful way:
   - Work in 3 to 5 relevant keyword phrases from the allowed list where they fit naturally; do not keyword stuff.
   - Only use keyword phrases that appear in the provided allowed list and are supported by the original narrative or the provided context.
   - Prefer simple service-intent phrasing such as anxiety therapy, OCD therapy, trauma therapy, online therapy, family therapy, or family counseling when those phrases are allowed.
   - If location or license context is provided, you may reinforce it once in a natural way, but do not force awkward local SEO phrases like "near me".
   - Never add a new sentence or list of services just to fit SEO.
9. Structure and snippet-friendly wording:
   - Use a clear, concise opening sentence that could work as a search snippet (answers "what I offer" or "who I help").
   - Keep logical flow and paragraph structure; avoid unnecessary repetition.
10. Keep the output roughly the same length as the original unless a small increase improves clarity or search intent naturally.

OUTPUT FORMAT: Return a single JSON object with exactly two keys:
- "narrative": the full revised narrative as a string.
- "editsSummary": an array of 3 to 6 short bullet points describing what you changed (e.g. "Added keyword phrase 'anxiety therapy' in the second paragraph", "Tightened opening sentence for snippet clarity", "Applied GoodTherapy acronym expansion for CBT"). You may wrap the JSON in a markdown code block (\\\`\\\`\\\`json ... \\\`\\\`\\\`) if you prefer.
`;
```

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat(server): expand SEO prompt with structure, snippet, and JSON output"
```

---

## Task 3: Return structured SEO response in API (server)

**Files:**
- Modify: `server/index.js` (route handler around lines 1025–1030)

**Step 1: Use parser for SEO mode and return editsSummary**

In the `/api/clean-narrative` handler, replace the block that uses `extractResponseText` and returns `res.json`:

Current (lines 1025–1030):

```javascript
    const cleaned = extractResponseText(data);
    if (!cleaned) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    return res.json({ cleaned: enforceEditorialTerms(cleaned, trimmedNarrative) });
```

Replace with:

```javascript
    const rawText = extractResponseText(data);
    if (!rawText) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    if (transformMode === "seo") {
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
```

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat(server): return editsSummary for SEO mode in clean-narrative"
```

---

## Task 4: Client state and API handling for editsSummary

**Files:**
- Modify: `client/src/GTApprovalsApp.js`

**Step 1: Add state for editsSummary**

Near the other narrative state (e.g. after `editedNarrative`), add:

```javascript
const [editsSummary, setEditsSummary] = useState([]);
```

**Step 2: In cleanWithAI, store editsSummary for SEO and clear for editorial**

In `cleanWithAI`, after a successful response:
- When `mode === "seo"`: set `setEditsSummary(Array.isArray(data.editsSummary) ? data.editsSummary : [])`.
- When `mode === "editorial"`: set `setEditsSummary([])`.

So after the line `const cleaned = data.cleaned || "";` add:

```javascript
      if (mode === "seo") {
        setEditsSummary(Array.isArray(data.editsSummary) ? data.editsSummary : []);
      } else {
        setEditsSummary([]);
      }
```

**Step 3: Clear editsSummary when starting a new run and when narrative input changes**

- In `handleNarrative`, at the start (e.g. right after `setAiMode(mode)`), add: `setEditsSummary([]);`.
- In the narrative textarea `onChange`, add clearing: change to `onChange={(e) => { setNarrative(e.target.value); setEditsSummary([]); }}`.

**Step 4: Commit**

```bash
git add client/src/GTApprovalsApp.js
git commit -m "feat(client): store and clear editsSummary for SEO runs"
```

---

## Task 5: Render "Edits applied" block (client)

**Files:**
- Modify: `client/src/GTApprovalsApp.js`

**Step 1: Render block below edited narrative**

Find the block that renders `editedNarrative` (the motion.div with Copy button and `{editedNarrative}`). Immediately after its closing `</motion.div>`, and still inside the same parent (the narrative card), add:

```jsx
            {editedNarrative && aiMode === "seo" && editsSummary.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`mt-4 rounded-xl p-4 border ${darkMode
                  ? "bg-gt-green/5 border-gt-green/20 text-gray-300"
                  : "bg-gt-green-50/80 border-gt-green/20 text-gt-gray"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  Edits applied
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {editsSummary.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </motion.div>
            )}
```

**Step 2: Commit**

```bash
git add client/src/GTApprovalsApp.js
git commit -m "feat(client): show Edits applied below narrative for SEO mode"
```

---

## Task 6: Manual verification

**Steps:**

1. Start server: `cd server && node index.js` (or npm start). Ensure `OPENAI_API_KEY` is set.
2. Start client: `cd client && npm start`.
3. Paste a short therapist narrative (e.g. 2–3 paragraphs mentioning anxiety and therapy).
4. Click **Add SEO**. Wait for completion.
5. Confirm: the revised narrative appears in the result block; below it, "Edits applied" appears with 3–6 bullets.
6. Click **Clean with AI** on the same or new text. Confirm "Edits applied" does not appear.
7. Change the narrative text in the textarea. Confirm any previously shown "Edits applied" is cleared (run Add SEO again to see bullets; then edit text and confirm the block disappears or is replaced on next run).

**Commit:** No code change; optional note in design doc or CHANGELOG that manual testing was done.

---

## Optional: Unit test for parseSeoStructuredResponse

**Files:**
- Create: `server/test/parse-seo-response.test.js` (or use existing test runner if present)
- Modify: `server/package.json` if needed to add test script

**Step 1: Check for existing test setup**

Run: `ls server/*.test.js server/test 2>/dev/null || true`. If no test runner exists, skip this task or add a minimal Node script that asserts parser behavior.

**Step 2: Add tests (if using Jest or Node assert)**

Example with Node `assert` (run with `node server/test/parse-seo-response.test.js`):

```javascript
import assert from "assert";
import { parseSeoStructuredResponse } from "../index.js"; // or extract to util and import

// Valid JSON
const out1 = parseSeoStructuredResponse(JSON.stringify({ narrative: "Hello.", editsSummary: ["One", "Two"] }));
assert.strictEqual(out1.narrative, "Hello.");
assert.deepStrictEqual(out1.editsSummary, ["One", "Two"]);

// JSON in code block
const out2 = parseSeoStructuredResponse("```json\n" + JSON.stringify({ narrative: "Hi.", editsSummary: ["A"] }) + "\n```");
assert.strictEqual(out2.narrative, "Hi.");
assert.strictEqual(out2.editsSummary.length, 1);

// Plain text fallback
const plain = "Just a narrative.";
const out3 = parseSeoStructuredResponse(plain);
assert.strictEqual(out3.narrative, plain);
assert.strictEqual(out3.editsSummary.length, 0);
```

If the parser lives only inside `server/index.js` and is not exported, either export it for testing or run this as a manual checklist instead of an automated test.

---

## Execution handoff

Plan complete and saved to `docs/plans/2025-03-03-seo-structured-edits-implementation.md`.

**Two execution options:**

1. **Subagent-driven (this session)** — I run each task (or dispatch a subagent per task), you review between tasks and we iterate quickly.
2. **Parallel session (separate)** — You open a new session (optionally in a worktree), use the executing-plans skill there, and run the plan with checkpoints.

Which approach do you want?
