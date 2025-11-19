import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

import './App.css'

function App() {
  const [count, setCount] = useState(0)

  async function startStreaming() {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use MediaRecorder to capture 16-bit PCM audio
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 16000 * 16, // 16 kHz × 16-bit
      });

      recorder.ondataavailable = async (event) => {
        const arrayBuffer = await event.data.arrayBuffer();
        socket.send(arrayBuffer);
      };

      recorder.start(100); // send every 100ms
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
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => startStreaming()}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
