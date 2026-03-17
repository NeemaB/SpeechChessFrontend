import { Chess, type Move } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { CommandParser } from './commands/command_parser';
import { CommandResolver } from './commands/command_resolver';
import { Action } from './commands/types';
import { StockfishService, type StockfishConfig } from './stockfish_service';

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
  private playerColor: 'white' | 'black' = 'white';
  private readonly stockfish: StockfishService;
  private thinking = false;

  constructor(fen?: string, playerColor?: 'white' | 'black', stockfishConfig?: StockfishConfig) {
    this.chess = new Chess(fen);
    this.playerColor = playerColor ?? 'white';
    this.stockfish = new StockfishService(stockfishConfig);
  }

  /**
   * Attach the chessground Api. Wires board-drag events back through
   * chess.js and performs the initial sync.
   */
  public attachBoard(api: Api): void {
    this.boardApi = api;
    api.set({
      orientation: this.playerColor,
      movable: {
        free: false,
        color: this.playerColor,
        events: {
          after: (from, to) => this.handleBoardMove(from, to),
        },
      },
    });
    this.syncBoard();
  }

  /**
   * Change the player's color. Only allowed when the game hasn't started
   * (i.e. still on the initial position). Resets the board and re-syncs.
   */
  public setPlayerColor(color: 'white' | 'black'): void {
    if (this.stockfish.isReady()) return; // game already started
    if (this.chess.history().length > 0) return;

    this.playerColor = color;
    this.resigned = false;
    this.chess.reset();
    this.boardApi?.set({ orientation: this.playerColor });
    this.syncBoard();
  }

  public getPlayerColor(): 'white' | 'black' {
    return this.playerColor;
  }

  /**
   * Initialise Stockfish and begin the game.
   * If the bot moves first (player is black), triggers the bot's opening move.
   */
  public async startGame(): Promise<void> {
    if (this.stockfish.isReady()) return;

    await this.stockfish.init();

    if (this.getTurn() !== this.playerColor && !this.isGameOver()) {
      await this.doBotMove();
    }
  }

  public isGameStarted(): boolean {
    return this.stockfish.isReady();
  }

  public async setDifficulty(level: 'easy' | 'medium' | 'hard'): Promise<void> {
    const presets: Record<string, { skill: number; depth: number }> = {
      easy: { skill: 1, depth: 3 },
      medium: { skill: 10, depth: 10 },
      hard: { skill: 20, depth: 18 },
    };
    const { skill, depth } = presets[level];
    await this.stockfish.setSkillLevel(skill, depth);
  }

  /**
   * Parse a raw voice/text command and execute it on the board.
   * This is the primary entry point for speech-driven play.
   */
  public handleCommand(input: string): CommandResult {
    if (!this.stockfish.isReady()) {
      return { success: false, error: 'Game has not started yet.' };
    }

    // Ignore voice commands when it's the bot's turn
    if (this.getTurn() !== this.playerColor) {
      return { success: false, error: 'It is not your turn.' };
    }

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
      void this.triggerBotMoveIfNeeded();
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
      void this.triggerBotMoveIfNeeded();
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

  public destroy(): void {
    this.stockfish.destroy();
  }

  private async triggerBotMoveIfNeeded(): Promise<void> {
    if (this.isGameOver()) return;
    if (this.getTurn() === this.playerColor) return;
    if (!this.stockfish.isReady()) return;
    await this.doBotMove();
  }

  private async doBotMove(): Promise<void> {
    if (this.thinking) return;
    this.thinking = true;

    try {
      const bestMoveUci = await this.stockfish.getBestMove(this.chess.fen());
      if (!bestMoveUci || bestMoveUci === '(none)') return;

      const from = bestMoveUci.slice(0, 2);
      const to = bestMoveUci.slice(2, 4);
      const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;

      const executed = this.chess.move({ from, to, promotion });
      this.syncBoard(executed);
    } catch (err) {
      console.error('Stockfish move error:', err);
    } finally {
      this.thinking = false;
    }
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
        color: this.playerColor,
        dests: this.getTurn() === this.playerColor ? this.getLegalDests() : new Map(),
      },
    });
  }
}
