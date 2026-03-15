import { useCallback, useEffect, useRef, useState } from "react";
import Chessboard from "./components/Chessboard";
import type { Api } from "chessground/api";
import { useServices } from "./services/services";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import "./App.css";

const MicrophoneIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="streaming-toggle__icon">
    <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor" />
    <path
      d="M18 11a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.06A8 8 0 0 1 4 11a1 1 0 1 1 2 0 6 6 0 0 0 12 0Z"
      fill="currentColor"
    />
  </svg>
);

const App = () => {
  const { gameController, speechToText } = useServices();
  const [isStreaming, setIsStreaming] = useState(() => speechToText.isActive());
  const [isStreamingPending, setIsStreamingPending] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [isCommandError, setIsCommandError] = useState(false);
  const errorFlashTimeoutRef = useRef<number | null>(null);

  const onBoardReady = useCallback(
    (api: Api) => {
      gameController.attachBoard(api);
    },
    [gameController],
  );

  const triggerCommandErrorFlash = useCallback(() => {
    if (errorFlashTimeoutRef.current !== null) {
      window.clearTimeout(errorFlashTimeoutRef.current);
    }

    setIsCommandError(true);
    errorFlashTimeoutRef.current = window.setTimeout(() => {
      setIsCommandError(false);
      errorFlashTimeoutRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (errorFlashTimeoutRef.current !== null) {
        window.clearTimeout(errorFlashTimeoutRef.current);
      }

      if (speechToText.isActive()) {
        void speechToText.stop();
      }
    };
  }, [speechToText]);

  const handleTranscript = useCallback(
    (transcript: string) => {
      setLastTranscript(transcript);

      const result = gameController.handleCommand(transcript);
      if (!result.success && result.errorStage !== undefined) {
        triggerCommandErrorFlash();
      }
    },
    [gameController, triggerCommandErrorFlash],
  );

  const toggleStreaming = useCallback(async () => {
    if (isStreamingPending) {
      return;
    }

    setIsStreamingPending(true);

    try {
      if (isStreaming) {
        await speechToText.stop();
        setIsStreaming(false);
        return;
      }

      setLastTranscript("");
      await speechToText.start(handleTranscript);
      setIsStreaming(true);
    } catch (error) {
      console.error("Failed to toggle voice streaming", error);
      setIsStreaming(speechToText.isActive());
    } finally {
      setIsStreamingPending(false);
    }
  }, [handleTranscript, isStreaming, isStreamingPending, speechToText]);

  return (
    <>
      <h1>Speech Chess</h1>
      <Chessboard onReady={onBoardReady} />
      <div className={`card streaming-controls${isCommandError ? " streaming-controls--error" : ""}`}>
        <button
          type="button"
          className={`streaming-toggle${isStreaming ? " streaming-toggle--active" : ""}`}
          onClick={() => void toggleStreaming()}
          disabled={isStreamingPending}
          aria-label={isStreaming ? "Stop voice streaming" : "Start voice streaming"}
          aria-pressed={isStreaming}
          title={isStreaming ? "Stop voice streaming" : "Start voice streaming"}
        >
          <MicrophoneIcon />
        </button>
        {isStreaming ? (
          <label className="transcript-field">
            <span className="sr-only">Last completed transcript</span>
            <input
              type="text"
              className="transcript-field__input"
              value={lastTranscript}
              readOnly
              placeholder="Waiting for completed transcript..."
            />
          </label>
        ) : null}
      </div>
    </>
  );
};

export default App;
