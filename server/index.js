const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require("openai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Clean narrative endpoint
app.post('/api/clean-narrative', async (req, res) => {
  const { narrative } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `
You are a narrative compliance assistant for GoodTherapy. Your task is to enforce stylistic and terminology corrections **only where necessary**, according to GoodTherapy's style guide. Follow these instructions strictly:

1. **Correct grammar, punctuation, and spelling.**
2. **Do NOT rewrite the tone, structure, or meaning** of the original narrative.
3. **Fix terminology** per GT guidelines:
   - Use **people-first language**.
   - Replace stigmatizing or overly clinical terms with GT-approved alternatives.
   - Expand acronyms on first use, then abbreviate (e.g., Cognitive Behavioral Therapy (CBT)).
   - When acronym is expanded, it should not have the word "disorder" it in. E.g OCD should not be "obsessive-compulsive disorder", instead do not use the word disorder or you can replace it with something else that is appropriate
   - Replace the word "disorder" or "disorders" with issue/condition/diagnosis
   - Use lowercase for therapy types, e.g., cognitive behavioral therapy.
   - Apply the **Oxford comma** in lists.
4. **Do NOT introduce new content**, reword excessively, or summarize.
5. **Maintain the original sentence and structure whenever possible**.

Return only the cleaned narrative, nothing else.
`
        },
        {
          role: 'user',
          content: narrative
        }
      ],
      temperature: 0.1
    });

    const cleaned = completion.choices?.[0]?.message?.content?.trim();
    if (!cleaned) throw new Error("No response from OpenAI");

    res.json({ cleaned });
  } catch (err) {
    console.error("OpenAI error:", err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to clean narrative' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));