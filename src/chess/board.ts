import { Color, PieceType, SquareType } from './types';
import type { File, Piece, Move, Square, CastlingRights, GameState} from './types';
import { SquareUtils } from './square_utils';
import { MoveGenerator } from './move_generator';
import { type Command } from './commands/types';
import type { BoardStateReader } from './board_state';
import { CommandValidator } from './commands/command_validator';
import { FENParser } from './fen_parser';
import { CastlingHandler } from './castling_handler';
import { AttackDetector } from './attack_detector';

export class Board implements BoardStateReader {
  private squares: (Piece | null)[];
  private activeColor: Color;
  private castlingRights: CastlingRights;
  private enPassantSquare: Square | null;
  private halfMoveClock: number;
  private fullMoveNumber: number;

  private piecePositions: Map<Color, Map<PieceType, Set<number>>>;
  private kingPositions: Map<Color, number>;
  private validMovesCache: Map<number, Move[]>;
  private isCacheDirty: boolean;

  // Lazy-initialized helpers
  private _commandValidator?: CommandValidator;

  public static fromFEN(fen: string): Board {
    const board = new Board();
    board.clearBoard();

    const parsed = FENParser.parse(fen);

    for (const [square, piece] of parsed.pieces) {
      board.placePiece(square, piece);
    }

    board.activeColor = parsed.activeColor;
    board.castlingRights = parsed.castlingRights;
    board.enPassantSquare = parsed.enPassantSquare;
    board.halfMoveClock = parsed.halfMoveClock;
    board.fullMoveNumber = parsed.fullMoveNumber;

    board.invalidateCache();
    return board;
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

  private get commandValidator(): CommandValidator {
    if (!this._commandValidator) {
      this._commandValidator = new CommandValidator(this);
    }
    return this._commandValidator;
  }

  // ============ BoardStateReader Implementation ============

  public getPieceAt(square: Square): Piece | null {
    return this.squares[SquareUtils.toIndex(square)];
  }

  public getPieceAtIndex(index: number): Piece | null {
    return this.squares[index];
  }

  public getActiveColor(): Color {
    return this.activeColor;
  }

  public getAllSquarePieces(): (Piece | null)[] {
    return this.squares;
  }

  public getEnPassantSquare(): Square | null {
    return this.enPassantSquare;
  }

  public getCastlingRights(): CastlingRights {
    return { ...this.castlingRights };
  }

  public getKingPosition(color: Color): number {
    return this.kingPositions.get(color)!;
  }

  public findPieces(type: PieceType, color: Color): Square[] {
    const positions = this.piecePositions.get(color)!.get(type)!;
    return Array.from(positions).map(index => SquareUtils.fromIndex(index));
  }

  public getAllSquaresForColor(color: Color): Square[] {
    const squares: Square[] = [];
    const colorPieces = this.piecePositions.get(color)!;
    for (const positions of colorPieces.values()) {
      for (const index of positions) {
        squares.push(SquareUtils.fromIndex(index));
      }
    }
    return squares;
  }

  public getSquaresOnFile(file: File, color: Color): Square[] {
    const squares: Square[] = [];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    for (let rank = 0; rank < 8; rank++) {
      const index = SquareUtils.fileRankToIndex(fileIndex, rank);
      const piece = this.squares[index];
      if (piece?.color === color) {
        squares.push(SquareUtils.fromIndex(index));
      }
    }
    return squares;
  }

  // ============ Public API ============

  public getGameState(): GameState {
    return {
      activeColor: this.activeColor,
      castlingRights: { ...this.castlingRights },
      enPassantSquare: this.enPassantSquare,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber
    };
  }

  //TODO: Change API to have a single executeCommand method that internally validates, and executes all corresponding moves if valid. 
  // Update tests to check that executeCommand was successful instead of checking isValidCommand
  public isValidCommand(command: Command): boolean {
    return this.commandValidator.isValidCommand(command);
  }

  public executeMove(move: Move): boolean {
    const validMoves = this.getValidMovesForSquare(move.startSquare);
    const isValid = validMoves.some(
      m => m.startSquare === move.startSquare && m.endSquare === move.endSquare
    );

    if (!isValid) return false;

    const piece = this.getPieceAt(move.startSquare);
    if (!piece || piece.type !== move.piece || piece.color !== move.color) {
      return false;
    }

    this.executeValidatedMove(move, piece);
    return true;
  }

  // TODO: Move this functionality elsewhere
  public getValidMovesForSquare(square: Square): Move[] {
    const index = SquareUtils.toIndex(square);

    if (!this.isCacheDirty && this.validMovesCache.has(index)) {
      return this.validMovesCache.get(index)!;
    }

    const piece = this.squares[index];
    if (!piece) return [];

    const pseudoLegalMoves = MoveGenerator.generateMoves(
      piece, square, this.squares, this.enPassantSquare
    );

    const legalMoves = pseudoLegalMoves.filter(move => this.isMoveLegal(move));

    if (piece.type === PieceType.King) {
      legalMoves.push(...CastlingHandler.getCastlingMoves(this, piece.color));
    }

    this.validMovesCache.set(index, legalMoves);
    return legalMoves;
  }

  public getAllValidMoves(): Move[] {
    const moves: Move[] = [];
    const colorPieces = this.piecePositions.get(this.activeColor)!;

    for (const [, positions] of colorPieces) {
      for (const index of positions) {
        moves.push(...this.getValidMovesForSquare(SquareUtils.fromIndex(index)));
      }
    }
    return moves;
  }

  public isSquareAttacked(squareIndex: number, byColor: Color): boolean {
    return AttackDetector.isSquareAttacked(this.squares, squareIndex, byColor);
  }

  public isInCheck(): boolean {
    return AttackDetector.isSquareAttacked(this.squares, this.kingPositions.get(this.activeColor)!,
      this.activeColor === Color.White ? Color.Black : Color.White);
  }

  public isGameOver(): { isOver: boolean; reason?: 'checkmate' | 'stalemate' | 'draw' } {
    const validMoves = this.getAllValidMoves();
    if (validMoves.length === 0) {
      return this.isInCheck()
        ? { isOver: true, reason: 'checkmate' }
        : { isOver: true, reason: 'stalemate' };
    }

    if (this.halfMoveClock >= 100) {
      return { isOver: true, reason: 'draw' };
    }

    if (this.hasInsufficientMaterial()) {
      return { isOver: true, reason: 'draw'};
    }

    return { isOver: false };
  }

  public clone(): Board {
    const newBoard = new Board();
    newBoard.squares = this.squares.map(p => p ? { ...p } : null);
    newBoard.activeColor = this.activeColor;
    newBoard.castlingRights = { ...this.castlingRights };
    newBoard.enPassantSquare = this.enPassantSquare;
    newBoard.halfMoveClock = this.halfMoveClock;
    newBoard.fullMoveNumber = this.fullMoveNumber;

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

  public getTargetSquares(square: Square): Square[] {
    return this.getValidMovesForSquare(square).map(m => m.endSquare);
  }

  public toFEN(): string {
    return FENParser.generate(
      this.squares,
      this.activeColor,
      this.castlingRights,
      this.enPassantSquare,
      this.halfMoveClock,
      this.fullMoveNumber
    );
  }

  // ============ Private Methods ============

  private executeValidatedMove(move: Move, piece: Piece): void {
    const capturedPiece = this.getPieceAt(move.endSquare);
    const isPawnMove = piece.type === PieceType.Pawn;

    // Handle en passant capture
    if (isPawnMove && move.endSquare === this.enPassantSquare) {
      const capturedRank = piece.color === Color.White ?
        SquareUtils.getRank(move.endSquare) - 1 :
        SquareUtils.getRank(move.endSquare) + 1;
      const capturedIndex = SquareUtils.fileRankToIndex(
        SquareUtils.getFile(move.endSquare), capturedRank
      );
      this.removePiece(SquareUtils.fromIndex(capturedIndex));
    }

    // Handle castling rook movement
    if (piece.type === PieceType.King) {
      const fileDiff = SquareUtils.getFile(move.endSquare) - SquareUtils.getFile(move.startSquare);
      if (Math.abs(fileDiff) === 2) {
        this.moveCastlingRook(piece.color, fileDiff > 0);
      }
    }

    // Execute main move
    this.removePiece(move.startSquare);
    if (capturedPiece) this.removePiece(move.endSquare);
    this.placePiece(move.endSquare, piece);

    // Update game state
    this.updateEnPassantSquare(move, piece, isPawnMove);
    this.updateCastlingRights(move);
    this.updateClocks(isPawnMove, capturedPiece !== null);
    this.activeColor = this.activeColor === Color.White ? Color.Black : Color.White;
    this.invalidateCache();
  }

  private moveCastlingRook(color: Color, kingside: boolean): void {
    const rank = color === Color.White ? '1' : '8';
    if (kingside) {
      this.movePieceInternal(`h${rank}` as Square, `f${rank}` as Square);
    } else {
      this.movePieceInternal(`a${rank}` as Square, `d${rank}` as Square);
    }
  }

  private updateEnPassantSquare(move: Move, piece: Piece, isPawnMove: boolean): void {
    if (isPawnMove) {
      const rankDiff = Math.abs(
        SquareUtils.getRank(move.endSquare) - SquareUtils.getRank(move.startSquare)
      );
      if (rankDiff === 2) {
        const epRank = piece.color === Color.White ?
          SquareUtils.getRank(move.startSquare) + 1 :
          SquareUtils.getRank(move.startSquare) - 1;
        this.enPassantSquare = SquareUtils.fromIndex(
          SquareUtils.fileRankToIndex(SquareUtils.getFile(move.startSquare), epRank)
        );
        return;
      }
    }
    this.enPassantSquare = null;
  }

  private updateCastlingRights(move: Move): void {
    if (move.piece === PieceType.King) {
      if (move.color === Color.White) {
        this.castlingRights.whiteKingside = false;
        this.castlingRights.whiteQueenside = false;
      } else {
        this.castlingRights.blackKingside = false;
        this.castlingRights.blackQueenside = false;
      }
    }

    const affectedSquares: [Square, keyof CastlingRights][] = [
      ['a1', 'whiteQueenside'], ['h1', 'whiteKingside'],
      ['a8', 'blackQueenside'], ['h8', 'blackKingside']
    ];

    for (const [square, right] of affectedSquares) {
      if (move.startSquare === square || move.endSquare === square) {
        this.castlingRights[right] = false;
      }
    }
  }

  private updateClocks(isPawnMove: boolean, isCapture: boolean): void {
    if (isPawnMove || isCapture) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    if (this.activeColor === Color.Black) {
      this.fullMoveNumber++;
    }
  }

  private isMoveLegal(move: Move): boolean {
    const fromIndex = SquareUtils.toIndex(move.startSquare);
    const toIndex = SquareUtils.toIndex(move.endSquare);
    const movingPiece = this.squares[fromIndex];
    const capturedPiece = this.squares[toIndex];

    // Temporarily execute move
    this.squares[fromIndex] = null;
    this.squares[toIndex] = movingPiece;

    let enPassantCaptured: Piece | null = null;
    let enPassantIndex = -1;

    if (movingPiece?.type === PieceType.Pawn && move.endSquare === this.enPassantSquare) {
      const capturedRank = movingPiece.color === Color.White ?
        SquareUtils.getRank(move.endSquare) - 1 :
        SquareUtils.getRank(move.endSquare) + 1;
      enPassantIndex = SquareUtils.fileRankToIndex(
        SquareUtils.getFile(move.endSquare), capturedRank
      );
      enPassantCaptured = this.squares[enPassantIndex];
      this.squares[enPassantIndex] = null;
    }

    const kingPos = movingPiece?.type === PieceType.King ?
      toIndex : this.kingPositions.get(move.color)!;
    const opponentColor = move.color === Color.White ? Color.Black : Color.White;
    const isInCheck = AttackDetector.isSquareAttacked(this.getAllSquarePieces(), kingPos, opponentColor);

    // Restore board
    this.squares[fromIndex] = movingPiece;
    this.squares[toIndex] = capturedPiece;
    if (enPassantIndex >= 0) {
      this.squares[enPassantIndex] = enPassantCaptured;
    }

    return !isInCheck;
  }

  private hasInsufficientMaterial(): boolean {
    const whitePieces = this.piecePositions.get(Color.White)!;
    const blackPieces = this.piecePositions.get(Color.Black)!;

    // If more than two piece types available, king has more than one supporting piece so sufficient material is present
    const supportingWhitePieces = [...whitePieces].filter(([pieceType, indices]) => indices.size > 0 && pieceType != PieceType.King)
    if (supportingWhitePieces.length > 1) {
      return false;
    }

    const supportingBlackPieces = [...blackPieces].filter(([pieceType, indices]) => indices.size > 0 && pieceType != PieceType.King);
    if (supportingBlackPieces.length > 1) {
      return false;
    }

    const onlyWhiteKing = supportingWhitePieces.length == 0;
    const onlyBlackKing = supportingBlackPieces.length == 0;

    // King vs king is an insufficient material scenario
    if (onlyWhiteKing && onlyBlackKing) {
      return true;
    }

    // Only one side has an unsupported king, need to check K+B vs K, K+N vs K, 
    if (onlyWhiteKing || onlyBlackKing) {
        const checkPieces = onlyWhiteKing ? supportingBlackPieces : supportingWhitePieces;
        
        // Only one piece type should be available, check whether it is a bishop or king
        if (checkPieces[0][0] === PieceType.Bishop || PieceType.Knight){
          return true;
        }
    }
    
    // If both sides have one bishop that occupy the same square type, there is insufficient material
    if (supportingWhitePieces[0][0] === PieceType.Bishop && supportingBlackPieces[0][0] === PieceType.Bishop) {
      const whiteBishopSquare = SquareUtils.fromIndex(supportingWhitePieces[0][1].values().next().value!)
      const blackBishopSquare = SquareUtils.fromIndex(supportingBlackPieces[0][1].values().next().value!)

      if (this.getSquareType(whiteBishopSquare) === this.getSquareType(blackBishopSquare)) {
        return true;
      }
    }
    return false;
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
    const backRank: [File, PieceType][] = [
      ['a', PieceType.Rook], ['b', PieceType.Knight], ['c', PieceType.Bishop],
      ['d', PieceType.Queen], ['e', PieceType.King], ['f', PieceType.Bishop],
      ['g', PieceType.Knight], ['h', PieceType.Rook]
    ];

    for (const [file, type] of backRank) {
      this.placePiece(`${file}1` as Square, { type, color: Color.White });
      this.placePiece(`${file}8` as Square, { type, color: Color.Black });
    }

    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      this.placePiece(`${file}2` as Square, { type: PieceType.Pawn, color: Color.White });
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

  private movePieceInternal(from: Square, to: Square): void {
    const piece = this.removePiece(from);
    if (piece) this.placePiece(to, piece);
  }

  private getSquareType(square: Square) : SquareType {
    return (square.charCodeAt(0) + SquareUtils.getRank(square) + 1) % 2 == 0 ? SquareType.Light : SquareType.Dark
  }

  private invalidateCache(): void {
    this.isCacheDirty = true;
    this.validMovesCache.clear();
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