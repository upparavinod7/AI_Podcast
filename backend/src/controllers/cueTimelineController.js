const {
  buildCueTimeline,
} = require("../services/cueTimelineService");

// ============================================================
// GENERATE CUE TIMELINE
// POST /api/cohost/timeline
// ============================================================

async function generateCueTimeline(
  req,
  res
) {
  try {
    const {
      topic,
      outline,
    } = req.body;

    if (
      typeof topic !== "string" ||
      topic.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Topic is required",
      });
    }

    if (
      typeof outline !== "string" ||
      outline.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Outline is required",
      });
    }

    const timeline =
      await buildCueTimeline(
        topic,
        outline
      );

    return res.status(200).json({
      success: true,
      ...timeline,
    });
  } catch (error) {
    console.error(
      "Cue timeline generation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate cue timeline",
    });
  }
}

module.exports = {
  generateCueTimeline,
};