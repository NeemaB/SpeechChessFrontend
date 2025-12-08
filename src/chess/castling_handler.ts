import type { Move } from './types';
import { Color, PieceType } from './types';
import { SquareUtils } from './square_utils';
import type { BoardStateReader } from './board_state';
import { AttackDetector } from './attack_detector';

/**
 * Handles castling validation and move generation.
 */
export class CastlingHandler {

  public static canCastleKingside(boardState: BoardStateReader): boolean {
    const color = boardState.getActiveColor();
    const rights = boardState.getCastlingRights();
    const canKingside = color === Color.White ?
      rights.whiteKingside : rights.blackKingside;

    if (!canKingside) return false;

    return CastlingHandler.validateCastlingPath(boardState, color, true);
  }

  public static canCastleQueenside(boardState: BoardStateReader): boolean {
    const color = boardState.getActiveColor();
    const rights = boardState.getCastlingRights();
    const canQueenside = color === Color.White ?
      rights.whiteQueenside : rights.blackQueenside;

    if (!canQueenside) return false;

    return CastlingHandler.validateCastlingPath(boardState, color, false);
  }

  public static getCastlingMoves(boardState: BoardStateReader, color: Color): Move[] {
    const moves: Move[] = [];
    const rank = color === Color.White ? 0 : 7;
    const kingIndex = SquareUtils.fileRankToIndex(4, rank);
    const opponentColor = color === Color.White ? Color.Black : Color.White;

    if (AttackDetector.isSquareAttacked(boardState.getAllSquarePieces(), kingIndex, opponentColor)) {
      return moves;
    }

    if (CastlingHandler.canCastleKingsideForColor(boardState, color)) {
      moves.push({
        piece: PieceType.King,
        color,
        startSquare: SquareUtils.fromIndex(kingIndex),
        endSquare: SquareUtils.fromIndex(SquareUtils.fileRankToIndex(6, rank))
      });
    }

    if (CastlingHandler.canCastleQueensideForColor(boardState, color)) {
      moves.push({
        piece: PieceType.King,
        color,
        startSquare: SquareUtils.fromIndex(kingIndex),
        endSquare: SquareUtils.fromIndex(SquareUtils.fileRankToIndex(2, rank))
      });
    }

    return moves;
  }

  private static canCastleKingsideForColor(boardState: BoardStateReader, color: Color): boolean {
    const rights = boardState.getCastlingRights();
    const canKingside = color === Color.White ?
      rights.whiteKingside : rights.blackKingside;

    if (!canKingside) return false;
    return CastlingHandler.validateCastlingPath(boardState, color, true);
  }

  private static canCastleQueensideForColor(boardState: BoardStateReader, color: Color): boolean {
    const rights = boardState.getCastlingRights();
    const canQueenside = color === Color.White ?
      rights.whiteQueenside : rights.blackQueenside;

    if (!canQueenside) return false;
    return CastlingHandler.validateCastlingPath(boardState, color, false);
  }

  private static validateCastlingPath(boardState: BoardStateReader, color: Color, kingside: boolean): boolean {
    const rank = color === Color.White ? 0 : 7;
    const opponentColor = color === Color.White ? Color.Black : Color.White;
    const kingIndex = SquareUtils.fileRankToIndex(4, rank);
    const pieceSquares = boardState.getAllSquarePieces();

    if (AttackDetector.isSquareAttacked(pieceSquares, kingIndex, opponentColor)) {
      return false;
    }

    if (kingside) {
      const f = SquareUtils.fileRankToIndex(5, rank);
      const g = SquareUtils.fileRankToIndex(6, rank);

      return boardState.getPieceAtIndex(f) === null &&
        boardState.getPieceAtIndex(g) === null &&
        !AttackDetector.isSquareAttacked(pieceSquares, f, opponentColor) &&
        !AttackDetector.isSquareAttacked(pieceSquares, g, opponentColor);
    } else {
      const b = SquareUtils.fileRankToIndex(1, rank);
      const c = SquareUtils.fileRankToIndex(2, rank);
      const d = SquareUtils.fileRankToIndex(3, rank);

      return boardState.getPieceAtIndex(b) === null &&
        boardState.getPieceAtIndex(c) === null &&
        boardState.getPieceAtIndex(d) === null &&
        !AttackDetector.isSquareAttacked(pieceSquares, c, opponentColor) &&
        !AttackDetector.isSquareAttacked(pieceSquares, d, opponentColor);
    }
  }
}