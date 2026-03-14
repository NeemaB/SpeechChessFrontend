import { useCallback } from "react";
import Chessboard from "./components/Chessboard";
import type { Api } from "chessground/api";
import { useServices } from "./services/services_context";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import "./App.css";

const App = () => {
  const { gameController, speechToText } = useServices();

  const onBoardReady = useCallback(
    (api: Api) => {
      gameController.attachBoard(api);
    },
    [gameController],
  );

  const startStreaming = useCallback(async () => {
    await speechToText.start((transcript) => {
      console.log("Transcript:", transcript);
      const result = gameController.handleCommand(transcript);
      console.log("Command result:", result);
    });
  }, [speechToText, gameController]);

  return (
    <>
      <h1>Speech Chess</h1>
      <Chessboard onReady={onBoardReady} />
      <div className="card">
        <button onClick={startStreaming}>Start Streaming</button>
      </div>
    </>
  );
};

export default App;
