// SquareUtils.ts

import type { File, Rank, Square } from './types';

export class SquareUtils {
  private static readonly FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  private static readonly RANKS: Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  // Pre-computed lookup tables for O(1) conversion
  private static readonly squareToIndex: Map<Square, number> = SquareUtils.buildSquareToIndex();
  private static readonly indexToSquare: Square[] = SquareUtils.buildIndexToSquare();
  
  private static buildSquareToIndex(): Map<Square, number> {
    const map = new Map<Square, number>();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = `${SquareUtils.FILES[file]}${SquareUtils.RANKS[rank]}` as Square;
        map.set(square, rank * 8 + file);
      }
    }
    return map;
  }
  
  private static buildIndexToSquare(): Square[] {
    const arr: Square[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        arr.push(`${SquareUtils.FILES[file]}${SquareUtils.RANKS[rank]}` as Square);
      }
    }
    return arr;
  }
  
  static toIndex(square: Square): number {
    return this.squareToIndex.get(square)!;
  }
  
  static fromIndex(index: number): Square {
    return this.indexToSquare[index];
  }
  
  static getFile(square: Square): number {
    return this.squareToIndex.get(square)! % 8;
  }
  
  static getRank(square: Square): number {
    return Math.floor(this.squareToIndex.get(square)! / 8);
  }
  
  static isValidIndex(index: number): boolean {
    return index >= 0 && index < 64;
  }
  
  static fileRankToIndex(file: number, rank: number): number {
    return rank * 8 + file;
  }
  
  static isValidFileRank(file: number, rank: number): boolean {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
  }
}