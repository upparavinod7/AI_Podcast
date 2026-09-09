const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

function getFallbackTalkingPoints(topic, outline) {
  const cleanTopic =
    typeof topic === "string" && topic.trim().length > 0
      ? topic.trim()
      : "this topic";

  return {
    talkingPoints: [
      {
        order: 1,
        question: `To start off, could you introduce our listeners to ${cleanTopic} and share why it's so relevant right now?`,
      },
      {
        order: 2,
        question: `What are the most significant challenges, debates, or common misconceptions surrounding ${cleanTopic}?`,
      },
      {
        order: 3,
        question: `Looking ahead, how do you expect ${cleanTopic} to evolve, and what key advice would you give our audience?`,
      },
    ],
  };
}

async function generateTalkingPoints(topic, outline) {
  const prompt = `
You are an AI podcast co-host generator.

Your job is to generate natural follow-up questions
for a podcast host based on the supplied topic and outline.

IMPORTANT RULES:
- Return ONLY valid JSON.
- Do not return markdown.
- Do not use code fences.
- Do not add explanations.
- Generate between 3 and 5 talking points.
- Each talking point must contain:
  - order
  - question
- Questions must sound natural and conversational.
- Questions should encourage the host to explain their thoughts.
- Questions must be directly related to the topic and outline.

Return exactly this structure:

{
  "talkingPoints": [
    {
      "order": 1,
      "question": "..."
    }
  ]
}

Topic:
${topic}

Outline:
${outline}
`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(
        Number(process.env.OLLAMA_TIMEOUT_MS) || 12000,
      ),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: "system",
            content: "You generate structured podcast talking points.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.message?.content) {
      throw new Error("Ollama returned an empty response");
    }

    let parsed;
    try {
      parsed = JSON.parse(data.message.content);
    } catch {
      throw new Error("LLM returned invalid JSON");
    }

    validateTalkingPoints(parsed);

    return parsed;
  } catch (error) {
    console.warn(
      `[LLM] Ollama unavailable, using deterministic fallback (${error.message}) for topic: "${topic}".`,
    );

    const fallback = getFallbackTalkingPoints(topic, outline);
    validateTalkingPoints(fallback);
    return fallback;
  }
}

function validateTalkingPoints(data) {
  if (!data || !Array.isArray(data.talkingPoints)) {
    throw new Error("Invalid talking points structure");
  }

  if (data.talkingPoints.length < 3 || data.talkingPoints.length > 5) {
    throw new Error("LLM must return between 3 and 5 talking points");
  }

  for (const point of data.talkingPoints) {
    if (
      typeof point.order !== "number" ||
      typeof point.question !== "string" ||
      point.question.trim().length === 0
    ) {
      throw new Error("Invalid talking point");
    }
  }
}

module.exports = {
  generateTalkingPoints,
  getFallbackTalkingPoints,
};
