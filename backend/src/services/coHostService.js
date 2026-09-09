const { generateTalkingPoints } = require("./llmService");

const { generateSpeech } = require("./ttsService");

async function generateCoHost(topic, outline, voice = "alex") {
  const llmResult = await generateTalkingPoints(topic, outline);

  const talkingPoints = [];

  for (const point of llmResult.talkingPoints) {
    const pointVoice = point.voice || voice || "alex";
    const audio = await generateSpeech(point.question, pointVoice);

    talkingPoints.push({
      order: point.order,
      question: point.question,
      voice: pointVoice,
      audio,
    });
  }

  return {
    talkingPoints,
  };
}

module.exports = {
  generateCoHost,
};
