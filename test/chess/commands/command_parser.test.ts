import { describe, it, expect } from 'vitest';
import { CommandParser } from '../../../src/chess/commands/command_parser';
import { Action, CommandInfo } from '../../../src/chess/commands/types';
import { PieceType } from '../../../src/chess/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a Move action with optional start/end info. */
function expectMove(
  input: string,
  opts: { startInfo?: CommandInfo; endInfo?: CommandInfo } = {}
) {
  const result = CommandParser.parseCommand(input);
  expect(result.action).toBe(Action.Move);
  if ('startInfo' in opts) expect(result.startInfo).toEqual(opts.startInfo);
  if ('endInfo' in opts) expect(result.endInfo).toEqual(opts.endInfo);
}

/** Assert a Capture action with optional start/end info. */
function expectCapture(
  input: string,
  opts: { startInfo?: CommandInfo; endInfo?: CommandInfo } = {}
) {
  const result = CommandParser.parseCommand(input);
  expect(result.action).toBe(Action.Capture);
  if ('startInfo' in opts) expect(result.startInfo).toEqual(opts.startInfo);
  if ('endInfo' in opts) expect(result.endInfo).toEqual(opts.endInfo);
}

// ---------------------------------------------------------------------------
// Simple destination moves
// ---------------------------------------------------------------------------

describe('Simple square destination', () => {
  it('parses a bare square as an implicit Move to that square', () => {
    expectMove('a6', { endInfo: 'a6' });
  });

  it('treats the square as case-insensitive', () => {
    expectMove('A6', { endInfo: 'a6' });
  });
});

// ---------------------------------------------------------------------------
// Square-to-square moves
// ---------------------------------------------------------------------------

describe('Square to square', () => {
  it('parses two squares separated by a space as an implicit Move', () => {
    expectMove('e2 e4', { startInfo: 'e2', endInfo: 'e4' });
  });

  it('parses "C4 to d4" as an explicit Move', () => {
    expectMove('C4 to d4', { startInfo: 'c4', endInfo: 'd4' });
  });

  it('parses spoken ranks in a two-square command', () => {
    expectMove('g two to b six', { startInfo: 'g2', endInfo: 'b6' });
  });

  it('parses adjacent square pair without connector', () => {
    expectMove('c four d6', { startInfo: 'c4', endInfo: 'd6' });
  });

  it('parses square pair with spoken ranks on both sides', () => {
    expectMove('b3 a five', { startInfo: 'b3', endInfo: 'a5' });
  });
});

// ---------------------------------------------------------------------------
// File-to-square moves
// ---------------------------------------------------------------------------

describe('File to square', () => {
  it('parses "bd3" as file b + square d3', () => {
    expectMove('bd3', { startInfo: 'b', endInfo: 'd3' });
  });

  it('parses "ad five" as file a + square d5', () => {
    expectMove('ad five', { startInfo: 'a', endInfo: 'd5' });
  });

  it('parses "g to h seven" as file g moving to h7', () => {
    expectMove('g to h seven', { startInfo: 'g', endInfo: 'h7' });
  });
});

// ---------------------------------------------------------------------------
// Piece-to-square moves
// ---------------------------------------------------------------------------

describe('Piece to square', () => {
  it('parses "bishop f8" as Bishop moving to f8', () => {
    expectMove('bishop f8', { startInfo: PieceType.Bishop, endInfo: 'f8' });
  });

  it('parses "Bishop to c five" with spoken rank', () => {
    expectMove('Bishop to c five', { startInfo: PieceType.Bishop, endInfo: 'c5' });
  });

  it('parses "knight f Three" with spoken rank', () => {
    expectMove('knight f Three', { startInfo: PieceType.Knight, endInfo: 'f3' });
  });

  it('parses "a c four" as file a + square c4 (not piece)', () => {
    // 'a' is a file, not a piece name
    expectMove('a c four', { startInfo: 'a', endInfo: 'c4' });
  });
});

// ---------------------------------------------------------------------------
// Capture commands
// ---------------------------------------------------------------------------

describe('Capture commands', () => {
  it('parses "pawn takes pawn" as Pawn capturing Pawn', () => {
    expectCapture('pawn takes pawn', {
      startInfo: PieceType.Pawn,
      endInfo: PieceType.Pawn,
    });
  });

  it('parses "knight takes" with no target info', () => {
    expectCapture('knight takes', { startInfo: PieceType.Knight });
  });

  it('parses "Knight Takes rook" as Knight capturing Rook', () => {
    expectCapture('Knight Takes rook', {
      startInfo: PieceType.Knight,
      endInfo: PieceType.Rook,
    });
  });

  it('parses "queen takes a7" as Queen capturing at a7', () => {
    expectCapture('queen takes a7', {
      startInfo: PieceType.Queen,
      endInfo: 'a7',
    });
  });

  it('parses "g takes h5" as file g capturing at h5', () => {
    expectCapture('g takes h5', { startInfo: 'g', endInfo: 'h5' });
  });

  it('parses "G takes b Five" with spoken rank, case-insensitive', () => {
    expectCapture('G takes b Five', { startInfo: 'g', endInfo: 'b5' });
  });

  it('parses "a 6 takes d Three" as square a6 capturing at d3', () => {
    expectCapture('a 6 takes d Three', { startInfo: 'a6', endInfo: 'd3' });
  });
});

// ---------------------------------------------------------------------------
// Castling commands
// ---------------------------------------------------------------------------

describe('Castling commands', () => {
  it('parses "castles" as ShortCastle by default', () => {
    const result = CommandParser.parseCommand('castles');
    expect(result.action).toBe(Action.ShortCastle);
  });

  it('parses "short castle" as ShortCastle', () => {
    const result = CommandParser.parseCommand('short castle');
    expect(result.action).toBe(Action.ShortCastle);
  });

  it('parses "long castle" as LongCastle', () => {
    const result = CommandParser.parseCommand('long castle');
    expect(result.action).toBe(Action.LongCastle);
  });

  it('parses "castles queenside" as LongCastle', () => {
    const result = CommandParser.parseCommand('castles queenside');
    expect(result.action).toBe(Action.LongCastle);
  });

  it('carries no startInfo or endInfo on castle commands', () => {
    const result = CommandParser.parseCommand('short castle');
    expect(result.startInfo).toBeUndefined();
    expect(result.endInfo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Resign command
// ---------------------------------------------------------------------------

describe('Resign command', () => {
  it('parses "resign"', () => {
    const result = CommandParser.parseCommand('resign');
    expect(result.action).toBe(Action.Resign);
  });

  it('parses "I resign"', () => {
    const result = CommandParser.parseCommand('I resign');
    expect(result.action).toBe(Action.Resign);
  });

  it('carries no startInfo or endInfo', () => {
    const result = CommandParser.parseCommand('resign');
    expect(result.startInfo).toBeUndefined();
    expect(result.endInfo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Promote command
// ---------------------------------------------------------------------------

describe('Promote command', () => {
  it('parses "Promote"', () => {
    const result = CommandParser.parseCommand('Promote');
    expect(result.action).toBe(Action.Promote);
  });

  it('parses "Promote Pawn"', () => {
    const result = CommandParser.parseCommand('Promote Pawn');
    expect(result.action).toBe(Action.Promote);
  });

  it('parses "pawn promote"', () => {
    const result = CommandParser.parseCommand('pawn promote');
    expect(result.action).toBe(Action.Promote);
  });
});

// ---------------------------------------------------------------------------
// Preprocessing — spoken number normalisation
// ---------------------------------------------------------------------------

describe('Spoken number normalisation', () => {
  it('converts "one" through "eight" to digits', () => {
    expectMove('e two e four', { startInfo: 'e2', endInfo: 'e4' });
  });

  it('handles mixed digit and spoken rank in same command', () => {
    expectMove('f2 to f four', { startInfo: 'f2', endInfo: 'f4' });
  });
});

// ---------------------------------------------------------------------------
// Edge cases / ambiguous input
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('throws on empty input', () => {
    expect(() => CommandParser.parseCommand('')).toThrow();
  });

  it('parses "be 2" — "b" as file, "e2" as square', () => {
    // "be 2" preprocesses to "be2" → file 'b' + square 'e2'
    expectMove('b e 2', { startInfo: 'b', endInfo: 'e2' });
  });
});