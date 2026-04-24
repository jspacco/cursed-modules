export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1. Basic Method & Body validation
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { messages, systemPrompt, model } = await req.json();

    if (model === 'gemini-flash') {
      return await handleGemini(messages, systemPrompt);
    }
    return await handleAnthropic(messages, systemPrompt);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
  }
}

async function handleAnthropic(messages, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // Required if calling from certain edge environments
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022', // Updated to valid stable model ID
      max_tokens: 5000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGemini(messages, systemPrompt) {
  if (!process.env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set' }), { status: 500 });
  }

  // 2. Correct Gemini Content Mapping
  // Gemini expects roles to be strictly 'user' or 'model'
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: 5000 },
  };

  if (systemPrompt) {
    body.system_instruction = { 
      parts: [{ text: systemPrompt }] 
    };
  }

  // 3. Updated Model ID for 2026: Gemini 3 Flash
  const modelId = 'gemini-2.5-flash'; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Robust Data Extraction
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
  
  // Return in Anthropic-style format to keep frontend logic unified
  return new Response(JSON.stringify({ 
    content: [{ type: 'text', text }],
    model: modelId
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}