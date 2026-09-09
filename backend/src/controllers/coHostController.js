const { generateCoHost } = require("../services/coHostService");

async function generateCoHostController(req, res) {
  try {
    const { topic, outline } = req.body;

    if (!topic || typeof topic !== "string") {
      return res.status(400).json({
        success: false,
        error: "Topic is required",
      });
    }

    if (!outline || typeof outline !== "string") {
      return res.status(400).json({
        success: false,
        error: "Outline is required",
      });
    }

    const result = await generateCoHost(topic.trim(), outline.trim());

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Co-host generation error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to generate AI co-host",
    });
  }
}

module.exports = {
  generateCoHostController,
};
