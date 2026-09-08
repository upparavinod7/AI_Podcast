# AI Podcast Studio

Local-first podcast recording studio with a scripted AI co-host. The browser records the host in reliable chunks; Ollama creates co-host questions, Piper generates their speech, and FFmpeg creates WAV and MP3 podcast exports.

## Architecture

```text
React + MediaRecorder -> IndexedDB -> Express uploads -> FFmpeg host WebM
Topic + outline -> Ollama -> Piper WAV cues -> saved cue timestamps -> FFmpeg mix -> WAV + MP3
```

## Requirements

- Node.js 22+
- FFmpeg and ffprobe on `PATH`
- Ollama with `qwen2.5:3b`
- Piper HTTP service on port 5001 using `en_US-lessac-medium`

## Setup and run

```bash
git clone https://github.com/upparavinod7/AI_Podcast.git
cd AI_Podcast
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd backend && npm install
cd ../frontend && npm install
```

Run these four processes in separate terminals:

```bash
ollama serve
ollama pull qwen2.5:3b
```

```bash
```

```bash
cd backend && npm start
```

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Backend runs at `http://localhost:5000`.

## Workflow

1. Enter a topic and outline, then generate AI cues.
2. Create a recording session and start the host recording.
3. While recording, use **Next AI Cue**. Completed cues are timestamped relative to the host track.
4. Stop, wait for uploads, and finalize the host recording.
5. Create the final podcast, preview it, and download WAV or MP3.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/recording/sessions` | Create recording session |
| POST | `/api/recording/sessions/:sessionId/chunks` | Upload a chunk |
| GET | `/api/recording/sessions/:sessionId/status` | Check chunk sequence |
| POST | `/api/recording/sessions/:sessionId/finalize` | Build host WebM |
| GET | `/api/recording/sessions/:sessionId/final` | Stream host WebM |
| POST | `/api/cohost/timeline` | Generate LLM + Piper cues |
| POST | `/api/recording/sessions/:sessionId/mix` | Mix host and cue timeline |
| GET | `/api/recording/sessions/:sessionId/mix/wav` | Stream WAV master |
| GET | `/api/recording/sessions/:sessionId/mix/mp3` | Stream MP3 delivery file |

The mix request accepts `{ "timeline": { "events": [...] } }`. Only completed, non-overlapping cue events are mixed. All audio is validated with ffprobe and generated output stays under `backend/outputs/`, which is ignored by Git.

## Environment

See `backend/.env.example` and `frontend/.env.example`. No secret or filesystem path is exposed to the browser.

## Troubleshooting

- **Ollama request failed:** run `ollama serve` and confirm `ollama list` shows `qwen2.5:3b`.
- **Piper request failed:** start Piper and verify `curl http://localhost:5001` reaches the service.
- **Cannot finalize:** retry failed uploads and ensure session status has no missing chunks.
- **Cannot mix:** finalize first, then ensure every intended cue was played while recording and is marked completed.

## Current limitations

Phase 1 intentionally uses prepared/manual AI cues, not a live unscripted conversation. Host noise cleanup is handled first by browser echo cancellation, noise suppression, and auto gain control; advanced server-side cleanup is a future enhancement.
