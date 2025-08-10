import axios from "axios";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function generateContent(prompt: string, style = "professional") {
  if (!OPENAI_API_KEY) {
    // Fallback: simple template generator
    return {
      text: `פוסט בסגנון ${style}: ${prompt}\n CTA: ספרו לי בתגובות ✅`,
      hashtags: ["#dj", "#wedding", "#music", "#party"]
    };
  }
  // Minimal call to Chat Completions
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You craft concise, engaging social posts."},
        { role: "user", content: `Style: ${style}. Create a short post:\n${prompt}`}
      ]
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );
  const text = res.data.choices?.[0]?.message?.content ?? "Post text";
  return { text, hashtags: ["#marketing", "#ai", "#content"] };
}
