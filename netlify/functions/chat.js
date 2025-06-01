import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function handler(event) {
  try {
    const { messages } = JSON.parse(event.body);
    if (!Array.isArray(messages)) throw new Error("No messages");

    // 1. Get main reply
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });
    const mainReply = completion.choices[0].message.content;

    // 2. Get 3 suggested follow up question prompts
    // new message: "Given this conversation, suggest 3 short, specific questions the user could ask next about the same topic. Respond as a JSON array of strings."
    const suggestPrompt = [
      ...messages,
      { role: "system", content: "Given the above conversation, suggest 3 concise follow-up questions the user could ask next (continuing the same topic). Respond ONLY with a JSON array of three question strings. No explanations, no intro." }
    ];

    const suggestionResponse = await openai.chat.completions.create({
      model: "gpt-4o", // faster and cheaper, good enough
      messages: suggestPrompt,
      temperature: 0.9,
      max_tokens: 300,
    });

    // Parse the LLM response as JSON
    let suggestions = [];
    try {
      // attempt to find the JSON array in the response content
      const content = suggestionResponse.choices[0].message.content;
      suggestions = JSON.parse(
        content.match(/\[.*\]/s)[0]
      );
      // suggestions should now be an array of strings
    } catch (e) {
      suggestions = []; // fallback: just skip
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: mainReply,
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