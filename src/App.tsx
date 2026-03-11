import Chessboard from './components/Chessboard';

import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

import './App.css'

const App = () => {

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
        
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send as ArrayBuffer
        socket.send(int16Data.buffer);
      };
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);  

      if (data.text) {
        console.log("Partial or final transcript:", data.text);
      }
    };
  }

  return (
    <>
      <h1>Speech Chess</h1>
      <Chessboard />
      <div className="card">
        <button onClick={() => startStreaming()}>
          Start Streaming
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  )
}

export default App
