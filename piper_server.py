from pathlib import Path

from flask import Flask, jsonify, request, send_file
from piper import PiperVoice


BASE_DIR = Path(__file__).resolve().parent


VOICES = {
    "en_US-ryan-medium": {
        "model": BASE_DIR / "en_US-ryan-medium.onnx",
    },
    "en_US-joe-medium": {
        "model": BASE_DIR / "en_US-joe-medium.onnx",
    },
    "en_US-amy-medium": {
        "model": BASE_DIR / "en_US-amy-medium.onnx",
    },
    "en_US-lessac-medium": {
        "model": BASE_DIR / "en_US-lessac-medium.onnx",
    },
}


app = Flask(__name__)


loaded_voices = {}


def load_voice(voice_name):
    if voice_name in loaded_voices:
        return loaded_voices[voice_name]

    voice_config = VOICES.get(voice_name)

    if not voice_config:
        raise ValueError(
            f"Unsupported voice: {voice_name}"
        )

    model_path = voice_config["model"]

    if not model_path.exists():
        raise FileNotFoundError(
            f"Voice model not found: {model_path}"
        )

    print(
        f"Loading voice model: {voice_name}"
    )

    voice = PiperVoice.load(
        str(model_path)
    )

    loaded_voices[voice_name] = voice

    print(
        f"Loaded voice model: {voice_name}"
    )

    return voice


@app.get("/")
def home():
    return jsonify({
        "success": True,
        "service": "AI Podcast Piper TTS",
        "status": "running",
        "voices": list(VOICES.keys()),
    })


@app.get("/voices")
def voices():
    result = {}

    for voice_name, config in VOICES.items():
        result[voice_name] = {
            "available": config["model"].exists(),
        }

    return jsonify(result)


@app.post("/synthesize")
def synthesize():
    try:
        data = request.get_json(
            silent=True
        ) or {}

        text = data.get("text")

        voice_name = (
            data.get("voice")
            or "en_US-lessac-medium"
        )

        if not text or not isinstance(
            text,
            str
        ):
            return jsonify({
                "success": False,
                "error": "Text is required",
            }), 400

        text = text.strip()

        if not text:
            return jsonify({
                "success": False,
                "error": "Text cannot be empty",
            }), 400

        if voice_name not in VOICES:
            return jsonify({
                "success": False,
                "error": (
                    f"Unsupported voice: "
                    f"{voice_name}"
                ),
            }), 400

        voice = load_voice(
            voice_name
        )

        output_path = (
            BASE_DIR
            / "outputs"
            / "tts"
            / "piper-temp.wav"
        )

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with output_path.open(
            "wb"
        ) as wav_file:

            voice.synthesize(
                text,
                wav_file
            )

        return send_file(
            output_path,
            mimetype="audio/wav",
            as_attachment=False,
        )

    except Exception as error:
        print(
            "Piper synthesis error:",
            error
        )

        return jsonify({
            "success": False,
            "error": str(error),
        }), 500


if __name__ == "__main__":
    print("Starting AI Podcast Piper server...")
    print(
        f"Available voices: "
        f"{', '.join(VOICES.keys())}"
    )

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False,
    )
