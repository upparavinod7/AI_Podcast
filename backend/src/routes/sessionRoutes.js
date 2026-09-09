const express = require("express");

const controller = require("../controllers/sessionController");

const router = express.Router();

router.post("/", controller.createSession);

router.get("/", controller.listSessions);

router.get("/:sessionId", controller.getSessionDetails);

router.patch("/:sessionId", controller.updateSessionDetails);

router.delete("/:sessionId", controller.removeSession);

module.exports = router;
