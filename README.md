# Speech Chess

This repo is the frontend package for the speech chess application. This simple web app allows users to play a game of chess using their voice to issue commands rather than having to move pieces manually.

The app supports a variety of different command templates to allow for maximum flexibility.

Example commands:

- "bd3" -> move piece from b file to d3
- "a6" -> move a piece to a6
- "pawn takes pawn" -> move pawn to square containing enemy pawn
- "pawn takes" -> move pawn to square containing enemy piece
- "knight takes rook" -> move knight to square containing enemy rook
- "bishop f8" -> move bishop to f8 square
- "g takes h5" -> move piece from g file to h5 containing enemy piece 
- "c4 to d4" -> move piece from c4 to d4 square
- "castles" -> move king to valid castle position and rook to valid castle position
- "queen takes a7" -> move queen to a7 
- "short castle" -> move king and rook to kingside castle positions
- "long castle" -> move king and rook to queenside castle positions
- "e2 e4" -> move piece from e2 to e4 square
- "knight f three" -> move knight to f3 square
- "g two to b six" -> move piece from g2 to b6 square
- "bishop to c five" -> move bishop to c5 square
- "ad five" -> move piece from a-file to d5 square
- "g takes b five" -> move piece from g-file to b5 containing enemy piece
- "b e 2" -> move piece from b-file to e2 square
- "c four d6" -> move piece from c4 to d6 square
- "b3 a five" -> move piece from b3 to a5 square
- "g to h seven" -> move piece from g-file to h7 square
- "a c four" -> move piece from a-file to c4 square
- "a 6 takes d three" -> move piece from a6 to d3 containing enemy piece
- "resign" -> resign game
- "i resign" -> resign game

## Setup


## Technical Info

The application uses AssemblyAI on the backend to translate voice commands to text

## Translation Process

After AssemblyAI transcribes the voice data to text, we convert the text to a valid board move
with the following tokenization/parsing process. After tokenization, the text data is stored as a command:

```
interface Command: {
  startInfo? : Piece | Square | File,
  action? : Action,
  endInfo? : Piece | Square | File 
}
```

1. Break up string into individual words
2. Check each word for piece or action using fuzzy search
3. If neither check for 1 letter words, combine with subsequent word to make a square otherwise keep as file
4. If two letter word like "bd, cf" etc, attempt to combine with subsequent word if exists, otherwise keep as file
5. If only action, must be a castles action
6. If no end info not a valid move
7. Use start info (square, piece, file) if available to filter through available pieces on board
8. Use end info (square, piece, file) to construct list of moves, use actions as filter (takes/take)
9. Determine all valid moves from list of moves, if more than one valid move, or no valid moves, Produce error.




