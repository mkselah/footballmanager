import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function handler(event) {
  try {
    const { messages } = JSON.parse(event.body);
    if (!Array.isArray(messages)) throw new Error("No messages");

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Fast and cheap for chat
      messages,                // Pass the full thread context for this topic
      temperature: 0.7,
      max_tokens: 1000,
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: completion.choices[0].message.content }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Unknown error" }),
    };
  }
}