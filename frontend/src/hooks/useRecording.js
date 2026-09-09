import { useCallback, useRef, useState, useEffect } from "react";

export default function useRecording({
  sessionId,
  onChunkCaptured,
  onStopCallback,
  onError,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkIndexRef = useRef(0);
  const recordingClockRef = useRef(null);

  // Check microphone support/permission initially
  useEffect(() => {
    async function checkMic() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioInput = devices.some((d) => d.kind === "audioinput");
        if (hasAudioInput) setMicReady(true);
      } catch (err) {
        console.warn("Could not check mic permission:", err);
      }
    }
    void checkMic();
  }, []);

  const startRecording = useCallback(
    async (activeSessionId) => {
      const currentSessionId = activeSessionId || sessionId;
      if (!currentSessionId) {
        onError?.("Please create a session before recording.");
        return;
      }

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Microphone access is not supported in this browser.",
          );
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = mediaStream;
        setMicReady(true);

        const mimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ];
        const selectedMimeType =
          mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

        const recorderOptions = selectedMimeType
          ? { mimeType: selectedMimeType }
          : undefined;

        const recorder = new MediaRecorder(mediaStream, recorderOptions);
        recorderRef.current = recorder;

        chunksRef.current = [];
        chunkIndexRef.current = 0;
        recordingClockRef.current = performance.now();

        recorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size === 0) return;

          const currentChunkIndex = chunkIndexRef.current;
          chunkIndexRef.current += 1;
          chunksRef.current.push(event.data);

          try {
            await onChunkCaptured?.(currentChunkIndex, event.data);
          } catch (error) {
            console.error("Failed to queue recording chunk:", error);
            onError?.(`Chunk ${currentChunkIndex} could not be saved locally.`);
          }
        };

        recorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          onError?.("Recording error occurred.");
        };

        recorder.onstop = async () => {
          try {
            const finalBlob = new Blob(chunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            });

            if (audioUrl) {
              URL.revokeObjectURL(audioUrl);
            }

            const newAudioUrl = URL.createObjectURL(finalBlob);
            setRecordedBlob(finalBlob);
            setAudioUrl(newAudioUrl);

            await onStopCallback?.(currentSessionId, chunksRef.current);
          } catch (error) {
            console.error("Recording stop cleanup failed:", error);
            onError?.(error.message || "Failed to finish recording stop.");
          }
        };

        recorder.start(5000);
        setIsRecording(true);
        setIsPaused(false);
      } catch (error) {
        console.error("Failed to start recording:", error);
        recordingClockRef.current = null;
        onError?.(error.message || "Failed to start recording.");
        setIsRecording(false);
        setMicReady(false);
      }
    },
    [sessionId, onChunkCaptured, onStopCallback, onError, audioUrl],
  );

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (
      recorder &&
      (recorder.state === "recording" || recorder.state === "paused")
    ) {
      recorder.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return {
    isRecording,
    isPaused,
    micReady,
    audioUrl,
    recordedBlob,
    recordingClockRef,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
