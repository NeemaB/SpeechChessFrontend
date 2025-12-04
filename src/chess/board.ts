// Board.ts

import { 
  Color, 
  PieceType, 
} from './types';
import type { Piece, Move, Square, CastlingRights, GameState } from './types';
import { SquareUtils } from './square_utils';
import { MoveGenerator } from './move_generator';

export class Board {
  // Core board state - flat array for O(1) access
  private squares: (Piece | null)[];
  
  // Game state
  private activeColor: Color;
  private castlingRights: CastlingRights;
  private enPassantSquare: Square | null;
  private halfMoveClock: number;
  private fullMoveNumber: number;
  
  // Quick lookup caches for speed
  private piecePositions: Map<Color, Map<PieceType, Set<number>>>;
  private kingPositions: Map<Color, number>;
  
  // Move cache for frequently accessed positions
  private validMovesCache: Map<number, Move[]>;
  private isCacheDirty: boolean;

  public static fromFEN(fen: string): Board {
    const board = new Board();
    board.clearBoard();
    
    const parts = fen.split(' ');
    const [position, activeColor, castling, enPassant, halfMove, fullMove] = parts;
    
    // Parse piece positions
    const ranks = position.split('/');
    for (let rankIdx = 7; rankIdx >= 0; rankIdx--) {
      let fileIdx = 0;
      for (const char of ranks[7 - rankIdx]) {
        if (/\d/.test(char)) {
          fileIdx += parseInt(char);
        } else {
          const color = char === char.toUpperCase() ? Color.White : Color.Black;
          const pieceType = Board.charToPieceType(char.toLowerCase());
          const square = SquareUtils.fromIndex(SquareUtils.fileRankToIndex(fileIdx, rankIdx));
          board.placePiece(square, { type: pieceType, color });
          fileIdx++;
        }
      }
    }
    
    // Parse active color
    board.activeColor = activeColor === 'w' ? Color.White : Color.Black;
    
    // Parse castling rights
    board.castlingRights = {
      whiteKingside: castling.includes('K'),
      whiteQueenside: castling.includes('Q'),
      blackKingside: castling.includes('k'),
      blackQueenside: castling.includes('q')
    };
    
    // Parse en passant square
    board.enPassantSquare = enPassant === '-' ? null : enPassant as Square;
    
    // Parse move clocks
    board.halfMoveClock = parseInt(halfMove) || 0;
    board.fullMoveNumber = parseInt(fullMove) || 1;
    
    board.invalidateCache();
    return board;
  }
  
  private static pieceTypeToChar(type: PieceType): string {
    const map: Record<PieceType, string> = {
      [PieceType.King]: 'k',
      [PieceType.Queen]: 'q',
      [PieceType.Rook]: 'r',
      [PieceType.Bishop]: 'b',
      [PieceType.Knight]: 'n',
      [PieceType.Pawn]: 'p'
    };
    return map[type];
  }

  private static charToPieceType(char: string): PieceType {
    const map: Record<string, PieceType> = {
      'k': PieceType.King,
      'q': PieceType.Queen,
      'r': PieceType.Rook,
      'b': PieceType.Bishop,
      'n': PieceType.Knight,
      'p': PieceType.Pawn
    };
    return map[char];
  }
  
  constructor() {
    this.squares = new Array(64).fill(null);
    this.activeColor = Color.White;
    this.castlingRights = {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true
    };
    this.enPassantSquare = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    
    this.piecePositions = new Map([
      [Color.White, this.createPieceTypeMap()],
      [Color.Black, this.createPieceTypeMap()]
    ]);
    this.kingPositions = new Map();
    
    this.validMovesCache = new Map();
    this.isCacheDirty = true;
    
    this.setupInitialPosition();
  }

  /**
   * Execute a move on the board
   */
  public executeMove(move: Move): boolean {
    // Validate the move
    const validMoves = this.getValidMovesForSquare(move.startSquare);
    const isValid = validMoves.some(
      m => m.startSquare === move.startSquare && m.endSquare === move.endSquare
    );
    
    if (!isValid) {
      return false;
    }
    
    const piece = this.getPieceAt(move.startSquare);
    if (!piece || piece.type !== move.piece || piece.color !== move.color) {
      return false;
    }
    
    // Handle special moves
    const fromIndex = SquareUtils.toIndex(move.startSquare);
    const toIndex = SquareUtils.toIndex(move.endSquare);
    
    // Check for capture (for half move clock)
    const capturedPiece = this.squares[toIndex];
    const isPawnMove = piece.type === PieceType.Pawn;
    
    // Handle en passant capture
    if (isPawnMove && move.endSquare === this.enPassantSquare) {
      const capturedPawnRank = piece.color === Color.White ? 
        SquareUtils.getRank(move.endSquare) - 1 : 
        SquareUtils.getRank(move.endSquare) + 1;
      const capturedPawnFile = SquareUtils.getFile(move.endSquare);
      const capturedPawnIndex = SquareUtils.fileRankToIndex(capturedPawnFile, capturedPawnRank);
      this.removePiece(SquareUtils.fromIndex(capturedPawnIndex));
    }
    
    // Handle castling
    if (piece.type === PieceType.King) {
      const fileDiff = SquareUtils.getFile(move.endSquare) - SquareUtils.getFile(move.startSquare);
      if (Math.abs(fileDiff) === 2) {
        // Castling - move the rook
        if (fileDiff > 0) {
          // Kingside
          const rookFrom = piece.color === Color.White ? 'h1' : 'h8';
          const rookTo = piece.color === Color.White ? 'f1' : 'f8';
          this.movePieceInternal(rookFrom as Square, rookTo as Square);
        } else {
          // Queenside
          const rookFrom = piece.color === Color.White ? 'a1' : 'a8';
          const rookTo = piece.color === Color.White ? 'd1' : 'd8';
          this.movePieceInternal(rookFrom as Square, rookTo as Square);
        }
      }
    }
    
    // Execute the main move
    this.removePiece(move.startSquare);
    if (capturedPiece) {
      this.removePiece(move.endSquare);
    }
    this.placePiece(move.endSquare, piece);
    
    // Update en passant square
    if (isPawnMove) {
      const rankDiff = Math.abs(
        SquareUtils.getRank(move.endSquare) - SquareUtils.getRank(move.startSquare)
      );
      if (rankDiff === 2) {
        const epRank = piece.color === Color.White ? 
          SquareUtils.getRank(move.startSquare) + 1 : 
          SquareUtils.getRank(move.startSquare) - 1;
        const epFile = SquareUtils.getFile(move.startSquare);
        this.enPassantSquare = SquareUtils.fromIndex(
          SquareUtils.fileRankToIndex(epFile, epRank)
        );
      } else {
        this.enPassantSquare = null;
      }
    } else {
      this.enPassantSquare = null;
    }
    
    // Update castling rights
    this.updateCastlingRights(move);
    
    // Update clocks
    if (isPawnMove || capturedPiece) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }
    
    if (this.activeColor === Color.Black) {
      this.fullMoveNumber++;
    }
    
    // Switch active color
    this.activeColor = this.activeColor === Color.White ? Color.Black : Color.White;
    
    this.invalidateCache();
    return true;
  }

  // Public API
  
  public getPieceAt(square: Square): Piece | null {
    return this.squares[SquareUtils.toIndex(square)];
  }
  
  public getActiveColor(): Color {
    return this.activeColor;
  }
  
  public getGameState(): GameState {
    return {
      activeColor: this.activeColor,
      castlingRights: { ...this.castlingRights },
      enPassantSquare: this.enPassantSquare,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber
    };
  }

  /**
   * Get all valid moves for a piece at a given square
   * Uses caching for speed
   */
  public getValidMovesForSquare(square: Square): Move[] {
    const index = SquareUtils.toIndex(square);
    
    if (!this.isCacheDirty && this.validMovesCache.has(index)) {
      return this.validMovesCache.get(index)!;
    }
    
    const piece = this.squares[index];
    if (!piece) {
      return [];
    }
    
    const pseudoLegalMoves = MoveGenerator.generateMoves(
      piece,
      square,
      this.squares,
      this.enPassantSquare
    );
    
    // Filter out moves that would leave king in check
    const legalMoves = pseudoLegalMoves.filter(move => 
      this.isMoveLegal(move)
    );
    
    // Add castling moves if applicable
    if (piece.type === PieceType.King) {
      legalMoves.push(...this.getCastlingMoves(piece.color));
    }
    
    this.validMovesCache.set(index, legalMoves);
    return legalMoves;
  }
  
  /**
   * Get all valid moves for the active player
   */
  public getAllValidMoves(): Move[] {
    const moves: Move[] = [];
    const colorPieces = this.piecePositions.get(this.activeColor)!;
    
    for (const [, positions] of colorPieces) {
      for (const index of positions) {
        const square = SquareUtils.fromIndex(index);
        moves.push(...this.getValidMovesForSquare(square));
      }
    }
    
    return moves;
  }
  
  /**
   * Find all pieces of a given type and color
   */
  public findPieces(type: PieceType, color: Color): Square[] {
    const positions = this.piecePositions.get(color)!.get(type)!;
    return Array.from(positions).map(index => SquareUtils.fromIndex(index));
  }

  /**
   * Check if a square is attacked by any piece of the given color
   */
  public isSquareAttacked(squareIndex: number, byColor: Color): boolean {
    const file = squareIndex % 8;
    const rank = Math.floor(squareIndex / 8);
    
    // Check knight attacks
    const knightOffsets: [number, number][] = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [rankOff, fileOff] of knightOffsets) {
      const newFile = file + fileOff;
      const newRank = rank + rankOff;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = this.squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.Knight && piece.color === byColor) {
          return true;
        }
      }
    }
    
    // Check king attacks
    const kingOffsets: [number, number][] = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];
    
    for (const [rankOff, fileOff] of kingOffsets) {
      const newFile = file + fileOff;
      const newRank = rank + rankOff;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = this.squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.King && piece.color === byColor) {
          return true;
        }
      }
    }
    
    // Check pawn attacks
    const pawnRankDir = byColor === Color.White ? -1 : 1;
    for (const fileOff of [-1, 1]) {
      const newFile = file + fileOff;
      const newRank = rank + pawnRankDir;
      if (SquareUtils.isValidFileRank(newFile, newRank)) {
        const piece = this.squares[SquareUtils.fileRankToIndex(newFile, newRank)];
        if (piece?.type === PieceType.Pawn && piece.color === byColor) {
          return true;
        }
      }
    }
    
    // Check sliding pieces (rook, bishop, queen)
    const rookDirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const bishopDirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [rankDir, fileDir] of rookDirs) {
      if (this.checkSlidingAttack(file, rank, fileDir, rankDir, byColor, 
          [PieceType.Rook, PieceType.Queen])) {
        return true;
      }
    }
    
    for (const [rankDir, fileDir] of bishopDirs) {
      if (this.checkSlidingAttack(file, rank, fileDir, rankDir, byColor, 
          [PieceType.Bishop, PieceType.Queen])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if the current player is in check
   */
  public isInCheck(): boolean {
    const kingIndex = this.kingPositions.get(this.activeColor)!;
    const opponentColor = this.activeColor === Color.White ? Color.Black : Color.White;
    return this.isSquareAttacked(kingIndex, opponentColor);
  }
  
  /**
   * Check for checkmate or stalemate
   */
  public isGameOver(): { isOver: boolean; reason?: 'checkmate' | 'stalemate' | 'draw' } {
    const validMoves = this.getAllValidMoves();
    
    if (validMoves.length === 0) {
      if (this.isInCheck()) {
        return { isOver: true, reason: 'checkmate' };
      }
      return { isOver: true, reason: 'stalemate' };
    }
    
    // 50-move rule
    if (this.halfMoveClock >= 100) {
      return { isOver: true, reason: 'draw' };
    }
    
    return { isOver: false };
  }
  
  /**
   * Create a deep copy of the board
   */
  public clone(): Board {
    const newBoard = new Board();
    newBoard.squares = [...this.squares.map(p => p ? { ...p } : null)];
    newBoard.activeColor = this.activeColor;
    newBoard.castlingRights = { ...this.castlingRights };
    newBoard.enPassantSquare = this.enPassantSquare;
    newBoard.halfMoveClock = this.halfMoveClock;
    newBoard.fullMoveNumber = this.fullMoveNumber;
    
    // Rebuild piece position caches
    newBoard.piecePositions = new Map([
      [Color.White, newBoard.createPieceTypeMap()],
      [Color.Black, newBoard.createPieceTypeMap()]
    ]);
    
    for (let i = 0; i < 64; i++) {
      const piece = newBoard.squares[i];
      if (piece) {
        newBoard.piecePositions.get(piece.color)!.get(piece.type)!.add(i);
        if (piece.type === PieceType.King) {
          newBoard.kingPositions.set(piece.color, i);
        }
      }
    }
    
    return newBoard;
  }

  /**
   * Get all squares a piece can move to (for testing)
   */
  public getTargetSquares(square: Square): Square[] {
    return this.getValidMovesForSquare(square).map(m => m.endSquare);
  }
  
  /**
   * Convert board to FEN string (for debugging/testing)
   */
  public toFEN(): string {
    let fen = '';
    
    for (let rank = 7; rank >= 0; rank--) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.squares[SquareUtils.fileRankToIndex(file, rank)];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          let char = Board.pieceTypeToChar(piece.type);
          fen += piece.color === Color.White ? char.toUpperCase() : char;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (rank > 0) fen += '/';
    }
    
    fen += ` ${this.activeColor === Color.White ? 'w' : 'b'}`;
    
    let castling = '';
    if (this.castlingRights.whiteKingside) castling += 'K';
    if (this.castlingRights.whiteQueenside) castling += 'Q';
    if (this.castlingRights.blackKingside) castling += 'k';
    if (this.castlingRights.blackQueenside) castling += 'q';
    fen += ` ${castling || '-'}`;
    
    fen += ` ${this.enPassantSquare || '-'}`;
    fen += ` ${this.halfMoveClock}`;
    fen += ` ${this.fullMoveNumber}`;
    
    return fen;
  }
  
  private createPieceTypeMap(): Map<PieceType, Set<number>> {
    return new Map([
      [PieceType.King, new Set()],
      [PieceType.Queen, new Set()],
      [PieceType.Rook, new Set()],
      [PieceType.Bishop, new Set()],
      [PieceType.Knight, new Set()],
      [PieceType.Pawn, new Set()]
    ]);
  }
  
  private setupInitialPosition(): void {
    // White pieces
    this.placePiece('a1', { type: PieceType.Rook, color: Color.White });
    this.placePiece('b1', { type: PieceType.Knight, color: Color.White });
    this.placePiece('c1', { type: PieceType.Bishop, color: Color.White });
    this.placePiece('d1', { type: PieceType.Queen, color: Color.White });
    this.placePiece('e1', { type: PieceType.King, color: Color.White });
    this.placePiece('f1', { type: PieceType.Bishop, color: Color.White });
    this.placePiece('g1', { type: PieceType.Knight, color: Color.White });
    this.placePiece('h1', { type: PieceType.Rook, color: Color.White });
    
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      this.placePiece(`${file}2` as Square, { type: PieceType.Pawn, color: Color.White });
    }
    
    // Black pieces
    this.placePiece('a8', { type: PieceType.Rook, color: Color.Black });
    this.placePiece('b8', { type: PieceType.Knight, color: Color.Black });
    this.placePiece('c8', { type: PieceType.Bishop, color: Color.Black });
    this.placePiece('d8', { type: PieceType.Queen, color: Color.Black });
    this.placePiece('e8', { type: PieceType.King, color: Color.Black });
    this.placePiece('f8', { type: PieceType.Bishop, color: Color.Black });
    this.placePiece('g8', { type: PieceType.Knight, color: Color.Black });
    this.placePiece('h8', { type: PieceType.Rook, color: Color.Black });
    
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      this.placePiece(`${file}7` as Square, { type: PieceType.Pawn, color: Color.Black });
    }
  }
  
  private placePiece(square: Square, piece: Piece): void {
    const index = SquareUtils.toIndex(square);
    this.squares[index] = piece;
    this.piecePositions.get(piece.color)!.get(piece.type)!.add(index);
    
    if (piece.type === PieceType.King) {
      this.kingPositions.set(piece.color, index);
    }
    
    this.invalidateCache();
  }
  
  private removePiece(square: Square): Piece | null {
    const index = SquareUtils.toIndex(square);
    const piece = this.squares[index];
    
    if (piece) {
      this.squares[index] = null;
      this.piecePositions.get(piece.color)!.get(piece.type)!.delete(index);
      this.invalidateCache();
    }
    
    return piece;
  }
  
  private invalidateCache(): void {
    this.isCacheDirty = true;
    this.validMovesCache.clear();
  }
  
  private movePieceInternal(from: Square, to: Square): void {
    const piece = this.removePiece(from);
    if (piece) {
      this.placePiece(to, piece);
    }
  }
  
  private updateCastlingRights(move: Move): void {
    // King moves remove both castling rights
    if (move.piece === PieceType.King) {
      if (move.color === Color.White) {
        this.castlingRights.whiteKingside = false;
        this.castlingRights.whiteQueenside = false;
      } else {
        this.castlingRights.blackKingside = false;
        this.castlingRights.blackQueenside = false;
      }
    }
    
    // Rook moves or captures affect castling rights
    if (move.startSquare === 'a1' || move.endSquare === 'a1') {
      this.castlingRights.whiteQueenside = false;
    }
    if (move.startSquare === 'h1' || move.endSquare === 'h1') {
      this.castlingRights.whiteKingside = false;
    }
    if (move.startSquare === 'a8' || move.endSquare === 'a8') {
      this.castlingRights.blackQueenside = false;
    }
    if (move.startSquare === 'h8' || move.endSquare === 'h8') {
      this.castlingRights.blackKingside = false;
    }
  }
  
  /**
   * Check if a move is legal (doesn't leave own king in check)
   */
  private isMoveLegal(move: Move): boolean {
    // Make the move temporarily
    const fromIndex = SquareUtils.toIndex(move.startSquare);
    const toIndex = SquareUtils.toIndex(move.endSquare);
    
    const movingPiece = this.squares[fromIndex];
    const capturedPiece = this.squares[toIndex];
    
    // Temporarily execute move
    this.squares[fromIndex] = null;
    this.squares[toIndex] = movingPiece;
    
    // Handle en passant capture for check detection
    let enPassantCaptured: Piece | null = null;
    let enPassantIndex = -1;
    if (movingPiece?.type === PieceType.Pawn && 
        move.endSquare === this.enPassantSquare) {
      const capturedPawnRank = movingPiece.color === Color.White ? 
        SquareUtils.getRank(move.endSquare) - 1 : 
        SquareUtils.getRank(move.endSquare) + 1;
      enPassantIndex = SquareUtils.fileRankToIndex(
        SquareUtils.getFile(move.endSquare), 
        capturedPawnRank
      );
      enPassantCaptured = this.squares[enPassantIndex];
      this.squares[enPassantIndex] = null;
    }
    
    // Update king position if king moved
    const kingPos = movingPiece?.type === PieceType.King ? 
      toIndex : 
      this.kingPositions.get(move.color)!;
    
    // Check if king is in check
    const isInCheck = this.isSquareAttacked(kingPos, 
      move.color === Color.White ? Color.Black : Color.White
    );
    
    // Restore the board
    this.squares[fromIndex] = movingPiece;
    this.squares[toIndex] = capturedPiece;
    if (enPassantIndex >= 0) {
      this.squares[enPassantIndex] = enPassantCaptured;
    }
    
    return !isInCheck;
  }
  
  private checkSlidingAttack(
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
      const piece = this.squares[SquareUtils.fileRankToIndex(file, rank)];
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
  
  /**
   * Get available castling moves for a color
   */
  private getCastlingMoves(color: Color): Move[] {
    const moves: Move[] = [];
    const rank = color === Color.White ? 0 : 7;
    const kingIndex = SquareUtils.fileRankToIndex(4, rank);
    
    // King must not be in check
    if (this.isSquareAttacked(kingIndex, color === Color.White ? Color.Black : Color.White)) {
      return moves;
    }
    
    // Kingside castling
    const canKingside = color === Color.White ? 
      this.castlingRights.whiteKingside : 
      this.castlingRights.blackKingside;
    
    if (canKingside) {
      const f = SquareUtils.fileRankToIndex(5, rank);
      const g = SquareUtils.fileRankToIndex(6, rank);
      const opponentColor = color === Color.White ? Color.Black : Color.White;
      
      if (!this.squares[f] && !this.squares[g] &&
          !this.isSquareAttacked(f, opponentColor) &&
          !this.isSquareAttacked(g, opponentColor)) {
        moves.push({
          piece: PieceType.King,
          color,
          startSquare: SquareUtils.fromIndex(kingIndex),
          endSquare: SquareUtils.fromIndex(g)
        });
      }
    }
    
    // Queenside castling
    const canQueenside = color === Color.White ? 
      this.castlingRights.whiteQueenside : 
      this.castlingRights.blackQueenside;
    
    if (canQueenside) {
      const b = SquareUtils.fileRankToIndex(1, rank);
      const c = SquareUtils.fileRankToIndex(2, rank);
      const d = SquareUtils.fileRankToIndex(3, rank);
      const opponentColor = color === Color.White ? Color.Black : Color.White;
      
      if (!this.squares[b] && !this.squares[c] && !this.squares[d] &&
          !this.isSquareAttacked(c, opponentColor) &&
          !this.isSquareAttacked(d, opponentColor)) {
        moves.push({
          piece: PieceType.King,
          color,
          startSquare: SquareUtils.fromIndex(kingIndex),
          endSquare: SquareUtils.fromIndex(c)
        });
      }
    }
    
    return moves;
  }
  
  private clearBoard(): void {
    this.squares = new Array(64).fill(null);
    this.piecePositions = new Map([
      [Color.White, this.createPieceTypeMap()],
      [Color.Black, this.createPieceTypeMap()]
    ]);
    this.kingPositions = new Map();
    this.validMovesCache.clear();
    this.isCacheDirty = true;
  }
}