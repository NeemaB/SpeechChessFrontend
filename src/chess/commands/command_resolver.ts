import { Chess, type Move, type PieceSymbol, type Square as ChessJsSquare } from 'chess.js';
import { type Command, type CommandInfo, Action } from './types';
import { PieceType, type Square, type File } from '../types';
import {
  MissingActionError,
  UnsupportedActionError,
  NoValidMoveError,
  AmbiguousMoveError,
  IllegalCastlingError,
  EmptySquareError,
  NoCaptureTargetError,
} from './errors';

const PIECE_TYPE_TO_SYMBOL: Record<PieceType, PieceSymbol> = {
  [PieceType.King]: 'k',
  [PieceType.Queen]: 'q',
  [PieceType.Rook]: 'r',
  [PieceType.Bishop]: 'b',
  [PieceType.Knight]: 'n',
  [PieceType.Pawn]: 'p',
};

/**
 * Resolves a parsed voice Command to a single legal chess.js Move by
 * filtering the engine's legal-move list. No custom rule logic lives here.
 */
export class CommandResolver {
  public static resolve(chess: Chess, command: Command): Move {
    if (!command.action) {
      throw new MissingActionError();
    }

    if (command.action === Action.Resign || command.action === Action.Promote) {
      throw new UnsupportedActionError(command.action);
    }

    if (command.action === Action.ShortCastle) {
      return this.resolveCastling(chess, true);
    }
    if (command.action === Action.LongCastle) {
      return this.resolveCastling(chess, false);
    }

    return this.resolveMoveOrCapture(chess, command);
  }

  private static resolveCastling(chess: Chess, kingside: boolean): Move {
    // Only the king can castle — ask chess.js for king moves exclusively
    // rather than scanning the full legal-move list.
    const flag = kingside ? 'k' : 'q';
    const move = chess
      .moves({ verbose: true, piece: 'k' })
      .find((m) => m.flags.includes(flag));
    if (!move) {
      throw new IllegalCastlingError(kingside ? 'kingside' : 'queenside');
    }
    return move;
  }

  private static resolveMoveOrCapture(chess: Chess, command: Command): Move {
    const legal = this.queryLegalMoves(chess, command.startInfo);
    const requireCapture = command.action === Action.Capture;

    const candidates = legal.filter((m) => {
      if (requireCapture && !this.isCapture(m)) return false;
      if (!this.matchesStart(m, command.startInfo)) return false;
      if (!this.matchesEnd(m, command.endInfo)) return false;
      return true;
    });

    if (candidates.length === 0) {
      this.throwDiagnosticError(chess, command, requireCapture);
    }

    if (candidates.length > 1) {
      // Collapse promotion fan-out: if every candidate is the same from→to
      // differing only by promotion piece, default to queen.
      const uniqueFromTo = new Set(candidates.map((m) => `${m.from}${m.to}`));
      if (uniqueFromTo.size === 1 && candidates.every((m) => m.promotion)) {
        const queen = candidates.find((m) => m.promotion === 'q');
        if (queen) return queen;
      }
      throw new AmbiguousMoveError(candidates.length);
    }

    return candidates[0];
  }

  /**
   * When no legal-move candidates survive filtering, inspect the board
   * via chess.js to produce the most actionable error rather than a
   * generic "no valid move". Falls back to NoValidMoveError when no
   * more specific diagnosis applies.
   */
  private static throwDiagnosticError(
    chess: Chess,
    command: Command,
    requireCapture: boolean,
  ): never {
    if (command.startInfo !== undefined && this.isSquare(command.startInfo)) {
      if (!chess.get(command.startInfo as ChessJsSquare)) {
        throw new EmptySquareError(command.startInfo);
      }
    }

    if (requireCapture && command.endInfo !== undefined && this.isSquare(command.endInfo)) {
      const target = chess.get(command.endInfo as ChessJsSquare);
      if (!target || target.color === chess.turn()) {
        throw new NoCaptureTargetError();
      }
    }

    throw new NoValidMoveError();
  }

  /**
   * Ask chess.js for legal moves, narrowing the result set via the engine's
   * own `square` / `piece` filter options whenever the command's start info
   * makes that possible. The downstream filter pass still runs for
   * correctness, but over a much smaller array.
   */
  private static queryLegalMoves(chess: Chess, startInfo?: CommandInfo): Move[] {
    if (startInfo !== undefined) {
      if (this.isSquare(startInfo)) {
        return chess.moves({ verbose: true, square: startInfo as ChessJsSquare });
      }
      if (this.isPieceType(startInfo)) {
        return chess.moves({ verbose: true, piece: PIECE_TYPE_TO_SYMBOL[startInfo] });
      }
      // File disambiguators have no equivalent chess.js filter — fall through.
    }
    return chess.moves({ verbose: true });
  }

  private static matchesStart(move: Move, info?: CommandInfo): boolean {
    if (info === undefined) return true;
    if (this.isSquare(info)) return move.from === info;
    if (this.isFile(info)) return move.from[0] === info;
    if (this.isPieceType(info)) return move.piece === PIECE_TYPE_TO_SYMBOL[info];
    return false;
  }

  private static matchesEnd(move: Move, info?: CommandInfo): boolean {
    if (info === undefined) return true;
    if (this.isSquare(info)) return move.to === info;
    if (this.isFile(info)) return move.to[0] === info;
    if (this.isPieceType(info)) {
      // "takes rook" → destination must contain that piece type
      return move.captured === PIECE_TYPE_TO_SYMBOL[info];
    }
    return false;
  }

  private static isCapture(move: Move): boolean {
    // 'c' = standard capture, 'e' = en passant
    return move.flags.includes('c') || move.flags.includes('e');
  }

  private static isSquare(info: CommandInfo): info is Square {
    return typeof info === 'string' && /^[a-h][1-8]$/.test(info);
  }

  private static isFile(info: CommandInfo): info is File {
    return typeof info === 'string' && /^[a-h]$/.test(info);
  }

  private static isPieceType(info: CommandInfo): info is PieceType {
    return Object.values(PieceType).includes(info as PieceType);
  }
}
