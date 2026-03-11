import { useRef, useCallback } from "react";
import Chessboard from "./components/Chessboard";
import { GameController } from "./chess/game_controller";
import type { Api } from "chessground/api";

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import "./App.css";

const App = () => {
  const controllerRef = useRef<GameController>(new GameController());

  const onBoardReady = useCallback((api: Api) => {
    controllerRef.current.attachBoard(api);
  }, []);

  async function startStreaming() {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        socket.send(int16Data.buffer);
      };
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.transcript) {
        console.log('Transcript:', data.transcript);
        const result = controllerRef.current.handleCommand(data.transcript);
        console.log('Command result:', result);
      }
    };
  }

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
