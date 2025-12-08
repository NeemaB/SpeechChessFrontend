import type { Square, Piece, CastlingRights } from './types';
import { Color, PieceType } from './types';
import { SquareUtils } from './square_utils';

export interface ParsedFEN {
  pieces: Map<Square, Piece>;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantSquare: Square | null;
  halfMoveClock: number;
  fullMoveNumber: number;
}

/**
 * Handles FEN string parsing and generation.
 */
export class FENParser {
  private static readonly PIECE_CHAR_MAP: Record<string, PieceType> = {
    'k': PieceType.King,
    'q': PieceType.Queen,
    'r': PieceType.Rook,
    'b': PieceType.Bishop,
    'n': PieceType.Knight,
    'p': PieceType.Pawn
  };

  private static readonly PIECE_TYPE_MAP: Record<PieceType, string> = {
    [PieceType.King]: 'k',
    [PieceType.Queen]: 'q',
    [PieceType.Rook]: 'r',
    [PieceType.Bishop]: 'b',
    [PieceType.Knight]: 'n',
    [PieceType.Pawn]: 'p'
  };

  static parse(fen: string): ParsedFEN {
    const parts = fen.split(' ');
    const [position, activeColor, castling, enPassant, halfMove, fullMove] = parts;

    const pieces = new Map<Square, Piece>();
    const ranks = position.split('/');

    for (let rankIdx = 7; rankIdx >= 0; rankIdx--) {
      let fileIdx = 0;
      for (const char of ranks[7 - rankIdx]) {
        if (/\d/.test(char)) {
          fileIdx += parseInt(char);
        } else {
          const color = char === char.toUpperCase() ? Color.White : Color.Black;
          const pieceType = this.PIECE_CHAR_MAP[char.toLowerCase()];
          const square = SquareUtils.fromIndex(
            SquareUtils.fileRankToIndex(fileIdx, rankIdx)
          );
          pieces.set(square, { type: pieceType, color });
          fileIdx++;
        }
      }
    }

    return {
      pieces,
      activeColor: activeColor === 'w' ? Color.White : Color.Black,
      castlingRights: {
        whiteKingside: castling.includes('K'),
        whiteQueenside: castling.includes('Q'),
        blackKingside: castling.includes('k'),
        blackQueenside: castling.includes('q')
      },
      enPassantSquare: enPassant === '-' ? null : enPassant as Square,
      halfMoveClock: parseInt(halfMove) || 0,
      fullMoveNumber: parseInt(fullMove) || 1
    };
  }

  static generate(
    squares: (Piece | null)[],
    activeColor: Color,
    castlingRights: CastlingRights,
    enPassantSquare: Square | null,
    halfMoveClock: number,
    fullMoveNumber: number
  ): string {
    let fen = '';

    // Piece positions
    for (let rank = 7; rank >= 0; rank--) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = squares[SquareUtils.fileRankToIndex(file, rank)];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          let char = this.PIECE_TYPE_MAP[piece.type];
          fen += piece.color === Color.White ? char.toUpperCase() : char;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (rank > 0) fen += '/';
    }

    // Active color
    fen += ` ${activeColor === Color.White ? 'w' : 'b'}`;

    // Castling rights
    let castling = '';
    if (castlingRights.whiteKingside) castling += 'K';
    if (castlingRights.whiteQueenside) castling += 'Q';
    if (castlingRights.blackKingside) castling += 'k';
    if (castlingRights.blackQueenside) castling += 'q';
    fen += ` ${castling || '-'}`;

    // En passant, clocks
    fen += ` ${enPassantSquare || '-'}`;
    fen += ` ${halfMoveClock}`;
    fen += ` ${fullMoveNumber}`;

    return fen;
  }
}