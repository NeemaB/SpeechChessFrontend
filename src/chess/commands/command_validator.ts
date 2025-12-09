import type { Square, Piece, Move, File } from '../types';
import { Color, PieceType } from '../types';
import { SquareUtils } from '../square_utils';
import type { BoardStateReader } from '../board_state';
import { PieceMoveValidator } from '../piece_move_validator';
import { AttackDetector } from '../attack_detector';
import { CastlingHandler } from '../castling_handler';
import { type Command, type CommandInfo, Action } from './types';
import type { CastlingRights } from '../types';

/**
 * Validates voice commands against current board state.
 * A command is valid only if exactly one legal move can be constructed.
 */
export class CommandValidator {
  private boardState: BoardStateReader;

  constructor(
    boardState: BoardStateReader,
  ) {
    this.boardState = boardState;
  }

  /**
   * Validates whether a voice command can be legally executed.
   * A command is valid only if exactly one legal move can be constructed.
   */
  public isValidCommand(command: Command): boolean {
    if (!command.action) return false;
    if (command.action === Action.Resign) return true;
    if (command.action === Action.ShortCastle) return CastlingHandler.canCastleKingside(this.boardState);
    if (command.action === Action.LongCastle) return CastlingHandler.canCastleQueenside(this.boardState);

    if (command.action === Action.Move || command.action === Action.Capture) {
      const validMoves = this.findValidMovesForCommand(command);
      return validMoves.length === 1;
    }

    return false;
  }

  /**
   * Find all valid moves that match the command's criteria.
   */
  private findValidMovesForCommand(command: Command): Move[] {
    const candidateStarts = this.getCandidateStartSquares(command.startInfo);
    if (candidateStarts.length === 0) return [];

    const candidateEnds = this.getCandidateEndSquares(command.endInfo);
    if (candidateEnds.length === 0) return [];

    const validMoves: Move[] = [];
    const isCapture = command.action === Action.Capture;
    const activeColor = this.boardState.getActiveColor();

    for (const startSquare of candidateStarts) {
      const piece = this.boardState.getPieceAt(startSquare);
      if (!piece || piece.color !== activeColor) continue;
      if (!PieceMoveValidator.isSupportedPieceType(piece.type)) continue;

      for (const endSquare of candidateEnds) {
        if (startSquare === endSquare) continue;
        if (!this.matchesActionType(startSquare, endSquare, isCapture)) continue;
        if (!PieceMoveValidator.canPieceMoveTo(piece, startSquare, endSquare, this.boardState)) {
          continue;
        }

        const move: Move = {
          piece: piece.type,
          color: piece.color,
          startSquare,
          endSquare
        };

        if (this.isMoveLegal(move)) {
          validMoves.push(move);
        }
      }
    }

    return validMoves;
  }

  private getCandidateStartSquares(startInfo?: CommandInfo): Square[] {
    const activeColor = this.boardState.getActiveColor();

    if (!startInfo) {
      return this.boardState.getAllSquaresForColor(activeColor);
    }

    if (this.isSquare(startInfo)) {
      const piece = this.boardState.getPieceAt(startInfo);
      return piece?.color === activeColor ? [startInfo] : [];
    }

    if (this.isFile(startInfo)) {
      return this.boardState.getSquaresOnFile(startInfo, activeColor);
    }

    if (this.isPieceType(startInfo)) {
      return this.boardState.findPieces(startInfo, activeColor);
    }

    return [];
  }

  private getCandidateEndSquares(endInfo?: CommandInfo): Square[] {
    if (!endInfo) {
      return this.getAllSquares();
    }

    if (this.isSquare(endInfo)) {
      return [endInfo];
    }

    if (this.isFile(endInfo)) {
      return this.getAllSquaresOnFile(endInfo);
    }

    if (this.isPieceType(endInfo)) {
      const opponentColor = this.boardState.getActiveColor() === Color.White ?
        Color.Black : Color.White;
      return this.boardState.findPieces(endInfo, opponentColor);
    }

    return [];
  }

  private matchesActionType(
    startSquare: Square,
    endSquare: Square,
    isCapture: boolean
  ): boolean {
    const movingPiece = this.boardState.getPieceAt(startSquare);
    const targetPiece = this.boardState.getPieceAt(endSquare);

    if (!movingPiece) return false;

    const hasOpponentPiece = targetPiece !== null &&
      targetPiece.color !== movingPiece.color;

    if (isCapture) {
      if (hasOpponentPiece) return true;
      if (movingPiece.type === PieceType.Pawn &&
        endSquare === this.boardState.getEnPassantSquare()) {
        return true;
      }
      return false;
    }

    return targetPiece === null || hasOpponentPiece;
  }

  private isMoveLegal(move: Move): boolean {
    const fromIndex = SquareUtils.toIndex(move.startSquare);
    const toIndex = SquareUtils.toIndex(move.endSquare);
    const movingPiece = this.boardState.getPieceAtIndex(fromIndex);

    // Create a temporary board state for legality check
    const tempState = new TemporaryBoardState(this.boardState, move);

    const kingPos = movingPiece?.type === PieceType.King ?
      toIndex : this.boardState.getKingPosition(move.color);

    const opponentColor = move.color === Color.White ? Color.Black : Color.White;
    // Return true if NOT attacked (move is legal)
    return !AttackDetector.isSquareAttacked(tempState.getAllSquarePieces(), kingPos, opponentColor);
  }

  private getAllSquares(): Square[] {
    const squares: Square[] = [];
    for (let i = 0; i < 64; i++) {
      squares.push(SquareUtils.fromIndex(i));
    }
    return squares;
  }

  private getAllSquaresOnFile(file: File): Square[] {
    const squares: Square[] = [];
    const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    for (let rank = 0; rank < 8; rank++) {
      squares.push(SquareUtils.fromIndex(SquareUtils.fileRankToIndex(fileIndex, rank)));
    }
    return squares;
  }

  private isSquare(info: CommandInfo): info is Square {
    return typeof info === 'string' && info.length === 2;
  }

  private isFile(info: CommandInfo): info is File {
    return typeof info === 'string' && info.length === 1;
  }

  private isPieceType(info: CommandInfo): info is PieceType {
    return Object.values(PieceType).includes(info as PieceType);
  }
}

/**
 * Temporary board state for move legality checking.
 * Simulates a move without modifying the actual board.
 */
class TemporaryBoardState implements BoardStateReader {
  private baseState: BoardStateReader;
  private move: Move;
  private fromIndex: number;
  private toIndex: number;
  private enPassantCaptureIndex: number | null = null;

  constructor(baseState: BoardStateReader, move: Move) {
    this.baseState = baseState;
    this.move = move;
    this.fromIndex = SquareUtils.toIndex(move.startSquare);
    this.toIndex = SquareUtils.toIndex(move.endSquare);

    // Check for en passant capture
    const movingPiece = baseState.getPieceAtIndex(this.fromIndex);
    if (movingPiece?.type === PieceType.Pawn &&
      move.endSquare === baseState.getEnPassantSquare()) {
      const capturedPawnRank = movingPiece.color === Color.White ?
        SquareUtils.getRank(move.endSquare) - 1 :
        SquareUtils.getRank(move.endSquare) + 1;
      this.enPassantCaptureIndex = SquareUtils.fileRankToIndex(
        SquareUtils.getFile(move.endSquare),
        capturedPawnRank
      );
    }
  }

  getPieceAt(square: Square): Piece | null {
    return this.getPieceAtIndex(SquareUtils.toIndex(square));
  }

  getPieceAtIndex(index: number): Piece | null {
    if (index === this.fromIndex) return null;
    if (index === this.enPassantCaptureIndex) return null;
    if (index === this.toIndex) return this.baseState.getPieceAtIndex(this.fromIndex);
    return this.baseState.getPieceAtIndex(index);
  }

  getActiveColor(): Color {
    return this.baseState.getActiveColor();
  }

  getAllSquarePieces(): (Piece | null)[] {
    const squares = this.baseState.getAllSquarePieces().slice(); // Create a copy
    squares[this.fromIndex] = null;
    squares[this.toIndex] = this.baseState.getPieceAtIndex(this.fromIndex);
    if (this.enPassantCaptureIndex !== null) {
      squares[this.enPassantCaptureIndex] = null;
    }
    return squares;
  }

  getEnPassantSquare(): Square | null {
    return this.baseState.getEnPassantSquare();
  }

  getCastlingRights(): CastlingRights {
    return this.baseState.getCastlingRights();
  }

  getKingPosition(color: Color): number {
    if (color === this.move.color && this.move.piece === PieceType.King) {
      return this.toIndex;
    }
    return this.baseState.getKingPosition(color);
  }

  findPieces(type: PieceType, color: Color): Square[] {
    return this.baseState.findPieces(type, color);
  }

  getAllSquaresForColor(color: Color): Square[] {
    return this.baseState.getAllSquaresForColor(color);
  }

  getSquaresOnFile(file: File, color: Color): Square[] {
    return this.baseState.getSquaresOnFile(file, color);
  }
}