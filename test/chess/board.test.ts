import { describe, test, expect } from 'vitest';
import { Board } from '../../src/chess/board';
import { Color, Move, PieceType, Square, type File } from '../../src/chess/types';
import { Action, Command } from '../../src/commands/types';

// Helper to create moves quickly
const move = (
  piece: PieceType, 
  color: Color, 
  from: Square, 
  to: Square
): Move => ({
  piece, color, startSquare: from, endSquare: to
});

// Helper to check if a square is in the valid moves
const canMoveTo = (board: Board, from: Square, to: Square): boolean =>
  board.getTargetSquares(from).includes(to);

// Helper to sort squares for comparison
const sortSquares = (squares: Square[]): Square[] => 
  [...squares].sort();

describe('Board Functionality', () => {

  describe('Initialization', () => {
    test('default position has correct piece placement', () => {
      const board = new Board();
      
      // Test key pieces
      const cases: [Square, PieceType, Color][] = [
        ['e1', PieceType.King, Color.White],
        ['e8', PieceType.King, Color.Black],
        ['d1', PieceType.Queen, Color.White],
        ['a1', PieceType.Rook, Color.White],
        ['b8', PieceType.Knight, Color.Black],
        ['e2', PieceType.Pawn, Color.White],
        ['e7', PieceType.Pawn, Color.Black],
      ];
      
      cases.forEach(([sq, type, color]) => {
        const piece = board.getPieceAt(sq);
        expect(piece?.type).toBe(type);
        expect(piece?.color).toBe(color);
      });
    });

    test('empty squares return null', () => {
      const board = new Board();
      ['e4', 'e5', 'd4', 'd5'].forEach(sq => {
        expect(board.getPieceAt(sq as Square)).toBeNull();
      });
    });

    test('FEN parsing creates correct position', () => {
      const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
      const board = Board.fromFEN(fen);
      
      expect(board.getPieceAt('a1')?.type).toBe(PieceType.Rook);
      expect(board.getPieceAt('e1')?.type).toBe(PieceType.King);
      expect(board.getPieceAt('b1')).toBeNull();
      expect(board.getActiveColor()).toBe(Color.White);
    });

    test('FEN round-trip preserves position', () => {
      const positions = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
        '8/8/8/8/8/8/8/4K2k w - - 0 1',
      ];
      
      positions.forEach(fen => {
        const board = Board.fromFEN(fen);
        expect(board.toFEN()).toBe(fen);
      });
    });
  });

  describe('Pawn Movement', () => {
    test.each([
      ['e2', ['e3', 'e4'], 'white pawn initial double move'],
      ['e7', ['e6', 'e5'], 'black pawn initial double move'],
    ])('%s can move to %s (%s)', (from, expected) => {
      const board = new Board();
      if (from[1] === '7') {
        board.executeMove(move(PieceType.Pawn, Color.White, 'a2', 'a3'));
      }
      expect(sortSquares(board.getTargetSquares(from as Square)))
        .toEqual(sortSquares(expected as Square[]));
    });

    test('pawn cannot double move after leaving starting rank', () => {
      const board = Board.fromFEN('8/8/8/8/8/4P3/8/4K2k w - - 0 1');
      expect(board.getTargetSquares('e3')).toEqual(['e4']);
    });

    test('pawn captures diagonally', () => {
      const board = Board.fromFEN('8/8/8/3p4/4P3/8/8/4K2k w - - 0 1');
      expect(sortSquares(board.getTargetSquares('e4'))).toEqual(['d5', 'e5']);
    });

    test('pawn blocked by piece cannot move forward', () => {
      const board = Board.fromFEN('8/8/8/4p3/4P3/8/8/4K2k w - - 0 1');
      expect(board.getTargetSquares('e4')).toEqual([]);
    });

    test('en passant capture is available', () => {
      const board = Board.fromFEN('8/8/8/3Pp3/8/8/8/4K2k w - e6 0 1');
      expect(board.getTargetSquares('d5')).toContain('e6');
    });

    test('en passant capture removes opponent pawn', () => {
      const board = Board.fromFEN('8/8/8/3Pp3/8/8/8/4K2k w - e6 0 1');
      board.executeMove(move(PieceType.Pawn, Color.White, 'd5', 'e6'));
      
      expect(board.getPieceAt('e6')?.type).toBe(PieceType.Pawn);
      expect(board.getPieceAt('e5')).toBeNull();
    });

    test('en passant square set after double pawn push', () => {
      const board = new Board();
      board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      expect(board.getGameState().enPassantSquare).toBe('e3');
    });

    test('en passant square cleared after other moves', () => {
      const board = Board.fromFEN('8/8/8/8/4P3/8/8/4K2k b - e3 0 1');
      board.executeMove(move(PieceType.King, Color.Black, 'h1', 'h2'));
      expect(board.getGameState().enPassantSquare).toBeNull();
    });
  });

  describe('Knight Movement', () => {
    test('knight in center has 8 moves', () => {
      const board = Board.fromFEN('8/8/8/4N3/8/8/8/4K2k w - - 0 1');
      expect(board.getTargetSquares('e5')).toHaveLength(8);
    });

    test('knight in corner has 2 moves', () => {
      const board = Board.fromFEN('N7/8/8/8/8/8/8/4K2k w - - 0 1');
      expect(sortSquares(board.getTargetSquares('a8'))).toEqual(['b6', 'c7']);
    });

    test('knight can jump over pieces', () => {
      const board = new Board();
      expect(board.getTargetSquares('b1')).toContain('c3');
    });
  });

  describe('Sliding Pieces', () => {
    describe('Bishop', () => {
      test('bishop on empty board has correct mobility', () => {
        const board = Board.fromFEN('8/8/8/4B3/8/8/8/4K2k w - - 0 1');
        expect(board.getTargetSquares('e5')).toHaveLength(13);
      });

      test('bishop blocked by friendly pieces', () => {
        const board = Board.fromFEN('8/8/3P4/4B3/8/8/8/4K2k w - - 0 1');
        expect(board.getTargetSquares('e5')).not.toContain('d6');
        expect(board.getTargetSquares('e5')).not.toContain('c7');
      });

      test('bishop can capture but not go through enemy', () => {
        const board = Board.fromFEN('8/8/3p4/4B3/8/8/8/4K2k w - - 0 1');
        expect(board.getTargetSquares('e5')).toContain('d6');
        expect(board.getTargetSquares('e5')).not.toContain('c7');
      });
    });

    describe('Rook', () => {
      test('rook on empty file/rank has 13 moves', () => {
        const board = Board.fromFEN('8/8/8/4R3/8/8/8/4K2k w - - 0 1');
        expect(board.getTargetSquares('e5')).toHaveLength(13);
      });
    });

    describe('Queen', () => {
      test('queen combines rook and bishop movement', () => {
        const board = Board.fromFEN('8/8/8/4Q3/8/8/8/4K2k w - - 0 1');
        expect(board.getTargetSquares('e5')).toHaveLength(26);
      });
    });
  });

  describe('King Movement', () => {
    test('king has 8 moves in open position', () => {
      const board = Board.fromFEN('8/8/8/4K3/8/8/8/7k w - - 0 1');
      expect(board.getTargetSquares('e5')).toHaveLength(8);
    });

    test('king cannot move into check', () => {
      const board = Board.fromFEN('8/8/8/4K3/8/8/r7/7k w - - 0 1');
      const moves = board.getTargetSquares('e5');
      
      // Cannot move to a-file squares (attacked by rook)
      expect(moves).not.toContain('d5');
      expect(moves).not.toContain('d4');
      expect(moves).not.toContain('d6');
    });

    test('king cannot capture protected piece', () => {
      const board = Board.fromFEN('8/8/4p3/4K3/8/8/4r3/7k w - - 0 1');
      expect(board.getTargetSquares('e5')).not.toContain('e6');
    });
  });

  describe('Castling', () => {
    const castlingFEN = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';

    test.each([
      [Color.White, 'e1', 'g1', 'h1', 'f1', 'kingside'],
      [Color.White, 'e1', 'c1', 'a1', 'd1', 'queenside'],
    ])('%s %s castling moves king and rook', (color, kingFrom, kingTo, rookFrom, rookTo) => {
      const board = Board.fromFEN(castlingFEN);
      board.executeMove(move(PieceType.King, color, kingFrom as Square, kingTo as Square));
      
      expect(board.getPieceAt(kingTo as Square)?.type).toBe(PieceType.King);
      expect(board.getPieceAt(rookTo as Square)?.type).toBe(PieceType.Rook);
      expect(board.getPieceAt(kingFrom as Square)).toBeNull();
      expect(board.getPieceAt(rookFrom as Square)).toBeNull();
    });

    test('cannot castle when king has moved', () => {
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1');
      expect(board.getTargetSquares('e1')).not.toContain('g1');
      expect(board.getTargetSquares('e1')).not.toContain('c1');
    });

    test('cannot castle through check', () => {
      const board = Board.fromFEN('r3k2r/pppp1ppp/8/4r3/8/8/PPPP1PPP/R3K2R w KQkq - 0 1');
      expect(board.getTargetSquares('e1')).not.toContain('g1');
      expect(board.getTargetSquares('e1')).not.toContain('c1');
    });

    test('cannot castle out of check', () => {
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPrPPP/R3K2R w KQkq - 0 1');
      expect(board.getTargetSquares('e1')).not.toContain('g1');
    });

    test('cannot castle when pieces block path', () => {
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R2QK1NR w KQkq - 0 1');
      expect(board.getTargetSquares('e1')).not.toContain('g1');
      expect(board.getTargetSquares('e1')).not.toContain('c1');
    });

    test('castling rights removed after rook moves', () => {
      const board = Board.fromFEN(castlingFEN);
      board.executeMove(move(PieceType.Rook, Color.White, 'h1', 'g1'));
      
      const state = board.getGameState();
      expect(state.castlingRights.whiteKingside).toBe(false);
      expect(state.castlingRights.whiteQueenside).toBe(true);
    });

    test('castling rights removed after rook captured', () => {
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/8/7n/PPPPPPPP/R3K2R b KQkq - 0 1');
      board.executeMove(move(PieceType.Knight, Color.Black, 'h3', 'g1'));
      
      // Now simulate taking on h1
      const board2 = Board.fromFEN('r3k2r/pppppppp/8/8/7b/8/PPPPPPPP/R3K2R b KQkq - 0 1');
      board2.executeMove(move(PieceType.Bishop, Color.Black, 'h4', 'h1'));
      
      expect(board2.getGameState().castlingRights.whiteKingside).toBe(false);
    });
  });

  describe('Check and Pin Detection', () => {
    test('piece pinned to king cannot move off pin line', () => {
      const board = Board.fromFEN('8/8/8/8/r2B4/8/8/3K3k w - - 0 1');
      // Bishop on d4 is pinned by rook on a4
      expect(board.getTargetSquares('d4')).toEqual([]);
    });

    test('piece pinned can move along pin line', () => {
      const board = Board.fromFEN('8/8/8/8/r2R3K/8/8/7k w - - 0 1');
      const moves = board.getTargetSquares('d4');
      expect(moves).toContain('a4'); // Can capture
      expect(moves).toContain('b4');
      expect(moves).toContain('c4');
      expect(moves).not.toContain('d5'); // Cannot leave pin
    });

    test('must block or capture when in check', () => {
      const board = Board.fromFEN('8/8/8/8/r3K3/8/4R3/7k w - - 0 1');
      // King in check from rook, only legal moves are king moves or blocking
      const rookMoves = board.getTargetSquares('e2');
      expect(rookMoves).toContain('a2'); // Block
      expect(rookMoves).not.toContain('f2'); // Does not block
    });

    test('double check requires king move', () => {
      const board = Board.fromFEN('8/8/5b2/8/r3K3/8/4R3/7k w - - 0 1');
      // King in double check - rook cannot help
      const rookMoves = board.getTargetSquares('e2');
      expect(rookMoves).toHaveLength(0);
    });

    test('isInCheck returns correct value', () => {
      const inCheck = Board.fromFEN('8/8/8/8/r3K3/8/8/7k w - - 0 1');
      const notInCheck = Board.fromFEN('8/8/8/8/r4K2/8/8/7k w - - 0 1');
      
      expect(inCheck.isInCheck()).toBe(true);
      expect(notInCheck.isInCheck()).toBe(false);
    });
  });

  describe('Game End Conditions', () => {
    test('checkmate detected - back rank mate', () => {
      const board = Board.fromFEN('6k1/5ppp/8/8/8/8/8/r3K3 w - - 0 1');
      const result = board.isGameOver();
      
      expect(result.isOver).toBe(true);
      expect(result.reason).toBe('checkmate');
    });

    test('checkmate detected - smothered mate', () => {
      const board = Board.fromFEN('r7/8/8/8/8/8/5PPP/5RKn w - - 0 1');
      const result = board.isGameOver();
      
      expect(result.isOver).toBe(true);
      expect(result.reason).toBe('checkmate');
    });

    test('stalemate detected', () => {
      const board = Board.fromFEN('k7/8/1K6/8/8/8/8/8 b - - 0 1');
      const result = board.isGameOver();
      
      expect(result.isOver).toBe(true);
      expect(result.reason).toBe('stalemate');
    });

    test('stalemate with pieces still on board', () => {
      const board = Board.fromFEN('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1');
      const result = board.isGameOver();
      
      expect(result.isOver).toBe(true);
      expect(result.reason).toBe('stalemate');
    });

    test('50 move rule detected', () => {
      const board = Board.fromFEN('k7/8/1K6/8/8/8/8/8 w - - 100 50');
      const result = board.isGameOver();
      
      expect(result.isOver).toBe(true);
      expect(result.reason).toBe('draw');
    });

    test('game not over in normal position', () => {
      const board = new Board();
      expect(board.isGameOver().isOver).toBe(false);
    });
  });

  describe('Move Execution', () => {
    test('valid move returns true and updates board', () => {
      const board = new Board();
      const result = board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      
      expect(result).toBe(true);
      expect(board.getPieceAt('e2')).toBeNull();
      expect(board.getPieceAt('e4')?.type).toBe(PieceType.Pawn);
    });

    test('invalid move returns false and preserves board', () => {
      const board = new Board();
      const result = board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e5'));
      
      expect(result).toBe(false);
      expect(board.getPieceAt('e2')?.type).toBe(PieceType.Pawn);
      expect(board.getPieceAt('e5')).toBeNull();
    });

    test('wrong piece type in move returns false', () => {
      const board = new Board();
      const result = board.executeMove(move(PieceType.Knight, Color.White, 'e2', 'e4'));
      
      expect(result).toBe(false);
    });

    test('wrong color in move returns false', () => {
      const board = new Board();
      const result = board.executeMove(move(PieceType.Pawn, Color.Black, 'e2', 'e4'));
      
      expect(result).toBe(false);
    });

    test('move switches active color', () => {
      const board = new Board();
      expect(board.getActiveColor()).toBe(Color.White);
      
      board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      expect(board.getActiveColor()).toBe(Color.Black);
    });

    test('capture removes opponent piece', () => {
      const board = Board.fromFEN('8/8/8/3p4/4N3/8/8/4K2k w - - 0 1');
      board.executeMove(move(PieceType.Knight, Color.White, 'e4', 'd6'));
      
      expect(board.getPieceAt('d6')?.color).toBe(Color.White);
      expect(board.findPieces(PieceType.Pawn, Color.Black)).toHaveLength(0);
    });

    test('half move clock resets on pawn move', () => {
      const board = Board.fromFEN('8/8/8/8/8/8/4P3/4K2k w - - 10 1');
      board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      
      expect(board.getGameState().halfMoveClock).toBe(0);
    });

    test('half move clock resets on capture', () => {
      const board = Board.fromFEN('8/8/8/3p4/4N3/8/8/4K2k w - - 10 1');
      board.executeMove(move(PieceType.Knight, Color.White, 'e4', 'd6'));
      
      expect(board.getGameState().halfMoveClock).toBe(0);
    });

    test('half move clock increments on quiet move', () => {
      const board = Board.fromFEN('8/8/8/8/4N3/8/8/4K2k w - - 10 1');
      board.executeMove(move(PieceType.Knight, Color.White, 'e4', 'f6'));
      
      expect(board.getGameState().halfMoveClock).toBe(11);
    });

    test('full move number increments after black moves', () => {
      const board = new Board();
      board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      expect(board.getGameState().fullMoveNumber).toBe(1);
      
      board.executeMove(move(PieceType.Pawn, Color.Black, 'e7', 'e5'));
      expect(board.getGameState().fullMoveNumber).toBe(2);
    });
  });

  describe('Piece Finding', () => {
    test('findPieces returns correct squares', () => {
      const board = new Board();
      
      const whiteRooks = board.findPieces(PieceType.Rook, Color.White);
      expect(sortSquares(whiteRooks)).toEqual(['a1', 'h1']);
      
      const blackKnights = board.findPieces(PieceType.Knight, Color.Black);
      expect(sortSquares(blackKnights)).toEqual(['b8', 'g8']);
    });

    test('findPieces updates after capture', () => {
      const board = Board.fromFEN('8/8/8/3p4/4N3/8/8/4K2k w - - 0 1');
      board.executeMove(move(PieceType.Knight, Color.White, 'e4', 'd6'));
      
      expect(board.findPieces(PieceType.Pawn, Color.Black)).toHaveLength(0);
    });
  });

  describe('Board Cloning', () => {
    test('clone creates independent copy', () => {
      const board = new Board();
      const clone = board.clone();
      
      board.executeMove(move(PieceType.Pawn, Color.White, 'e2', 'e4'));
      
      expect(board.getPieceAt('e4')?.type).toBe(PieceType.Pawn);
      expect(clone.getPieceAt('e4')).toBeNull();
      expect(clone.getPieceAt('e2')?.type).toBe(PieceType.Pawn);
    });

    test('clone preserves game state', () => {
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/4P3/8/PPPP1PPP/R3K2R b Kq e3 5 10');
      const clone = board.clone();
      const state = clone.getGameState();
      
      expect(state.activeColor).toBe(Color.Black);
      expect(state.castlingRights.whiteKingside).toBe(true);
      expect(state.castlingRights.whiteQueenside).toBe(false);
      expect(state.enPassantSquare).toBe('e3');
      expect(state.halfMoveClock).toBe(5);
      expect(state.fullMoveNumber).toBe(10);
    });
  });

  describe('Move Caching', () => {
    test('repeated calls return consistent results', () => {
      const board = new Board();
      const moves1 = board.getTargetSquares('e2');
      const moves2 = board.getTargetSquares('e2');
      
      expect(moves1).toEqual(moves2);
    });

    test('cache invalidates after move', () => {
      const board = new Board();
      const before = board.getTargetSquares('d1');
      expect(before).toHaveLength(0); // Queen blocked
      
      board.executeMove(move(PieceType.Pawn, Color.White, 'd2', 'd4'));
      board.executeMove(move(PieceType.Pawn, Color.Black, 'e7', 'e6'));
      
      const after = board.getTargetSquares('d1');
      expect(after.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('king vs king is stalemate not checkmate', () => {
      const board = Board.fromFEN('8/8/8/8/8/2k5/8/K7 w - - 0 1');
      const result = board.isGameOver();
      
      // King has moves, so not stalemate yet
      expect(result.isOver).toBe(false);
    });

    test('en passant removes check', () => {
      // Rare case: en passant capturing piece that was giving check
      const board = Board.fromFEN('8/8/8/kPp5/8/8/8/4K3 w - c6 0 1');
      const moves = board.getAllValidMoves();
      expect(moves.some(m => m.endSquare === 'c6')).toBe(true);
    });

    test('cannot castle after rook captured and replaced', () => {
      // Even if a rook appears on h1 later, castling rights are gone
      const board = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Qq - 0 1');
      expect(board.getTargetSquares('e1')).not.toContain('g1');
    });

    test('minimum position - just kings', () => {
      const board = Board.fromFEN('8/8/8/8/8/8/8/4K2k w - - 0 1');
      
      expect(board.getAllValidMoves().length).toBeGreaterThan(0);
      expect(board.isGameOver().isOver).toBe(false);
    });
  });
});

describe('Command Validation', () => {
  test('valid move command recognized', () => {
    const board = Board.fromFEN('rnbqkbnr/pp6/2ppp1pp/5p2/2PQ4/2NB3N/PP1B1PPP/R3K2R w KQkq - 0 8');
    const command : Command = {
      startInfo: 'c4',
      action: Action.Move,
      endInfo: 'c5'
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('valid move command with no startInfo recognized', () => {
    const board = Board.fromFEN('rnbqk1nr/pp6/2pb2Pp/Q1Np1pp1/2B5/1K6/PP1BNPp1/R3P2R w kq - 0 8');
    const command : Command = { 
      startInfo: undefined,
      action: Action.Move,
      endInfo: 'f3'
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid move command for pawn move rejected', () => {
    const board = Board.fromFEN('rnbqkbnr/pp6/2ppp1pp/5p2/2PQ4/2NB3N/PP1B1PPP/R3K2R w KQkq - 0 8');
    const command : Command = {
      startInfo: 'c4',
      action: Action.Move,
      endInfo: 'e5'
    }
    expect(board.isValidCommand(command)).toBe(false);
  });
  
  test('valid move command to square with enemy piece recognized', () => {  
    const board = Board.fromFEN('rnbqk1nr/pp6/2pb3p/Q1NpPpp1/2B5/1K6/PP1BNPp1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: 'a5',
      action: Action.Move,
      endInfo: 'a7'
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid move command to square with friendly piece rejected', () => {
    const board = Board.fromFEN('rnbqk1nr/pp6/2pb3p/Q1NpPpp1/2B5/1K6/PP1BNPp1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.King,
      action: Action.Move,
      endInfo: 'a2'
    }
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid pawn move command with file startInfo recognized', () => {
    const board = Board.fromFEN('rnbqkbnr/pp6/2ppp1pp/5p2/2PQ4/2NB3N/PP1B1PPP/R3K2R w KQkq - 0 8');
    const command : Command = {
      startInfo: 'g',
      action: Action.Move,
      endInfo: 'g4'
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('move command with endInfo as file rejected when ambiguous', () => {
    // Queen on d4 can reach multiple squares on the a-file (a4, a1, a7)
    const board = Board.fromFEN('8/8/8/8/3Q4/8/8/4K2k w - - 0 1');
    const command: Command = {
      startInfo: PieceType.Queen,
      action: Action.Move,
      endInfo: 'a' as File
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('invalid move command for pawn rejected 2', () => {
    const board = Board.fromFEN('rnbqk1nr/pp6/2pbp1Pp/3p1pp1/2B2Q2/1KN5/PP1BNPP1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.Pawn,
      action: Action.Move,
      endInfo: 'f6'
    }
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('pinned queen cannot move off pin line', () => {
    // White queen on b3 pinned by black bishop on a4 to white king on c2
    const board = Board.fromFEN('4k3/8/8/8/b7/1Q6/2K5/8 w - - 0 1');
    const command: Command = {
      startInfo: PieceType.Queen,
      action: Action.Move,
      endInfo: 'e6'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid queen move command recognized', () => {   
    const board = Board.fromFEN('rnbqk1nr/pp6/2pbp2p/3p1pp1/2B2Q2/2N5/PP1BNPPP/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.Queen,
      action: Action.Move,
      endInfo: 'h4'
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid queen move command rejected', () => {  
    const board = Board.fromFEN('rnbqk1nr/pp6/2pbp1Pp/Q2p1pp1/2B5/1KN5/PP1BNPP1/R3P2R w kq - 0 8');
    const command : Command = { 
      startInfo: 'a5',
      action: Action.Move,
      endInfo: 'c3'
    }
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('move command from empty square rejected', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: 'e4',
      action: Action.Move,
      endInfo: 'e5'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('pawn double push blocked by piece on intermediate square rejected', () => {
    // Black pawn on e3 blocks white pawn's double push
    const board = Board.fromFEN('rnbqkbnr/pppp1ppp/8/8/8/4p3/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: 'e2',
      action: Action.Move,
      endInfo: 'e4'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('ambiguous move command rejected when multiple queens can reach same square', () => {
    // Two white queens that can both reach d6
    const board = Board.fromFEN('3Q4/8/8/8/3Q4/8/8/4K2k w - - 0 1');
    const command: Command = {
      startInfo: PieceType.Queen,
      action: Action.Move,
      endInfo: 'd6'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid king move command recognized', () => {  
    const board = Board.fromFEN('rnbqk1nr/pp6/2pbp1Pp/Q2p1pp1/2B5/1KN5/PP1BNPP1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.King,
      action: Action.Move,  
      endInfo: 'a4'
    }
    expect(board.isValidCommand(command)).toBe(true);
  }); 

  test('king move into attacked square rejected', () => {
    // King on e1, black rook on a2 attacks e2
    const board = Board.fromFEN('4k3/8/8/8/8/8/r7/4K3 w - - 0 1');
    const command: Command = {
      startInfo: PieceType.King,
      action: Action.Move,
      endInfo: 'e2'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('queen move blocked by piece in path rejected', () => {
  // Queen on d1 cannot reach d4 because pawn on d2 blocks
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: PieceType.Queen,
      action: Action.Move,
      endInfo: 'd4'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid capture move command recognized', () => { 
     const board = Board.fromFEN('rnbqk1nr/pp6/2pbp1Pp/Q1Np1pp1/2B5/1K6/PP1BNPP1/R3P2R w kq - 0 8');
     const command : Command = {
      startInfo: 'a5',
      action: Action.Capture,
      endInfo: 'd8'
     }
     expect(board.isValidCommand(command)).toBe(true);
  });

  test('valid capture move command with no endInfo recognized', () => {  
    const board = Board.fromFEN('rnbqk1nr/pp6/2pb3p/Q1NpPpp1/2B5/1K6/PP1BNPp1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.Pawn,
      action: Action.Capture,
      endInfo: undefined
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('capture command rejected when target square is empty', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: 'e2',
      action: Action.Capture,
      endInfo: 'e4'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid en passant capture command recognized', () => {
    // White pawn on f5, black just played e7-e5, en passant square is e6
    const board = Board.fromFEN('rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 3');
    const command: Command = {
      startInfo: 'f5',
      action: Action.Capture,
      endInfo: 'e6'
    };
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid capture command rejected as king cannot move multiple ranks', () => {  
    const board = Board.fromFEN('rnbqk1nr/pp6/2pb2Pp/Q1Np1pp1/2B5/1K6/PP1BNPp1/R3P2R w kq - 0 8');
    const command : Command = {
      startInfo: PieceType.King,
      action: Action.Capture,
      endInfo: 'b7'
    }
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid short castling command recognized', () => {
    const board = Board.fromFEN('rnb1kb1r/pppp1ppp/4pn2/6q1/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1');
    const command : Command = {
      startInfo: undefined,
      action: Action.ShortCastle,
      endInfo: undefined
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid short castling command rejected due to castling through check', () => {
    const board = Board.fromFEN('rnb1kb1r/pppp1ppp/4pn2/6q1/2B1PP2/5N2/PPPP1P1P/RNBQK2R w KQkq - 0 1');
    const command : Command = {
      startInfo: undefined,
      action: Action.ShortCastle,
      endInfo: undefined
    } 
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('valid long castling command recognized', () => {
    const board = Board.fromFEN('r1bqkb1r/pp1p1ppp/2n1pn2/2p5/1P4Q1/N1P1P3/PB1P1PPP/R3KBNR w KQkq - 0 1');
    const command : Command = {
      startInfo: undefined,
      action: Action.LongCastle,
      endInfo: undefined
    }
    expect(board.isValidCommand(command)).toBe(true);
  });

  test('invalid long castling command rejected', () => {
    const board = Board.fromFEN('r1bqkb1r/pp1p1ppp/2n1p3/2p5/1P4Q1/N1PnP3/PB1P1PPP/R3KBNR w KQkq - 0 1');
    const command : Command = {
      startInfo: undefined,
      action: Action.LongCastle,
      endInfo: undefined
    }
    expect(board.isValidCommand(command)).toBe(false);  
  });

  test('move command from opponent piece square rejected', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: 'e7',
      action: Action.Move,
      endInfo: 'e5'
    };
    expect(board.isValidCommand(command)).toBe(false);
  }); 

  test('command without action rejected', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      startInfo: 'e2',
      endInfo: 'e4'
    };
    expect(board.isValidCommand(command)).toBe(false);
  });

  test('resign command always valid regardless of position', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const command: Command = {
      action: Action.Resign
    };
    expect(board.isValidCommand(command)).toBe(true);
  });

  // Black to move tests
  test('valid move command for black recognized', () => {
    const board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    const command: Command = {
      startInfo: 'e7',
      action: Action.Move,
      endInfo: 'e5'
    };
    expect(board.isValidCommand(command)).toBe(true);
  });
});