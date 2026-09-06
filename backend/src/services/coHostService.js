const {
  generateTalkingPoints
} = require("./llmService");

const {
  generateSpeech
} = require("./ttsService");

async function generateCoHost(topic, outline) {
  // Step 1: Generate talking points using the LLM
  const llmResult = await generateTalkingPoints(
    topic,
    outline
  );

  const talkingPoints = [];

  // Step 2: Generate TTS audio for every talking point
  for (const point of llmResult.talkingPoints) {
    const audio = await generateSpeech(point.question);

    talkingPoints.push({
      order: point.order,
      question: point.question,
      audio
    });
  }

  // Step 3: Return complete AI co-host data
  return {
    talkingPoints
  };
}

module.exports = {
  generateCoHost
};