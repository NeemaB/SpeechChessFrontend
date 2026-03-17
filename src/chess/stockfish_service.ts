export interface StockfishConfig {
  /** Stockfish skill level 0-20. Default 3 (beginner-friendly). */
  skillLevel?: number;
  /** Search depth. Lower = weaker/faster. Default 5. */
  depth?: number;
  /** Path to the stockfish WASM JS file served from public/. */
  wasmPath?: string;
}

export class StockfishService {
  private worker: Worker | null = null;
  private readonly skillLevel: number;
  private readonly depth: number;
  private readonly wasmPath: string;
  private resolveMove: ((move: string) => void) | null = null;

  constructor(config: StockfishConfig = {}) {
    this.skillLevel = config.skillLevel ?? 3;
    this.depth = config.depth ?? 5;
    this.wasmPath = config.wasmPath ?? '/stockfish/stockfish-nnue-16-single.js';
  }

  public async init(): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker(this.wasmPath);

    await this.waitForReady();

    this.sendCommand('uci');
    await this.waitForMessage('uciok');

    this.sendCommand(`setoption name Skill Level value ${this.skillLevel}`);
    this.sendCommand('isready');
    await this.waitForMessage('readyok');
  }

  public async getBestMove(fen: string): Promise<string> {
    if (!this.worker) {
      await this.init();
    }

    return new Promise<string>((resolve) => {
      this.resolveMove = resolve;

      const handler = (e: MessageEvent) => {
        const line: string = typeof e.data === 'string' ? e.data : e.data?.toString?.() ?? '';
        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1];
          this.worker?.removeEventListener('message', handler);
          this.resolveMove?.(move);
          this.resolveMove = null;
        }
      };

      this.worker!.addEventListener('message', handler);
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${this.depth}`);
    });
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  public isReady(): boolean {
    return this.worker !== null;
  }

  public async setSkillLevel(level: number, depth?: number): Promise<void> {
    (this as any).skillLevel = level;
    if (depth !== undefined) {
      (this as any).depth = depth;
    }
    if (this.worker) {
      this.sendCommand(`setoption name Skill Level value ${level}`);
      this.sendCommand('isready');
      await this.waitForMessage('readyok');
    }
  }

  private sendCommand(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        const msg = typeof e.data === 'string' ? e.data : '';
        // Stockfish.js WASM worker prints various init lines; we wait for any message
        if (msg) {
          this.worker?.removeEventListener('message', handler);
          resolve();
        }
      };
      this.worker!.addEventListener('message', handler);
    });
  }

  private waitForMessage(target: string): Promise<void> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        const msg = typeof e.data === 'string' ? e.data : '';
        if (msg.includes(target)) {
          this.worker?.removeEventListener('message', handler);
          resolve();
        }
      };
      this.worker!.addEventListener('message', handler);
    });
  }
}
