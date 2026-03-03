# SEO structured edits — design

**Date:** 2025-03-03  
**Status:** Approved  
**Summary:** Full SEO optimization in one shot (keywords + structure + snippet-friendly wording), with an “Edits applied” summary shown below the narrative text area. Single API call returns structured output (narrative + editsSummary).

---

## 1. Architecture and prompt/output shape

### Flow

- User clicks “Add SEO” → client sends `POST /api/clean-narrative` with `{ narrative, state, license, mode: "seo" }`.
- Server builds SEO hints (fallback + Semrush/snapshot), builds user prompt with “Allowed SEO phrases” + state/license + narrative (unchanged).
- For `mode === "seo"`, the system prompt is expanded and the model is asked to return **structured output**. Server parses that and returns both the narrative and an edits list.

### Prompt (SEO mode)

Expand the existing `seoPrompt` so the model is instructed to:

1. **Keywords:** Work in relevant phrases from the allowed list naturally (e.g. 3–5 where they fit); no stuffing.
2. **Structure:** Use a clear, concise opening that could work as a snippet; keep logical flow and paragraph structure.
3. **Snippet-friendly wording:** Prefer sentences that clearly answer “what I offer / who I help” so they could be used as a meta/snippet.
4. **Voice and rules:** Unchanged — preserve therapist voice, GoodTherapy editorial rules, no new claims.

Add explicit **output instructions:**

Return a single JSON object with two keys:

- `narrative`: the full revised narrative (string).
- `editsSummary`: array of 3–6 short bullet points describing what you changed (e.g. keywords added, opening made snippet-friendly, structure tightened).

The model may wrap the JSON in a markdown code block (e.g. ```json ... ```); the server will parse that.

### Output shape (model → server)

- Preferred: one JSON object `{ "narrative": "...", "editsSummary": ["...", "..."] }`, possibly inside a code block.
- **Fallback:** If the response is not valid JSON (parse fails or no object with `narrative`):
  - Treat the **entire** response as the narrative (current behavior).
  - Set `editsSummary` to `[]` (or a single generic line like “SEO and editorial edits applied”) so the UI still works.

### Server → client

- **Editorial mode:** Response remains `{ cleaned: string }`.
- **SEO mode:** Response is `{ cleaned: string, editsSummary?: string[] }`. `cleaned` is always the narrative; `editsSummary` is only present when successfully parsed and non-empty.

---

## 2. API contract and client UI

### API contract

- **Request:** Unchanged.  
  `POST /api/clean-narrative`  
  Body: `{ narrative: string, state?: string, license?: string, mode?: "editorial" | "seo" }`

- **Response (editorial):** `{ cleaned: string }`

- **Response (SEO):** `{ cleaned: string, editsSummary?: string[] }`  
  - `cleaned`: optimized narrative (always present).  
  - `editsSummary`: optional array of short bullet strings; omitted or empty when structured output was not parsed.

### Client UI

- **Text area / result block:** Unchanged. The optimized narrative is shown in the same edited-narrative block as today.

- **“Edits applied” block (SEO only):**
  - **When:** Only when `mode === "seo"` and the response includes a non-empty `editsSummary`.
  - **Where:** Directly below the narrative result block, inside the same card/section.
  - **Content:** Heading “Edits applied” (or “SEO edits applied”), then a list of bullets from `editsSummary`.
  - **When hidden:** For editorial mode, or when SEO returns no `editsSummary`; do not render the block.

- **Styling:** Reuse existing card/panel and list styles; keep the block compact (e.g. small type, muted heading, simple list).

- **State:** Store `editsSummary` in component state when the last run was SEO and the API returned it; clear when the user runs editorial, pastes new text, or starts a new SEO run, so the bullets always match the narrative in the box.

---

## 3. Edge cases and testing

### Edge cases

- **Malformed or non-JSON response (SEO mode):** Strip markdown code fences, then parse. If parsing fails or the result is not an object with a string `narrative`, treat the full response as the narrative, run through `enforceEditorialTerms`, and return `editsSummary: []` (or omit). Do not return 5xx; the user still gets a usable narrative.

- **Missing `editsSummary` in valid JSON:** If the object has `narrative` but `editsSummary` is missing or not an array, use the narrative and send `editsSummary: []` or omit. Client hides the “Edits applied” block when the array is empty or missing.

- **Empty or truncated narrative:** If parsed `narrative` is empty or whitespace after trim, treat as parse failure and fall back to “whole response as narrative” so we never return an empty `cleaned` when the model produced any text.

- **Very long `editsSummary`:** Cap at e.g. 10 items and send only the first 10 to the client.

- **Editorial mode:** No structured output; existing flow unchanged. Response remains `{ cleaned: string }` only.

- **Existing behavior:** Rate limit, character limit, timeout, and `enforceEditorialTerms(narrative)` still apply to the narrative before it is sent back.

### Testing

- **Manual:** Run “Add SEO” on 2–3 sample narratives (different lengths, with/without state/license). Confirm narrative in the result block and “Edits applied” below with 3–6 bullets when the model returns valid JSON; with a response that forces fallback, narrative still appears and the edits block is hidden.

- **Backend (optional):** Add a small helper to parse the SEO response (valid JSON, JSON in code block, plain text). Unit test with a few fixture strings to ensure fallback never drops the narrative.

No new automated E2E is required unless the project already uses it and wants coverage.
