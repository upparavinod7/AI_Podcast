const {
  generateTalkingPoints
} = require("../services/llmService");

async function generateTalkingPointsController(req, res) {
  try {
    const { topic, outline } = req.body;

    if (!topic || !outline) {
      return res.status(400).json({
        error: "Topic and outline are required"
      });
    }

    const result = await generateTalkingPoints(
      topic,
      outline
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("LLM error:", error);

    return res.status(500).json({
      error: "Failed to generate talking points"
    });
  }
}

module.exports = {
  generateTalkingPointsController
};