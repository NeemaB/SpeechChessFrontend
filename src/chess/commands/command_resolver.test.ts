import { describe, it, expect, vi } from 'vitest';
import type { Chess, Move } from 'chess.js';

import { CommandResolver } from './command_resolver';
import { Action, type Command } from './types';
import { PieceType } from '../types';
import {
  MissingActionError,
  UnsupportedActionError,
  NoValidMoveError,
  AmbiguousMoveError,
  IllegalCastlingError,
} from './errors';

// ────────────────────────────────────────────────────────────────────────────
// Test doubles
// ────────────────────────────────────────────────────────────────────────────

/**
 * Construct a Move-shaped stub. Only fields the resolver inspects
 * (`from`, `to`, `piece`, `flags`, `captured`, `promotion`) need to be
 * meaningful — everything else is defaulted and then cast.
 */
function makeMove(overrides: Partial<Move> = {}): Move {
  return {
    color: 'w',
    from: 'e2',
    to: 'e4',
    piece: 'p',
    flags: 'n',
    san: '',
    lan: '',
    before: '',
    after: '',
    ...overrides,
  } as Move;
}

/**
 * Build a `Chess` test double whose `moves()` method is a vitest spy
 * returning the supplied list. The spy is exposed so tests can assert on
 * the filter options the resolver passes to chess.js.
 */
function mockChess(legalMoves: Move[]) {
  const movesSpy = vi.fn().mockReturnValue(legalMoves);
  const instance = { moves: movesSpy } as unknown as Chess;
  return { instance, movesSpy };
}

// ────────────────────────────────────────────────────────────────────────────
// Error coverage — each error class exercised by ≥ 2 distinct scenarios
// ────────────────────────────────────────────────────────────────────────────

describe('CommandResolver — MissingActionError', () => {
  it('throws when action is explicitly set to undefined', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: undefined, endInfo: 'e4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(MissingActionError);
  });

  it('throws when the command object has no fields at all', () => {
    const { instance } = mockChess([]);
    const cmd: Command = {};

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(MissingActionError);
  });
});

describe('CommandResolver — UnsupportedActionError', () => {
  it('throws for Resign (must be handled by the game controller)', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: Action.Resign };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(UnsupportedActionError);
  });

  it('throws for standalone Promote (no move to attach the promotion to)', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: Action.Promote };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(UnsupportedActionError);
  });
});

describe('CommandResolver — IllegalCastlingError', () => {
  it('throws when O-O is requested but the king only has quiet moves', () => {
    const { instance } = mockChess([
      makeMove({ piece: 'k', from: 'e1', to: 'f1', flags: 'n' }),
      makeMove({ piece: 'k', from: 'e1', to: 'd1', flags: 'n' }),
    ]);
    const cmd: Command = { action: Action.ShortCastle };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(IllegalCastlingError);
  });

  it('throws when O-O-O is requested but only kingside castling is legal', () => {
    const { instance } = mockChess([
      makeMove({ piece: 'k', from: 'e1', to: 'g1', flags: 'k' }),
    ]);
    const cmd: Command = { action: Action.LongCastle };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(IllegalCastlingError);
  });

  it('throws when the king has no legal moves whatsoever', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: Action.ShortCastle };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(IllegalCastlingError);
  });
});

describe('CommandResolver — NoValidMoveError', () => {
  it('throws when nothing in the legal list reaches the target square', () => {
    const { instance } = mockChess([
      makeMove({ from: 'e2', to: 'e4' }),
      makeMove({ from: 'd2', to: 'd4' }),
    ]);
    const cmd: Command = { action: Action.Move, endInfo: 'h5' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });

  it('throws when a capture is requested but the only matching move is quiet', () => {
    const { instance } = mockChess([
      makeMove({ from: 'e2', to: 'e4', flags: 'n' }), // quiet push, not a capture
    ]);
    const cmd: Command = { action: Action.Capture, endInfo: 'e4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });

  it('throws when the requested piece type has zero legal moves', () => {
    const { instance } = mockChess([]); // engine says the queen is stuck
    const cmd: Command = { action: Action.Move, startInfo: PieceType.Queen, endInfo: 'd4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });
});

describe('CommandResolver — AmbiguousMoveError', () => {
  it('throws when two knights can both reach the same square', () => {
    const { instance } = mockChess([
      makeMove({ piece: 'n', from: 'b1', to: 'd2' }),
      makeMove({ piece: 'n', from: 'f3', to: 'd2' }),
    ]);
    const cmd: Command = { action: Action.Move, startInfo: PieceType.Knight, endInfo: 'd2' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(AmbiguousMoveError);
  });

  it('throws when two rooks on the same rank can both reach a square', () => {
    const { instance } = mockChess([
      makeMove({ piece: 'r', from: 'a1', to: 'd1' }),
      makeMove({ piece: 'r', from: 'h1', to: 'd1' }),
    ]);
    const cmd: Command = { action: Action.Move, startInfo: PieceType.Rook, endInfo: 'd1' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(AmbiguousMoveError);
  });

  it('throws when a bare destination square matches pieces of different types', () => {
    const { instance } = mockChess([
      makeMove({ piece: 'n', from: 'b1', to: 'c3' }),
      makeMove({ piece: 'p', from: 'c2', to: 'c3' }),
    ]);
    const cmd: Command = { action: Action.Move, endInfo: 'c3' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(AmbiguousMoveError);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Happy paths
// ────────────────────────────────────────────────────────────────────────────

describe('CommandResolver — successful resolution', () => {
  it('resolves a move by destination square alone', () => {
    const target = makeMove({ from: 'e2', to: 'e4' });
    const { instance } = mockChess([target, makeMove({ from: 'd2', to: 'd4' })]);

    const result = CommandResolver.resolve(instance, { action: Action.Move, endInfo: 'e4' });

    expect(result).toBe(target);
  });

  it('resolves a move disambiguated by source square', () => {
    const target = makeMove({ piece: 'n', from: 'b1', to: 'd2' });
    const { instance } = mockChess([target]);

    const result = CommandResolver.resolve(instance, {
      action: Action.Move,
      startInfo: 'b1',
      endInfo: 'd2',
    });

    expect(result).toBe(target);
  });

  it('resolves a move disambiguated by piece type', () => {
    const target = makeMove({ piece: 'n', from: 'g1', to: 'f3' });
    const { instance } = mockChess([target]);

    const result = CommandResolver.resolve(instance, {
      action: Action.Move,
      startInfo: PieceType.Knight,
      endInfo: 'f3',
    });

    expect(result).toBe(target);
  });

  it('resolves a move disambiguated by source file', () => {
    const target = makeMove({ piece: 'p', from: 'd4', to: 'e5', flags: 'c', captured: 'p' });
    const noise = makeMove({ piece: 'p', from: 'f4', to: 'e5', flags: 'c', captured: 'p' });
    const { instance } = mockChess([target, noise]);

    const result = CommandResolver.resolve(instance, {
      action: Action.Move,
      startInfo: 'd',
      endInfo: 'e5',
    });

    expect(result).toBe(target);
  });

  it('resolves a standard capture', () => {
    const target = makeMove({ piece: 'n', from: 'f3', to: 'e5', flags: 'c', captured: 'p' });
    const quiet = makeMove({ piece: 'p', from: 'e4', to: 'e5', flags: 'n' });
    const { instance } = mockChess([target, quiet]);

    const result = CommandResolver.resolve(instance, { action: Action.Capture, endInfo: 'e5' });

    expect(result).toBe(target);
  });

  it('resolves “takes <piece>” by matching the captured-piece type', () => {
    const target = makeMove({ piece: 'b', from: 'c1', to: 'h6', flags: 'c', captured: 'r' });
    const wrong = makeMove({ piece: 'b', from: 'c1', to: 'g5', flags: 'c', captured: 'n' });
    const { instance } = mockChess([target, wrong]);

    const result = CommandResolver.resolve(instance, {
      action: Action.Capture,
      startInfo: PieceType.Bishop,
      endInfo: PieceType.Rook,
    });

    expect(result).toBe(target);
  });

  it('treats en-passant (flag “e”) as a capture', () => {
    const target = makeMove({ piece: 'p', from: 'e5', to: 'd6', flags: 'e', captured: 'p' });
    const { instance } = mockChess([target]);

    const result = CommandResolver.resolve(instance, { action: Action.Capture, endInfo: 'd6' });

    expect(result).toBe(target);
  });

  it('resolves kingside castling from the king’s move list', () => {
    const target = makeMove({ piece: 'k', from: 'e1', to: 'g1', flags: 'k' });
    const { instance } = mockChess([
      target,
      makeMove({ piece: 'k', from: 'e1', to: 'f1', flags: 'n' }),
    ]);

    const result = CommandResolver.resolve(instance, { action: Action.ShortCastle });

    expect(result).toBe(target);
  });

  it('resolves queenside castling from the king’s move list', () => {
    const target = makeMove({ piece: 'k', from: 'e1', to: 'c1', flags: 'q' });
    const { instance } = mockChess([target]);

    const result = CommandResolver.resolve(instance, { action: Action.LongCastle });

    expect(result).toBe(target);
  });

  it('collapses a four-way promotion fan-out to the queen promotion', () => {
    const queen = makeMove({ from: 'a7', to: 'a8', flags: 'np', promotion: 'q' });
    const { instance } = mockChess([
      makeMove({ from: 'a7', to: 'a8', flags: 'np', promotion: 'r' }),
      queen,
      makeMove({ from: 'a7', to: 'a8', flags: 'np', promotion: 'b' }),
      makeMove({ from: 'a7', to: 'a8', flags: 'np', promotion: 'n' }),
    ]);

    const result = CommandResolver.resolve(instance, { action: Action.Move, endInfo: 'a8' });

    expect(result).toBe(queen);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// chess.js query optimisation — verifies filter options are forwarded
// ────────────────────────────────────────────────────────────────────────────

describe('CommandResolver — chess.js filter delegation', () => {
  it('passes the source square to chess.moves() when startInfo is a square', () => {
    const { instance, movesSpy } = mockChess([makeMove({ from: 'e2', to: 'e4' })]);

    CommandResolver.resolve(instance, { action: Action.Move, startInfo: 'e2', endInfo: 'e4' });

    expect(movesSpy).toHaveBeenCalledWith({ verbose: true, square: 'e2' });
  });

  it('passes the piece symbol to chess.moves() when startInfo is a piece type', () => {
    const { instance, movesSpy } = mockChess([
      makeMove({ piece: 'n', from: 'g1', to: 'f3' }),
    ]);

    CommandResolver.resolve(instance, {
      action: Action.Move,
      startInfo: PieceType.Knight,
      endInfo: 'f3',
    });

    expect(movesSpy).toHaveBeenCalledWith({ verbose: true, piece: 'n' });
  });

  it('falls back to an unfiltered query when startInfo is a file', () => {
    const { instance, movesSpy } = mockChess([makeMove({ from: 'd2', to: 'd4' })]);

    CommandResolver.resolve(instance, { action: Action.Move, startInfo: 'd', endInfo: 'd4' });

    expect(movesSpy).toHaveBeenCalledWith({ verbose: true });
  });

  it('falls back to an unfiltered query when startInfo is absent', () => {
    const { instance, movesSpy } = mockChess([makeMove({ from: 'e2', to: 'e4' })]);

    CommandResolver.resolve(instance, { action: Action.Move, endInfo: 'e4' });

    expect(movesSpy).toHaveBeenCalledWith({ verbose: true });
  });

  it('restricts castling queries to king moves only', () => {
    const { instance, movesSpy } = mockChess([
      makeMove({ piece: 'k', from: 'e1', to: 'g1', flags: 'k' }),
    ]);

    CommandResolver.resolve(instance, { action: Action.ShortCastle });

    expect(movesSpy).toHaveBeenCalledWith({ verbose: true, piece: 'k' });
  });
});
