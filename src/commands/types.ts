import type { Piece, Square, File } from "../chess/types";

export type CommandInfo = Piece | Square | File;

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