import type { Square, File, PieceType, Rank } from "../chess/types";

export type CommandInfo = PieceType | Square | File;

export type Token =
  | { type: 'piece'; value: PieceType }
  | { type: 'square'; value: Square }
  | { type: 'file'; value: File }
  | { type: 'action'; value: Action }
  | { type: 'rank'; value: Rank };


export enum Action {
  Move = 'move',
  Capture = 'capture',
  Resign = 'resign',
  Promote = 'promote',
  ShortCastle = 'short_castle',
  LongCastle = 'long_castle'
}

export interface Command {
  startInfo? : CommandInfo,
  action? : Action,
  endInfo? : CommandInfo
}