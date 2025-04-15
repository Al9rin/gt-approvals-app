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
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: ``
You are a narrative compliance assistant for GoodTherapy. Your task is to enforce stylistic and terminology corrections **only where necessary**, according to GoodTherapy's style guide. Follow these instructions strictly:

1. **Correct grammar, punctuation, and spelling.**
2. **Do NOT rewrite the tone, structure, or meaning** of the original narrative.
3. **Fix terminology** per GT guidelines:
   - Use **people-first language**.
   - Replace stigmatizing or overly clinical terms with GT-approved alternatives.
   - **Expand acronyms on first use**, then abbreviate (e.g., cognitive behavioral therapy (CBT), attention-deficit hyperactivity condition (ADHD)).
   - When expanding acronyms, **do not include the word “disorder”**. Instead, use appropriate alternatives like “condition” or “issue”.
   - Replace “disorder”/“disorders” with “issue”/“condition”/“diagnosis”.
   - Use lowercase for therapy types (e.g., cognitive behavioral therapy).
   - Apply the **Oxford comma** in lists.
4. **Do NOT introduce new content**, reword excessively, or summarize.
5. **Maintain the original sentence and structure whenever possible**.

Return only the cleaned narrative, nothing else.`
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