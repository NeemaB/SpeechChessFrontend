import {
  type Command,
  type CommandInfo,
  type Token,
  Action,
} from './types';

import {
  Color,
  type File,
  type Rank,
  type Square,
  PieceType
} from '../chess/types';

export class CommandParser {
  // ============================================
  // Private Constants
  // ============================================

  private static readonly FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  private static readonly RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];

  private static readonly PIECE_NAMES: Record<string, PieceType> = {
    king: PieceType.King,
    queen: PieceType.Queen,
    rook: PieceType.Rook,
    bishop: PieceType.Bishop,
    knight: PieceType.Knight,
    night: PieceType.Knight,
    pawn: PieceType.Pawn,
  };

  private static readonly CAPTURE_KEYWORDS = new Set(['takes', 'captures', 'capture', 'x']);
  private static readonly MOVE_KEYWORDS = new Set(['to', 'moves', 'move']);

  private static readonly NUMBER_WORDS: Record<string, Rank> = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
  };

  // ============================================
  // Public API
  // ============================================

  /**
   * Parse a voice command string into a Command structure
   * @param input - The voice command string to parse
   * @returns Parsed Command object
   */
  public static parseCommand(input: string): Command {
    const normalized = this.preprocess(input);

    if (!normalized) {
      //TODO: Define custom error type
      throw new Error('Input command is empty or invalid.');
    }

    if (this.isCastleCommand(normalized)) {
      return this.parseCastleCommand(normalized);
    }

    if (normalized === 'resign' || normalized === 'i resign') {
      return { action: Action.Resign };
    }

    //TODO: Support custom promotion types, for now resorts to queen promotion only
    if (normalized === 'promote' || normalized === 'pawn promote' || normalized === 'promote pawn') {
      return { action: Action.Promote };
    }

    const tokens = this.tokenize(normalized);

    if (tokens.length === 0) {
      //TODO: Define custom error type
      throw new Error('No valid tokens found in input command.');
    }

    const actionIndex = tokens.findIndex((t) => t.type === 'action');

    if (actionIndex !== -1) {
      return this.parseWithAction(tokens, actionIndex);
    }

    return this.parseImplicitMove(tokens);
  }

  // ============================================
  // Private Type Guards
  // ============================================

  private static isFile(str: string): str is File {
    return (this.FILES as readonly string[]).includes(str);
  }

  private static isRank(str: string): str is Rank {
    return (this.RANKS as readonly string[]).includes(str);
  }

  private static isSquare(str: string): str is Square {
    return str.length === 2 && this.isFile(str[0]) && this.isRank(str[1]);
  }

  // ============================================
  // Private Preprocessing
  // ============================================

  /**
   * Normalize input string for consistent parsing
   * 
   * Performs two key transformations:
   * 1. Converts spoken number words to digits (e.g., "three" → "3")
   * 2. Combines separated file-rank patterns into squares (e.g., "f 3" → "f3")
   * 
   * The second step is crucial for handling voice input where the file letter
   * and rank number are recognized as separate words.
   */
  private static preprocess(input: string): string {
    let result = input.toLowerCase().trim();

    // Step 1: Replace spoken numbers with digits
    // "knight f three" → "knight f 3"
    for (const [word, digit] of Object.entries(this.NUMBER_WORDS)) {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
    }

    // Step 2: Combine separated file-rank patterns into squares
    // This regex matches:
    //   - ([a-h]?[a-h]) : one or two file letters (handles both "f" and "ad")
    //   - \s+          : one or more whitespace characters
    //   - ([1-8])      : a single rank digit
    // 
    // Examples:
    //   "f 3"      → "f3"       (simple file + rank)
    //   "ad 5"     → "ad5"      (file 'a' + square 'd5', parsed later)
    //   "g 2 to b 6" → "g2 to b6" (multiple squares in one command)
    result = result.replace(/\b([a-h]?[a-h])\s+([1-8])\b/g, '$1$2');

    return result;
  }

  // ============================================
  // Private Castle Command Handling
  // ============================================

  private static isCastleCommand(input: string): boolean {
    return /castl(e|es|ing)?/i.test(input);
  }

  private static parseCastleCommand(input: string): Command {
    const normalized = input.toLowerCase();

    const isLongCastle =
      normalized.includes('long') ||
      normalized.includes('queenside') ||
      normalized.includes('queen side') ||
      normalized.includes('queen-side');

    return {
      action: isLongCastle ? Action.LongCastle : Action.ShortCastle,
    };
  }

  // ============================================
  // Private Tokenization
  // ============================================

  private static tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    const words = input.split(/\s+/).filter((w) => w.length > 0);

    for (const word of words) {
      const token = this.parseWord(word);
      if (token) {
        if (Array.isArray(token)) {
          tokens.push(...token);
        } else {
          tokens.push(token);
        }
      }
    }

    return tokens;
  }

  private static parseWord(word: string): Token | Token[] | null {
    if (word in this.PIECE_NAMES) {
      return { type: 'piece', value: this.PIECE_NAMES[word] };
    }

    if (this.CAPTURE_KEYWORDS.has(word)) {
      return { type: 'action', value: Action.Capture };
    }

    if (this.MOVE_KEYWORDS.has(word)) {
      return { type: 'action', value: Action.Move };
    }

    if (this.isSquare(word)) {
      return { type: 'square', value: word as Square };
    }

    if (word.length === 1 && this.isFile(word)) {
      return { type: 'file', value: word as File };
    }

    // File + square combined (e.g., "bd3" → file 'b' + square 'd3')
    // Also handles preprocessed "ad5" → file 'a' + square 'd5'
    if (word.length === 3 && this.isFile(word[0]) && this.isSquare(word.slice(1))) {
      return [
        { type: 'file', value: word[0] as File },
        { type: 'square', value: word.slice(1) as Square },
      ];
    }

    return null;
  }

  // ============================================
  // Private Command Info Extraction
  // ============================================

  private static tokensToCommandInfo(tokens: Token[]): CommandInfo | undefined {
    if (tokens.length === 0) return undefined;

    const pieceToken = tokens.find((t) => t.type === 'piece');
    if (pieceToken) {
      return pieceToken.value;
    }

    const squareToken = tokens.find((t) => t.type === 'square');
    if (squareToken) {
      return squareToken.value;
    }

    const fileToken = tokens.find((t) => t.type === 'file');
    if (fileToken) {
      return fileToken.value;
    }

    return undefined;
  }

  // ============================================
  // Private Command Parsing
  // ============================================

  private static parseWithAction(tokens: Token[], actionIndex: number): Command {
    const beforeAction = tokens.slice(0, actionIndex);
    const afterAction = tokens.slice(actionIndex + 1);
    const action = (tokens[actionIndex] as { type: 'action'; value: Action }).value;

    return {
      startInfo: this.tokensToCommandInfo(beforeAction),
      action,
      endInfo: this.tokensToCommandInfo(afterAction),
    };
  }

  private static parseImplicitMove(tokens: Token[]): Command {
    if (tokens.length === 1 && tokens[0].type === 'square') {
      return {
        action: Action.Move,
        endInfo: tokens[0].value,
      };
    }

    if (tokens.length === 2) {
      const [first, second] = tokens;

      if (first.type === 'file' && second.type === 'square') {
        return {
          startInfo: first.value,
          action: Action.Move,
          endInfo: second.value,
        };
      }

      if (first.type === 'piece' && second.type === 'square') {
        return {
          startInfo: first.value,
          action: Action.Move,
          endInfo: second.value,
        };
      }

      if (first.type === 'square' && second.type === 'square') {
        return {
          startInfo: first.value,
          action: Action.Move,
          endInfo: second.value,
        };
      }
    }

    return {
      action: Action.Move,
      startInfo: tokens.length > 1 ? this.tokensToCommandInfo(tokens.slice(0, -1)) : undefined,
      endInfo: this.tokensToCommandInfo(tokens.slice(-1)),
    };
  }
}