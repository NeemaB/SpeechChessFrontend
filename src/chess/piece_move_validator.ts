import type { Square, Piece } from './types';
import { Color, PieceType } from './types';
import { SquareUtils } from './square_utils';
import type { BoardStateReader } from './board_state';

/**
 * Validates piece movement rules for supported piece types.
 * Does not check for check/pin constraints - only basic movement patterns.
 */
export class PieceMoveValidator {

  /**
   * Validate if a piece can move from one square to another based on movement rules.
   * Only validates King, Queen, and Pawn movements currently.
   */
  static canPieceMoveTo(
    piece: Piece,
    from: Square,
    to: Square,
    boardState: BoardStateReader
  ): boolean {
    switch (piece.type) {
      case PieceType.King:
        return this.canKingMoveTo(from, to);
      case PieceType.Queen:
        return this.canQueenMoveTo(from, to, boardState);
      case PieceType.Pawn:
        return this.canPawnMoveTo(piece.color, from, to, boardState);
      default:
        return false;
    }
  }

  /**
   * Check if king can move from start to end (one square in any direction).
   * Does not include castling - that's handled separately.
   */
  static canKingMoveTo(from: Square, to: Square): boolean {
    const fromFile = SquareUtils.getFile(from);
    const fromRank = SquareUtils.getRank(from);
    const toFile = SquareUtils.getFile(to);
    const toRank = SquareUtils.getRank(to);

    const fileDiff = Math.abs(toFile - fromFile);
    const rankDiff = Math.abs(toRank - fromRank);

    return fileDiff <= 1 && rankDiff <= 1;
  }

  /**
   * Check if queen can move from start to end (straight or diagonal line).
   * Validates path is clear of obstructions.
   */
  static canQueenMoveTo(from: Square, to: Square, boardState: BoardStateReader): boolean {
    const fromFile = SquareUtils.getFile(from);
    const fromRank = SquareUtils.getRank(from);
    const toFile = SquareUtils.getFile(to);
    const toRank = SquareUtils.getRank(to);

    const fileDiff = toFile - fromFile;
    const rankDiff = toRank - fromRank;

    const isStraight = fileDiff === 0 || rankDiff === 0;
    const isDiagonal = Math.abs(fileDiff) === Math.abs(rankDiff);

    if (!isStraight && !isDiagonal) return false;

    return this.isPathClear(fromFile, fromRank, toFile, toRank, boardState);
  }

  /**
   * Check if pawn can move following pawn movement rules.
   * Includes forward moves, captures, double push, and en passant.
   */
  static canPawnMoveTo(
    color: Color,
    from: Square,
    to: Square,
    boardState: BoardStateReader
  ): boolean {
    const fromFile = SquareUtils.getFile(from);
    const fromRank = SquareUtils.getRank(from);
    const toFile = SquareUtils.getFile(to);
    const toRank = SquareUtils.getRank(to);

    const direction = color === Color.White ? 1 : -1;
    const startRank = color === Color.White ? 1 : 6;

    const fileDiff = toFile - fromFile;
    const rankDiff = toRank - fromRank;

    // Forward move (one square)
    if (fileDiff === 0 && rankDiff === direction) {
      return boardState.getPieceAt(to) === null;
    }

    // Forward move (two squares from start)
    if (fileDiff === 0 && rankDiff === 2 * direction && fromRank === startRank) {
      const middleRank = fromRank + direction;
      const middleSquare = SquareUtils.fromIndex(
        SquareUtils.fileRankToIndex(fromFile, middleRank)
      );
      return boardState.getPieceAt(middleSquare) === null &&
        boardState.getPieceAt(to) === null;
    }

    // Diagonal capture
    if (Math.abs(fileDiff) === 1 && rankDiff === direction) {
      const targetPiece = boardState.getPieceAt(to);
      return (targetPiece !== null && targetPiece.color !== color) ||
        to === boardState.getEnPassantSquare();
    }

    return false;
  }

  /**
   * Check if the path between two squares is clear (for sliding pieces).
   * Assumes the move is along a valid straight or diagonal line.
   */
  static isPathClear(
    fromFile: number,
    fromRank: number,
    toFile: number,
    toRank: number,
    boardState: BoardStateReader
  ): boolean {
    const fileStep = toFile === fromFile ? 0 : (toFile > fromFile ? 1 : -1);
    const rankStep = toRank === fromRank ? 0 : (toRank > fromRank ? 1 : -1);

    let file = fromFile + fileStep;
    let rank = fromRank + rankStep;

    while (file !== toFile || rank !== toRank) {
      const index = SquareUtils.fileRankToIndex(file, rank);
      if (boardState.getPieceAtIndex(index) !== null) return false;
      file += fileStep;
      rank += rankStep;
    }

    return true;
  }

  /** Check if piece type is currently supported for validation */
  static isSupportedPieceType(type: PieceType): boolean {
    return type === PieceType.King ||
      type === PieceType.Queen ||
      type === PieceType.Pawn;
  }
}