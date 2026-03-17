import { useCallback, useEffect, useRef, useState } from "react";
import Chessboard from "./components/Chessboard";
import type { Api } from "chessground/api";
import { useServices } from "./services/services";
import MicrophoneIcon from "./assets/MicrophoneIcon";
import SwapIcon from "./assets/SwapIcon";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import "./App.css";

const App = () => {
  const { gameController, speechToText } = useServices();
  const [isStreaming, setIsStreaming] = useState(() => speechToText.isActive());
  const [isStreamingPending, setIsStreamingPending] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [isCommandError, setIsCommandError] = useState(false);
  const [playerColor, setPlayerColor] = useState<"white" | "black">(
    gameController.getPlayerColor(),
  );
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isStarting, setIsStarting] = useState(false);
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

  const togglePlayerColor = useCallback(() => {
    if (gameStarted) return;
    const newColor = playerColor === 'white' ? 'black' : 'white';
    gameController.setPlayerColor(newColor);
    setPlayerColor(newColor);
  }, [gameController, gameStarted, playerColor]);

  const handleStartGame = useCallback(async () => {
    if (isStarting || gameStarted) return;
    setIsStarting(true);
    try {
      await gameController.setDifficulty(difficulty);
      await gameController.startGame();
      setGameStarted(true);
    } catch (err) {
      console.error('Failed to start game:', err);
    } finally {
      setIsStarting(false);
    }
  }, [difficulty, gameController, gameStarted, isStarting]);

  return (
    <>
      <h1>Speech Chess</h1>

      {!gameStarted && (
        <div className="pregame-controls">
          <div className="color-select">
            <span className="color-select__label">
              Playing as <strong>{playerColor}</strong>
            </span>
            <button
              type="button"
              className="color-select__button"
              onClick={togglePlayerColor}
              title="Switch color"
            >
              <SwapIcon /> Swap
            </button>
          </div>

          <div className="difficulty-select">
            <label className="difficulty-select__label" htmlFor="difficulty">
              Difficulty
            </label>
            <select
              id="difficulty"
              className="difficulty-select__input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button
            type="button"
            className="start-game-button"
            onClick={() => void handleStartGame()}
            disabled={isStarting}
          >
            {isStarting ? 'Starting…' : 'Start Game'}
          </button>
        </div>
      )}

      <Chessboard
        config={{ orientation: playerColor }}
        onReady={onBoardReady}
      />

      {gameStarted && (
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
      )}
    </>
  );
};

export default App;
