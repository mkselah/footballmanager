import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: After assistant response, ask for 3 concise next user questions to keep the chat going
async function getSuggestions(messages) {
  // Work in user/assistant context; give prompt in English for now
  const suggestionPrompt = [
    ...messages,
    {
      role: "system",
      content: "Given the conversation so far, suggest 3 concise, engaging, natural next user questions to keep the dialog going. Only return a numbered JSON array of 3 questions."
    }
  ];
  const suggestionResp = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: suggestionPrompt,
    temperature: 0.65,
    max_tokens: 140,
  });
  let suggestions = [];
  try {
    // Try to extract JSON array
    const m = suggestionResp.choices[0].message.content.match(/\[.*?\]/s);
    if (m) suggestions = JSON.parse(m[0]);
  } catch (e) {
    suggestions = [];
  }
  if (!Array.isArray(suggestions) || suggestions.length !== 3) {
    // fallback: split by lines if not JSON
    suggestions = suggestionResp.choices[0].message.content
      .split('\n').map(s => s.replace(/^[\d\-\*\.]+\s*/, '').trim()).filter(Boolean).slice(0,3);
  }
  return suggestions;
}

export async function handler(event) {
  try {
    const { messages } = JSON.parse(event.body);
    if (!Array.isArray(messages)) throw new Error("No messages");

    // 1. Get assistant reply
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });
    const reply = completion.choices[0].message.content;

    // 2. Get suggestions (include the new assistant reply in context)
    const allMessages = [...messages, { role: "assistant", content: reply }];
    const suggestions = await getSuggestions(allMessages);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply,
        suggestions
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Unknown error" }),
    };
  }
}