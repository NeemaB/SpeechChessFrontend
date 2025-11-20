import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

import './App.css'
import { Board } from './chess/board'
import { Color, PieceType, type Move } from './chess/types'

function App() {
  const [count, setCount] = useState(0)

  function testBoard() {
        // Example usage
    const board = new Board();

    // Get piece at a square
    const piece = board.getPieceAt('e2');
    console.log(piece); // { type: 'pawn', color: 'white' }

    // Get valid moves for a square
    const validMoves = board.getValidMovesForSquare('e2');
    console.log(validMoves);
    // [
    //   { piece: 'pawn', color: 'white', startSquare: 'e2', endSquare: 'e3' },
    //   { piece: 'pawn', color: 'white', startSquare: 'e2', endSquare: 'e4' }
    // ]

    // Execute a move
    const move: Move = {
      piece: PieceType.Pawn,
      color: Color.White,
      startSquare: 'e2',
      endSquare: 'e4'
    };

    const success = board.executeMove(move);
    console.log(success); // true

    // Find all knights for a color
    const whiteKnights = board.findPieces(PieceType.Knight, Color.White);
    console.log(whiteKnights); // ['b1', 'g1']

    // Check game state
    const gameState = board.getGameState();
    console.log(gameState.activeColor); // 'black' (after white's move)
  }

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
        <button onClick={() => testBoard()}>
          Test Board
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
