const {
  generateTalkingPoints
} = require("./llmService");

const {
  generateSpeech
} = require("./ttsService");

async function generateCoHost(topic, outline) {
  const llmResult = await generateTalkingPoints(
    topic,
    outline
  );

  const talkingPoints = [];

  for (const point of llmResult.talkingPoints) {
    const audio = await generateSpeech(point.question);

    talkingPoints.push({
      order: point.order,
      question: point.question,
      audio
    });
  }

  return {
    talkingPoints
  };
}

module.exports = {
  generateCoHost
};