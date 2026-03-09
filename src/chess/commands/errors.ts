/**
 * Base class for command validation errors.
 */
export class CommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

/**
 * Thrown when a command has no action specified.
 */
export class MissingActionError extends CommandValidationError {
  constructor() {
    super('Command must have an action specified');
    this.name = 'MissingActionError';
  }
}

/**
 * Thrown when an action is not supported for conversion to moves.
 * Used for actions like Resign and Promote that are handled specially.
 */
export class UnsupportedActionError extends CommandValidationError {
  constructor(action: string) {
    super(`Action '${action}' is not supported for move conversion and must be handled separately`);
    this.name = 'UnsupportedActionError';
  }
}

/**
 * Thrown when no valid moves can be found for a command.
 */
export class NoValidMoveError extends CommandValidationError {
  constructor(message: string = 'No valid move found for the given command') {
    super(message);
    this.name = 'NoValidMoveError';
  }
}

/**
 * Thrown when a command is ambiguous (multiple valid moves possible).
 */
export class AmbiguousMoveError extends CommandValidationError {
  constructor(moveCount: number) {
    super(`Ambiguous command: ${moveCount} valid moves found. Please be more specific.`);
    this.name = 'AmbiguousMoveError';
  }
}

/**
 * Thrown when castling is not allowed in the current position.
 */
export class IllegalCastlingError extends CommandValidationError {
  constructor(side: 'kingside' | 'queenside') {
    super(`Cannot castle ${side} in the current position`);
    this.name = 'IllegalCastlingError';
  }
}

/**
 * Thrown when trying to move from an empty square.
 */
export class EmptySquareError extends CommandValidationError {
  constructor(square: string) {
    super(`No piece found on square ${square}`);
    this.name = 'EmptySquareError';
  }
}

/**
 * Thrown when trying to move an opponent's piece.
 */
export class WrongColorError extends CommandValidationError {
  constructor() {
    super('Cannot move opponent\'s piece');
    this.name = 'WrongColorError';
  }
}

/**
 * Thrown when a move would leave the king in check.
 */
export class MoveLeavesKingInCheckError extends CommandValidationError {
  constructor() {
    super('This move would leave your king in check');
    this.name = 'MoveLeavesKingInCheckError';
  }
}

/**
 * Thrown when an invalid piece movement pattern is attempted.
 */
export class InvalidPieceMovementError extends CommandValidationError {
  constructor(pieceType: string) {
    super(`Invalid movement pattern for ${pieceType}`);
    this.name = 'InvalidPieceMovementError';
  }
}

/**
 * Thrown when a capture command targets an empty square (except en passant).
 */
export class NoCaptureTargetError extends CommandValidationError {
  constructor() {
    super('Capture command requires an enemy piece on the target square');
    this.name = 'NoCaptureTargetError';
  }
}