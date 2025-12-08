import { Color, type Piece, PieceType } from './types';
import { SquareUtils } from './square_utils';

/**
 * Detects if squares are under attack by opponent pieces.
 */
export class AttackDetector {
  /**
   * Check if a square is attacked by any piece of the given color.
   */
  public static isSquareAttacked(
    squares: (Piece | null)[],
    squareIndex: number,
    byColor: Color
  ): boolean {
    const file = squareIndex % 8;
    const rank = Math.floor(squareIndex / 8);

    // Check knight attacks
    if (this.checkKnightAttacks(squares, file, rank, byColor)) return true;

    // Check king attacks
    if (this.checkKingAttacks(squares, file, rank, byColor)) return true;

    // Check pawn attacks
    if (this.checkPawnAttacks(squares, file, rank, byColor)) return true;

    // Check sliding pieces
    const rookDirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const bishopDirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [rankDir, fileDir] of rookDirs) {
      if (this.checkSlidingAttack(squares, file, rank, fileDir, rankDir, byColor,
        [PieceType.Rook, PieceType.Queen])) {
        return true;
      }
    }

    for (const [rankDir, fileDir] of bishopDirs) {
      if (this.checkSlidingAttack(squares, file, rank, fileDir, rankDir, byColor,
        [PieceType.Bishop, PieceType.Queen])) {
        return true;
      }
    }

    return false;
  }

  private static checkKnightAttacks(
    squares: (Piece | null)[],
    file: number,
    rank: number,
    byColor: Color
  ): boolean {
    const knightOffsets: [number, number][] = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [rankOff, fileOff] of knightOffsets) {
      const newFile = file + fileOff;
      const newRank = rank + rankOff;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.Knight && piece.color === byColor) {
          return true;
        }
      }
    }

    return false;
  }

  private static checkKingAttacks(
    squares: (Piece | null)[],
    file: number,
    rank: number,
    byColor: Color
  ): boolean {
    const kingOffsets: [number, number][] = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];

    for (const [rankOff, fileOff] of kingOffsets) {
      const newFile = file + fileOff;
      const newRank = rank + rankOff;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.King && piece.color === byColor) {
          return true;
        }
      }
    }

    return false;
  }

  private static checkPawnAttacks(
    squares: (Piece | null)[],
    file: number,
    rank: number,
    byColor: Color
  ): boolean {
    const pawnRankDir = byColor === Color.White ? -1 : 1;
    
    for (const fileOff of [-1, 1]) {
      const newFile = file + fileOff;
      const newRank = rank + pawnRankDir;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.Pawn && piece.color === byColor) {
          return true;
        }
      }
    }

    return false;
  }

  private static checkSlidingAttack(
    squares: (Piece | null)[],
    startFile: number,
    startRank: number,
    fileDir: number,
    rankDir: number,
    byColor: Color,
    pieceTypes: PieceType[]
  ): boolean {
    let file = startFile + fileDir;
    let rank = startRank + rankDir;

    while (SquareUtils.isValidFileRank(file, rank)) {
      const piece = squares[SquareUtils.fileRankToIndex(file, rank)];
      if (piece) {
        if (piece.color === byColor && pieceTypes.includes(piece.type)) {
          return true;
        }
        break;
      }
      file += fileDir;
      rank += rankDir;
    }

    return false;
  }
}