import { Chess, type Move } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { CommandParser } from './commands/command_parser';
import { CommandResolver } from './commands/command_resolver';
import { Action } from './commands/types';

export interface CommandResult {
  success: boolean;
  move?: Move;
  resigned?: boolean;
  error?: string;
  errorStage?: 'parse' | 'resolution';
}

/**
 * Orchestrates voice-command parsing, move resolution via chess.js,
 * move execution, and chessground synchronisation.
 *
 * chess.js is the single source of truth for board state; chessground
 * is treated as a write-only presentation layer driven from here.
 */
export class GameController {
  private readonly chess: Chess;
  private boardApi: Api | null = null;
  private resigned = false;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  /**
   * Attach the chessground Api. Wires board-drag events back through
   * chess.js and performs the initial sync.
   */
  public attachBoard(api: Api): void {
    this.boardApi = api;
    api.set({
      movable: {
        free: false,
        events: {
          after: (from, to) => this.handleBoardMove(from, to),
        },
      },
    });
    this.syncBoard();
  }

  /**
   * Parse a raw voice/text command and execute it on the board.
   * This is the primary entry point for speech-driven play.
   */
  public handleCommand(input: string): CommandResult {
    let command;
    try {
      command = CommandParser.parseCommand(input);
    } catch (err) {
      return {
        success: false,
        error: `Could not parse: ${(err as Error).message}`,
        errorStage: 'parse',
      };
    }

    if (command.action === Action.Resign) {
      this.resigned = true;
      return { success: true, resigned: true };
    }

    if (command.action === Action.Promote) {
      return {
        success: false,
        error: 'Standalone promote is not supported; speak the promoting move instead.',
      };
    }

    try {
      const resolved = CommandResolver.resolve(this.chess, command);
      const executed = this.chess.move({
        from: resolved.from,
        to: resolved.to,
        promotion: resolved.promotion,
      });
      this.syncBoard(executed);
      return { success: true, move: executed };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        errorStage: 'resolution',
      };
    }
  }

  /**
   * Handle a move initiated by dragging on chessground. Runs it through
   * chess.js; on rejection, re-syncs to snap the piece back.
   */
  public handleBoardMove(from: Key, to: Key): boolean {
    try {
      const executed = this.chess.move({ from, to, promotion: 'q' });
      this.syncBoard(executed);
      return true;
    } catch {
      this.syncBoard(); // revert illegal drag
      return false;
    }
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getTurn(): 'white' | 'black' {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  public isGameOver(): boolean {
    return this.resigned || this.chess.isGameOver();
  }

  /** Build chessground's dests map from chess.js legal moves. */
  private getLegalDests(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const m of this.chess.moves({ verbose: true })) {
      const arr = dests.get(m.from as Key) ?? [];
      arr.push(m.to as Key);
      dests.set(m.from as Key, arr);
    }
    return dests;
  }

  /** Push authoritative chess.js state into chessground. */
  private syncBoard(lastMove?: Move): void {
    if (!this.boardApi) return;

    this.boardApi.set({
      fen: this.chess.fen(),
      turnColor: this.getTurn(),
      check: this.chess.inCheck(),
      lastMove: lastMove ? [lastMove.from as Key, lastMove.to as Key] : undefined,
      movable: {
        color: this.getTurn(),
        dests: this.getLegalDests(),
      },
    });
  }
}
