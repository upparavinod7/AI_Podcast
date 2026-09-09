import { useEffect, useState } from "react";

import { VOICES, generateSpeech, getTtsAudioUrl } from "../services/ttsApi";

function VoiceGenerator({ selectedVoice: externalVoice, onSelectVoice }) {
  const [internalVoice, setInternalVoice] = useState("alex");

  const selectedVoice =
    externalVoice !== undefined ? externalVoice : internalVoice;

  function handleSelectVoice(voiceId) {
    if (onSelectVoice) {
      onSelectVoice(voiceId);
    } else {
      setInternalVoice(voiceId);
    }
  }

  const [text, setText] = useState("");

  const [audioUrl, setAudioUrl] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  async function handleGenerate() {
    if (!text.trim()) {
      setError("Please enter some text.");

      return;
    }

    try {
      setLoading(true);
      setError("");

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);

        setAudioUrl("");
      }

      const result = await generateSpeech(text, selectedVoice);

      const generatedUrl = getTtsAudioUrl(result.audio.fileName);

      setAudioUrl(generatedUrl);
    } catch (err) {
      console.error("Voice generation error:", err);

      setError(err.message || "Failed to generate speech.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="voice-generator">
      <div className="voice-generator-header">
        <h2>AI Voice Generator</h2>

        <p>Choose a voice and generate AI speech for your podcast.</p>
      </div>

      <div className="voice-list">
        {VOICES.map((voice) => (
          <button
            key={voice.id}
            type="button"
            className={`voice-card ${
              selectedVoice === voice.id ? "selected" : ""
            }`}
            onClick={() => handleSelectVoice(voice.id)}
          >
            <div className="voice-icon">🎙️</div>

            <div className="voice-info">
              <strong>{voice.name}</strong>

              <span>{voice.gender}</span>

              <small>{voice.description}</small>
            </div>

            {selectedVoice === voice.id && <div className="voice-check">✓</div>}
          </button>
        ))}
      </div>

      <div className="voice-text">
        <label htmlFor="tts-text">Text</label>

        <textarea
          id="tts-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Enter text for the AI voice..."
          rows={5}
        />
      </div>

      {error && <div className="tts-error">{error}</div>}

      <button
        type="button"
        className="generate-voice-button"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading
          ? "Generating..."
          : `Generate with ${
              VOICES.find((voice) => voice.id === selectedVoice)?.name || "Alex"
            }`}
      </button>

      {audioUrl && (
        <div className="tts-preview">
          <h3>Audio Preview</h3>

          <audio controls preload="metadata" src={audioUrl} />
        </div>
      )}
    </section>
  );
}

export default VoiceGenerator;
