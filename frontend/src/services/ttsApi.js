const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const VOICES = [
  {
    id: "alex",
    name: "Alex",
    gender: "Male",
    description: "Male · Ryan",
  },

  {
    id: "leo",
    name: "Leo",
    gender: "Male",
    description: "Male · Joe",
  },

  {
    id: "maaya",
    name: "Maaya",
    gender: "Female",
    description: "Female · Amy",
  },
];

export async function generateSpeech(text, voice = "alex") {
  const response = await fetch(`${API_BASE_URL}/tts/speech`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      text,
      voice,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate speech");
  }

  return data;
}

export function getTtsAudioUrl(fileName) {
  return `${API_BASE_URL}/tts/audio/${encodeURIComponent(fileName)}`;
}

export function normalizeVoice(voiceOrSpeaker) {
  if (!voiceOrSpeaker) return "alex";
  const str = String(voiceOrSpeaker).trim().toLowerCase();
  if (str === "alex" || str === "ryan") return "alex";
  if (str === "leo" || str === "joe") return "leo";
  if (str === "maaya" || str === "amy") return "maaya";
  return "alex";
}

export function getSpeakerName(voiceId) {
  const v = normalizeVoice(voiceId);
  return v === "leo" ? "Leo" : v === "maaya" ? "Maaya" : "Alex";
}

export function getVoiceDisplayName(voiceId) {
  const v = normalizeVoice(voiceId);
  if (v === "leo") return "Leo · Joe";
  if (v === "maaya") return "Maaya · Amy";
  return "Alex · Ryan";
}

export async function getVoices() {
  const response = await fetch(`${API_BASE_URL}/tts/voices`);

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to load voices");
  }

  return data.voices;
}
