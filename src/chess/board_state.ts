import type { Square, Piece, CastlingRights, File } from './types';
import { Color, PieceType } from './types';

/**
 * Read-only interface for accessing board state.
 * Allows helper classes to query board without modifying it.
 */
export interface BoardStateReader {
  getPieceAt(square: Square): Piece | null;
  getPieceAtIndex(index: number): Piece | null;
  getActiveColor(): Color;
  getAllSquarePieces(): (Piece | null)[];
  getEnPassantSquare(): Square | null;
  getCastlingRights(): CastlingRights;
  getKingPosition(color: Color): number;
  findPieces(type: PieceType, color: Color): Square[];
  getAllSquaresForColor(color: Color): Square[];
  getSquaresOnFile(file: File, color: Color): Square[];
}