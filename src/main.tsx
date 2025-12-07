import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CommandParser } from './commands/command_parser.ts';

const testCases: Array<{ input: string; description: string }> = [
  { input: 'bd3', description: 'File to square move' },
  { input: 'a6', description: 'Simple square destination' },
  { input: 'pawn takes pawn', description: 'Piece captures piece' },
  { input: 'knight takes', description: 'Piece captures (unspecified target)' },
  { input: 'Knight Takes rook', description: 'Piece captures specific piece' },
  { input: 'bishop f8', description: 'Piece to square' },
  { input: 'g takes h5', description: 'File captures square' },
  { input: 'C4 to d4', description: 'Square to square with explicit action' },
  { input: 'castles', description: 'Generic castle (defaults to short)' },
  { input: 'queen takes a7', description: 'Piece captures at square' },
  { input: 'short castle', description: 'Kingside castle' },
  { input: 'long castle', description: 'Queenside castle' },
  { input: 'e2 e4', description: 'Square to square implicit move' },
  { input: 'knight f Three', description: 'Spoken number handling' },
  { input: 'g two to b six', description: '' },
  { input: 'Bishop to c five', description: 'Piece to square with spoken rank' },
  { input: 'ad five', description: '' },
  { input: "G takes b Five", description: '' },
  { input: "b e 2", description: '' },
  { input: "c four d6", description: '' },
  { input: "b3 a five", description: '' },
  { input: "g to h seven", description: '' },
  { input: "a c four", description: '' },
  { input: "a 6 takes d Three", description: '' },
  { input: "resign", description: 'Resign command' },
  { input: "I resign", description: 'Resign command with pronoun' },
  { input: "Promote", description: 'Promote command' },
  { input: "Promote Pawn", description: 'Promote command with piece' },
];

console.log('Chess Voice Command Parser Tests\n');
console.log('='.repeat(50));

for (const { input, description } of testCases) {
  const result = CommandParser.parseCommand(input);
  console.log(`\n📝 "${input}" (${description})`);
  console.log('   Result:', JSON.stringify(result, null, 2).replace(/\n/g, '\n   '));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
