// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.post("/api/clean-narrative", async (req, res) => {
  const { narrative } = req.body;
  if (!narrative) return res.status(400).json({ error: "Narrative required" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `
You are a narrative compliance assistant for GoodTherapy. Your task is to enforce stylistic and terminology corrections only where necessary, according to GoodTherapy's full editorial and style guidelines. Follow these instructions exactly:

1. **Correct grammar, punctuation, and spelling.**
2. **Do NOT rewrite the tone, structure, or meaning** of the original narrative.
3. Apply **GoodTherapy editorial rules**, including:
   - Expand all acronyms on first use with correct capitalization and terminology. For example:
     - ADHD → attention-deficit hyperactivity (ADHD)
     - CBT → cognitive behavioral therapy (CBT)
     - PTSD → posttraumatic stress (PTSD)
     - Do not include the word “disorder” even if it is commonly part of the acronym.
   - Replace any use of “disorder” with appropriate alternatives such as: issue, condition, diagnosis, or challenge.
   - Use **people-first language** unless the condition community prefers identity-first (e.g., “autistic person” is preferred).
   - Use **lowercase** for therapy types and mental health issues (e.g., cognitive behavioral therapy).
   - Avoid stigmatizing or clinical-sounding labels.
   - Ensure the **Oxford comma** is used in all lists.
   - If degrees and licenses are listed (e.g., PhD, LMFT), degrees come first.
4. Do NOT summarize, add new content, or rephrase unnecessarily.
5. Maintain original sentence structure and intent unless clarity or grammar is compromised.

Return ONLY the cleaned narrative. No explanation or extra notes.
  `
          },
          { role: "user", content: narrative },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const cleaned = data.choices?.[0]?.message?.content || "";
    res.json({ cleaned });
  } catch (err) {
    console.error("Error calling OpenAI API:", err);
    res.status(500).json({ error: "Failed to clean narrative" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});