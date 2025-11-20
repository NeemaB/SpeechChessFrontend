// MoveGenerator.ts

import { Color, PieceType, } from './types';
import type { Piece, Move, Square } from './types';
import { SquareUtils } from './square_utils';

export class MoveGenerator {
  // Pre-computed attack patterns for speed
  private static readonly KNIGHT_OFFSETS: [number, number][] = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  private static readonly KING_OFFSETS: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  private static readonly ROOK_DIRECTIONS: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];
  
  private static readonly BISHOP_DIRECTIONS: [number, number][] = [
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  
  static generateMoves(
    piece: Piece,
    fromSquare: Square,
    boardState: (Piece | null)[],
    enPassantSquare: Square | null
  ): Move[] {
    switch (piece.type) {
      case PieceType.Pawn:
        return this.generatePawnMoves(piece, fromSquare, boardState, enPassantSquare);
      case PieceType.Knight:
        return this.generateKnightMoves(piece, fromSquare, boardState);
      case PieceType.Bishop:
        return this.generateSlidingMoves(piece, fromSquare, boardState, this.BISHOP_DIRECTIONS);
      case PieceType.Rook:
        return this.generateSlidingMoves(piece, fromSquare, boardState, this.ROOK_DIRECTIONS);
      case PieceType.Queen:
        return this.generateSlidingMoves(
          piece, fromSquare, boardState,
          [...this.ROOK_DIRECTIONS, ...this.BISHOP_DIRECTIONS]
        );
      case PieceType.King:
        return this.generateKingMoves(piece, fromSquare, boardState);
      default:
        return [];
    }
  }
  
  private static generatePawnMoves(
    piece: Piece,
    fromSquare: Square,
    boardState: (Piece | null)[],
    enPassantSquare: Square | null
  ): Move[] {
    const moves: Move[] = [];
    const fromIndex = SquareUtils.toIndex(fromSquare);
    const file = fromIndex % 8;
    const rank = Math.floor(fromIndex / 8);
    const direction = piece.color === Color.White ? 1 : -1;
    const startRank = piece.color === Color.White ? 1 : 6;
    
    // Forward move
    const forwardRank = rank + direction;
    if (SquareUtils.isValidFileRank(file, forwardRank)) {
      const forwardIndex = SquareUtils.fileRankToIndex(file, forwardRank);
      if (!boardState[forwardIndex]) {
        moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(forwardIndex)));
        
        // Double forward from starting position
        if (rank === startRank) {
          const doubleForwardRank = rank + 2 * direction;
          const doubleForwardIndex = SquareUtils.fileRankToIndex(file, doubleForwardRank);
          if (!boardState[doubleForwardIndex]) {
            moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(doubleForwardIndex)));
          }
        }
      }
    }
    
    // Captures (diagonal)
    for (const fileOffset of [-1, 1]) {
      const captureFile = file + fileOffset;
      const captureRank = rank + direction;
      
      if (SquareUtils.isValidFileRank(captureFile, captureRank)) {
        const captureIndex = SquareUtils.fileRankToIndex(captureFile, captureRank);
        const targetSquare = SquareUtils.fromIndex(captureIndex);
        const targetPiece = boardState[captureIndex];
        
        // Normal capture
        if (targetPiece && targetPiece.color !== piece.color) {
          moves.push(this.createMove(piece, fromSquare, targetSquare));
        }
        
        // En passant capture
        if (targetSquare === enPassantSquare) {
          moves.push(this.createMove(piece, fromSquare, targetSquare));
        }
      }
    }
    
    return moves;
  }
  
  private static generateKnightMoves(
    piece: Piece,
    fromSquare: Square,
    boardState: (Piece | null)[]
  ): Move[] {
    const moves: Move[] = [];
    const fromIndex = SquareUtils.toIndex(fromSquare);
    const file = fromIndex % 8;
    const rank = Math.floor(fromIndex / 8);
    
    for (const [rankOffset, fileOffset] of this.KNIGHT_OFFSETS) {
      const newFile = file + fileOffset;
      const newRank = rank + rankOffset;
      
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const toIndex = SquareUtils.fileRankToIndex(newFile, newRank);
        const targetPiece = boardState[toIndex];
        
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(toIndex)));
        }
      }
    }
    
    return moves;
  }
  
  private static generateKingMoves(
    piece: Piece,
    fromSquare: Square,
    boardState: (Piece | null)[]
  ): Move[] {
    const moves: Move[] = [];
    const fromIndex = SquareUtils.toIndex(fromSquare);
    const file = fromIndex % 8;
    const rank = Math.floor(fromIndex / 8);
    
    for (const [rankOffset, fileOffset] of this.KING_OFFSETS) {
      const newFile = file + fileOffset;
      const newRank = rank + rankOffset;
      
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const toIndex = SquareUtils.fileRankToIndex(newFile, newRank);
        const targetPiece = boardState[toIndex];
        
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(toIndex)));
        }
      }
    }
    
    // Castling moves are added separately by the Board class
    return moves;
  }
  
  private static generateSlidingMoves(
    piece: Piece,
    fromSquare: Square,
    boardState: (Piece | null)[],
    directions: [number, number][]
  ): Move[] {
    const moves: Move[] = [];
    const fromIndex = SquareUtils.toIndex(fromSquare);
    const file = fromIndex % 8;
    const rank = Math.floor(fromIndex / 8);
    
    for (const [rankDir, fileDir] of directions) {
      let newFile = file + fileDir;
      let newRank = rank + rankDir;
      
      while (SquareUtils.isValidFileRank(newFile, newRank)) {
        const toIndex = SquareUtils.fileRankToIndex(newFile, newRank);
        const targetPiece = boardState[toIndex];
        
        if (!targetPiece) {
          moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(toIndex)));
        } else {
          if (targetPiece.color !== piece.color) {
            moves.push(this.createMove(piece, fromSquare, SquareUtils.fromIndex(toIndex)));
          }
          break; // Blocked by a piece
        }
        
        newFile += fileDir;
        newRank += rankDir;
      }
    }
    
    return moves;
  }
  
  private static createMove(piece: Piece, from: Square, to: Square): Move {
    return {
      piece: piece.type,
      color: piece.color,
      startSquare: from,
      endSquare: to
    };
  }
}