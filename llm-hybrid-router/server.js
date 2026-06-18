import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// ─── Classifier: ถามว่าควรส่งให้ใคร ───────────────────────────────────────
async function classifyMessage(message) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: {
      parts: [{
        text: `You are a routing classifier. Analyze the user message and respond with EXACTLY one word:
- "GEMINI" — for factual questions, general knowledge, summaries, translations, simple Q&A, creative writing, casual chat
- "CLAUDE" — for complex reasoning, multi-step coding problems, algorithms, advanced mathematics, architecture design, debugging complex code, logical puzzles

Respond only with the single word: GEMINI or CLAUDE`
      }]
    },
    contents: [{ role: 'user', parts: [{ text: message }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 10 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Classifier error: ${res.status}`);
  const data = await res.json();
  const decision = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
  return decision === 'CLAUDE' ? 'CLAUDE' : 'GEMINI';
}

// ─── Gemini 1.5 Pro ───────────────────────────────────────────────────────
async function callGemini(message, history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

  // map neutral history → Gemini format (exclude last user message, already in contents)
  const geminiHistory = history.slice(0, -1).map(m => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }]
  }));

  const body = {
    contents: [
      ...geminiHistory,
      { role: 'user', parts: [{ text: message }] }
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
}

// ─── Claude 3.5 Sonnet ───────────────────────────────────────────────────
async function callClaude(message, history) {
  // map neutral history → Anthropic format
  const messages = [
    ...history.slice(0, -1).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    })),
    { role: 'user', content: message }
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '(empty response)';
}

// ─── Main endpoint ────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const route = await classifyMessage(message);
    let reply, modelUsed;

    if (route === 'CLAUDE') {
      reply = await callClaude(message, [...history, { sender: 'user', text: message }]);
      modelUsed = 'Claude 3.5 Sonnet';
    } else {
      reply = await callGemini(message, [...history, { sender: 'user', text: message }]);
      modelUsed = 'Gemini 1.5 Pro';
    }

    res.json({ reply, modelUsed, route });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 LLM Hybrid Router running → http://localhost:${PORT}`));
