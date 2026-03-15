import { describe, it, expect, vi } from 'vitest';
import type { Chess, Move } from 'chess.js';

import { CommandResolver } from '../../../src/chess/commands/command_resolver';
import { Action, type Command } from '../../../src/chess/commands/types';
import { PieceType } from '../../../src/chess/types';
import {
  MissingActionError,
  UnsupportedActionError,
  NoValidMoveError,
  AmbiguousMoveError,
  IllegalCastlingError,
  EmptySquareError,
  NoCaptureTargetError,
} from '../../../src/chess/commands/errors';

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
 * Build a `Chess` test double whose `moves()`, `get()` and `turn()`
 * methods are vitest spies. Board occupancy and side-to-move can be
 * controlled via the optional config object.
 *
 * @param legalMoves  - Array returned by `chess.moves()`.
 * @param config.boardState - Maps square names to pieces; unlisted
 *     squares are treated as empty (get → undefined).
 * @param config.turn - Value returned by `chess.turn()` ('w' | 'b').
 */
function mockChess(
  legalMoves: Move[],
  config: {
    boardState?: Record<string, { type: string; color: string }>;
    turn?: string;
  } = {},
) {
  const movesSpy = vi.fn().mockReturnValue(legalMoves);
  const getSpy = vi.fn().mockImplementation(
    (sq: string) => config.boardState?.[sq] ?? undefined,
  );
  const turnFn = vi.fn().mockReturnValue(config.turn ?? 'w');
  const instance = {
    moves: movesSpy,
    get: getSpy,
    turn: turnFn,
  } as unknown as Chess;
  return { instance, movesSpy, getSpy };
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

  it('throws when an enemy piece exists on the target but no legal capture reaches it', () => {
    const { instance } = mockChess([], {
      boardState: { e5: { type: 'p', color: 'b' } },
      turn: 'w',
    });
    const cmd: Command = { action: Action.Capture, endInfo: 'e5' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });

  it('throws when the requested piece type has zero legal moves', () => {
    const { instance } = mockChess([]); // engine says the queen is stuck
    const cmd: Command = { action: Action.Move, startInfo: PieceType.Queen, endInfo: 'd4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });

  it('throws when a capture targets a piece type not among any captured pieces', () => {
    const { instance } = mockChess([
      makeMove({ from: 'e2', to: 'e4', flags: 'n' }),
    ]);
    const cmd: Command = { action: Action.Capture, endInfo: PieceType.Queen };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoValidMoveError);
  });
});

describe('CommandResolver — EmptySquareError', () => {
  it('throws when the specified source square has no piece on it', () => {
    const { instance } = mockChess([], {
      boardState: {},
    });
    const cmd: Command = { action: Action.Move, startInfo: 'e4', endInfo: 'e5' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(EmptySquareError);
  });

  it('includes the square identifier in the error message', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: Action.Move, startInfo: 'a1', endInfo: 'a3' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(/a1/);
  });

  it('takes priority over NoCaptureTargetError when source square is empty', () => {
    const { instance } = mockChess([]);
    const cmd: Command = { action: Action.Capture, startInfo: 'e4', endInfo: 'e5' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(EmptySquareError);
  });
});

describe('CommandResolver — NoCaptureTargetError', () => {
  it('throws when a capture is requested on an empty square', () => {
    const { instance } = mockChess(
      [makeMove({ from: 'e2', to: 'e4', flags: 'n' })],
      { boardState: {} },
    );
    const cmd: Command = { action: Action.Capture, endInfo: 'e4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoCaptureTargetError);
  });

  it('throws when a capture targets a square occupied by a friendly piece', () => {
    const { instance } = mockChess([], {
      boardState: { d4: { type: 'n', color: 'w' } },
      turn: 'w',
    });
    const cmd: Command = { action: Action.Capture, endInfo: 'd4' };

    expect(() => CommandResolver.resolve(instance, cmd)).toThrow(NoCaptureTargetError);
  });

  it('is NOT thrown when an enemy piece exists but the capture is otherwise illegal', () => {
    const { instance } = mockChess([], {
      boardState: { e5: { type: 'r', color: 'b' } },
      turn: 'w',
    });
    const cmd: Command = { action: Action.Capture, endInfo: 'e5' };

    expect(() => CommandResolver.resolve(instance, cmd)).not.toThrow(NoCaptureTargetError);
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
