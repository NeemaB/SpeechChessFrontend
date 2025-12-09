// types.ts

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export enum PieceType {
  King = 'king',
  Queen = 'queen',
  Rook = 'rook',
  Bishop = 'bishop',
  Knight = 'knight',
  Pawn = 'pawn'
}

export enum Color {
  White = 'white',
  Black = 'black'
}

export enum SquareType {
  Light = 'light',
  Dark = 'dark'
}

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Move {
  piece: PieceType;
  color: Color;
  startSquare: Square;
  endSquare: Square;
}

export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

export interface GameState {
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantSquare: Square | null;
  halfMoveClock: number;
  fullMoveNumber: number;
}