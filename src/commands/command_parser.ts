import {
  type Command,
  type CommandInfo,
  Action,
} from './types';

import {
  Color,
  type File,
  type Rank,
  type Square,
  PieceType,
} from '../chess/types';

// ============================================
// Constants
// ============================================

const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];

const PIECE_NAMES: Record<string, PieceType> = {
  king: PieceType.King,
  queen: PieceType.Queen,
  rook: PieceType.Rook,
  bishop: PieceType.Bishop,
  knight: PieceType.Knight,
  night: PieceType.Knight,   // Common voice recognition mishearing
  pawn: PieceType.Pawn,
};

const CAPTURE_KEYWORDS = new Set(['takes', 'captures', 'capture', 'x']);
const MOVE_KEYWORDS = new Set(['to', 'moves', 'move']);

// Handle spoken numbers (e.g., "e four" -> "e4")
const NUMBER_WORDS: Record<string, Rank> = {
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
// Token Types
// ============================================

type Token =
  | { type: 'piece'; value: PieceType }
  | { type: 'square'; value: Square }
  | { type: 'file'; value: File }
  | { type: 'action'; value: Action };

// ============================================
// Type Guards
// ============================================

function isFile(str: string): str is File {
  return (FILES as readonly string[]).includes(str);
}

function isRank(str: string): str is Rank {
  return (RANKS as readonly string[]).includes(str);
}

function isSquare(str: string): str is Square {
  return str.length === 2 && isFile(str[0]) && isRank(str[1]);
}

// ============================================
// Preprocessing
// ============================================

/**
 * Normalize input string for consistent parsing
 */
function preprocess(input: string): string {
  let result = input.toLowerCase().trim();

  // Replace spoken numbers with digits
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }

  return result;
}

// ============================================
// Castle Command Handling
// ============================================

function isCastleCommand(input: string): boolean {
  return /castl(e|es|ing)?/i.test(input);
}

function parseCastleCommand(input: string): Command {
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
// Tokenization
// ============================================

/**
 * Convert input string into recognized chess tokens
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const words = input.split(/\s+/).filter((w) => w.length > 0);

  for (const word of words) {
    const token = parseWord(word);
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

/**
 * Parse a single word into token(s)
 */
function parseWord(word: string): Token | Token[] | null {
  // Piece type (e.g., "knight", "queen")
  if (word in PIECE_NAMES) {
    return { type: 'piece', value: PIECE_NAMES[word] };
  }

  // Capture keywords (e.g., "takes", "captures")
  if (CAPTURE_KEYWORDS.has(word)) {
    return { type: 'action', value: Action.Capture };
  }

  // Move keywords (e.g., "to")
  if (MOVE_KEYWORDS.has(word)) {
    return { type: 'action', value: Action.Move };
  }

  // Complete square (e.g., "e4", "a7")
  if (isSquare(word)) {
    return { type: 'square', value: word as Square };
  }

  // Single file (e.g., "e", "a")
  if (word.length === 1 && isFile(word)) {
    return { type: 'file', value: word as File };
  }

  // File + square combined (e.g., "bd3" -> file 'b' + square 'd3')
  if (word.length === 3 && isFile(word[0]) && isSquare(word.slice(1))) {
    return [
      { type: 'file', value: word[0] as File },
      { type: 'square', value: word.slice(1) as Square },
    ];
  }

  // Unknown token - skip
  return null;
}

// ============================================
// Command Info Extraction
// ============================================

/**
 * Convert tokens to CommandInfo (Piece | Square | File)
 * Priority: piece > square > file
 */
function tokensToCommandInfo(tokens: Token[]): CommandInfo | undefined {
  if (tokens.length === 0) return undefined;

  // Check for piece first
  const pieceToken = tokens.find((t) => t.type === 'piece');
  if (pieceToken) {
    return {
      type: pieceToken.value,
      color: Color.White, // Default; actual color determined during validation
    };
  }

  // Then square
  const squareToken = tokens.find((t) => t.type === 'square');
  if (squareToken) {
    return squareToken.value;
  }

  // Finally file
  const fileToken = tokens.find((t) => t.type === 'file');
  if (fileToken) {
    return fileToken.value;
  }

  return undefined;
}

// ============================================
// Command Parsing
// ============================================

/**
 * Parse tokens when explicit action keyword is present
 * e.g., "knight takes rook" -> [knight] [takes] [rook]
 */
function parseWithAction(tokens: Token[], actionIndex: number): Command {
  const beforeAction = tokens.slice(0, actionIndex);
  const afterAction = tokens.slice(actionIndex + 1);
  const action = (tokens[actionIndex] as { type: 'action'; value: Action }).value;

  return {
    startInfo: tokensToCommandInfo(beforeAction),
    action,
    endInfo: tokensToCommandInfo(afterAction),
  };
}

/**
 * Parse tokens when no explicit action keyword is present
 * Assumes move action
 */
function parseImplicitMove(tokens: Token[]): Command {
  // Single square: destination only (e.g., "e4")
  if (tokens.length === 1 && tokens[0].type === 'square') {
    return {
      action: Action.Move,
      endInfo: tokens[0].value,
    };
  }

  // File + square: piece on file to square (e.g., "bd3")
  if (tokens.length === 2) {
    const [first, second] = tokens;

    if (first.type === 'file' && second.type === 'square') {
      return {
        startInfo: first.value,
        action: Action.Move,
        endInfo: second.value,
      };
    }

    // Piece + square: piece to square (e.g., "bishop f8")
    if (first.type === 'piece' && second.type === 'square') {
      return {
        startInfo: { type: first.value, color: Color.White },
        action: Action.Move,
        endInfo: second.value,
      };
    }

    // Square + square: from-to move (e.g., "e2 e4")
    if (first.type === 'square' && second.type === 'square') {
      return {
        startInfo: first.value,
        action: Action.Move,
        endInfo: second.value,
      };
    }
  }

  // Fallback: extract what we can
  return {
    action: Action.Move,
    startInfo: tokens.length > 1 ? tokensToCommandInfo(tokens.slice(0, -1)) : undefined,
    endInfo: tokensToCommandInfo(tokens.slice(-1)),
  };
}

// ============================================
// Main Parser
// ============================================

/**
 * Parse a voice command string into a Command structure
 * @param input - The voice command string to parse
 * @returns Parsed Command object
 */
export function parseCommand(input: string): Command {
  const normalized = preprocess(input);

  // Handle empty input
  if (!normalized) {
    return { action: Action.Move };
  }

  // Handle castle commands
  if (isCastleCommand(normalized)) {
    return parseCastleCommand(normalized);
  }

  // Handle resign
  if (normalized === 'resign' || normalized === 'i resign') {
    return { action: Action.Resign };
  }

  // Tokenize and parse
  const tokens = tokenize(normalized);

  if (tokens.length === 0) {
    return { action: Action.Move };
  }

  // Check for explicit action keyword
  const actionIndex = tokens.findIndex((t) => t.type === 'action');

  if (actionIndex !== -1) {
    return parseWithAction(tokens, actionIndex);
  }

  return parseImplicitMove(tokens);
}