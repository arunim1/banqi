/**
 * Banqi (Half Chess) game logic
 * Implements the core game mechanics for the Chinese board game Banqi
 */
class Banqi {
  constructor() {
    // Board dimensions (4x8 grid)
    this.rows = 4;
    this.cols = 8;
    this.totalPieces = 32;
    
    // Piece types and their ranks
    this.pieceTypes = {
      GENERAL: { name: 'General', rank: 7, count: 1 },
      ADVISOR: { name: 'Advisor', rank: 6, count: 2 },
      ELEPHANT: { name: 'Elephant', rank: 5, count: 2 },
      CHARIOT: { name: 'Chariot', rank: 4, count: 2 },
      HORSE: { name: 'Horse', rank: 3, count: 2 },
      CANNON: { name: 'Cannon', rank: 2, count: 2 },
      SOLDIER: { name: 'Soldier', rank: 1, count: 5 }
    };
    
    // Initialize game
    this.reset();
  }
  
  /**
   * Reset the game to initial state
   */
  reset() {
    // Create empty board
    this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(null));
    
    // Game state
    this.currentPlayer = 'red'; // 'red' or 'black'
    this.gameActive = true;
    this.winner = null;
    this.selectedPiece = null;
    this.validMoves = [];
    this.turnCount = 0;
    this.lastMove = null;
    
    // Create and shuffle all pieces
    this.initializePieces();
  }
  
  /**
   * Initialize and randomly place all pieces face down
   */
  initializePieces() {
    const pieces = [];
    
    // Create red pieces
    for (const type in this.pieceTypes) {
      for (let i = 0; i < this.pieceTypes[type].count; i++) {
        pieces.push({
          type: type,
          color: 'red',
          rank: this.pieceTypes[type].rank,
          faceUp: false
        });
      }
    }
    
    // Create black pieces
    for (const type in this.pieceTypes) {
      for (let i = 0; i < this.pieceTypes[type].count; i++) {
        pieces.push({
          type: type,
          color: 'black',
          rank: this.pieceTypes[type].rank,
          faceUp: false
        });
      }
    }
    
    // Shuffle pieces
    this.shuffleArray(pieces);
    
    // Place pieces on board
    let pieceIndex = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.board[r][c] = pieces[pieceIndex++];
      }
    }
  }
  
  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Make a move on the board
   * @param {number} fromRow - Starting row (if moving a piece)
   * @param {number} fromCol - Starting column (if moving a piece)
   * @param {number} toRow - Target row
   * @param {number} toCol - Target column
   * @returns {boolean} - Whether the move was valid
   */
  makeMove(fromRow, fromCol, toRow, toCol) {
    // If game is not active, no moves allowed
    if (!this.gameActive) return false;
    
    // Case 1: Revealing a face-down piece
    if (fromRow === toRow && fromCol === toCol) {
      return this.revealPiece(toRow, toCol);
    }
    
    // Case 2: Moving or capturing with a face-up piece
    return this.movePiece(fromRow, fromCol, toRow, toCol);
  }
  
  /**
   * Reveal a face-down piece
   * @param {number} row - Row of the piece
   * @param {number} col - Column of the piece
   * @returns {boolean} - Whether the reveal was valid
   */
  revealPiece(row, col) {
    // Check if coordinates are valid
    if (!this.isValidPosition(row, col)) return false;
    
    const piece = this.board[row][col];
    
    // Check if there's a piece and it's face down
    if (!piece || piece.faceUp) return false;
    
    // Reveal the piece
    piece.faceUp = true;
    
    // If this is the first piece revealed, set the current player's color
    if (this.turnCount === 0) {
      this.currentPlayer = piece.color;
    } else {
      // Switch player turn
      this.switchPlayer();
    }
    
    this.turnCount++;
    this.lastMove = { type: 'reveal', row, col };
    
    return true;
  }
  
  /**
   * Move a piece or capture an opponent's piece
   * @param {number} fromRow - Starting row
   * @param {number} fromCol - Starting column
   * @param {number} toRow - Target row
   * @param {number} toCol - Target column
   * @returns {boolean} - Whether the move was valid
   */
  movePiece(fromRow, fromCol, toRow, toCol) {
    // Check if coordinates are valid
    if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
      return false;
    }
    
    const sourcePiece = this.board[fromRow][fromCol];
    const targetPiece = this.board[toRow][toCol];
    
    // Check if there's a piece at the source position and it's face up
    if (!sourcePiece || !sourcePiece.faceUp) return false;
    
    // Check if the piece belongs to the current player
    if (sourcePiece.color !== this.currentPlayer) return false;
    
    // Check if the move is orthogonal and only one square away
    if (!this.isOrthogonalMove(fromRow, fromCol, toRow, toCol)) return false;
    
    // Special case for Cannon
    if (sourcePiece.type === 'CANNON') {
      return this.handleCannonMove(fromRow, fromCol, toRow, toCol);
    }
    
    // Check if the target position is empty or has an opponent's piece
    if (targetPiece) {
      // Cannot move to a square with a face-down piece
      if (!targetPiece.faceUp) return false;
      
      // Cannot capture your own piece
      if (targetPiece.color === this.currentPlayer) return false;
      
      // Check if the piece can capture the target based on rank
      if (!this.canCapture(sourcePiece, targetPiece)) return false;
    }
    
    // Perform the move
    this.board[toRow][toCol] = sourcePiece;
    this.board[fromRow][fromCol] = null;
    
    // Switch player turn
    this.switchPlayer();
    
    this.turnCount++;
    this.lastMove = { type: 'move', fromRow, fromCol, toRow, toCol };
    
    // Check if the game is over
    this.checkGameOver();
    
    return true;
  }
  
  /**
   * Handle special cannon move rules
   * @param {number} fromRow - Starting row
   * @param {number} fromCol - Starting column
   * @param {number} toRow - Target row
   * @param {number} toCol - Target column
   * @returns {boolean} - Whether the move was valid
   */
  handleCannonMove(fromRow, fromCol, toRow, toCol) {
    const targetPiece = this.board[toRow][toCol];
    
    // If target is empty, just move normally (no jump needed)
    if (!targetPiece) {
      // Check if the move is orthogonal and only one square away
      if (!this.isOrthogonalMove(fromRow, fromCol, toRow, toCol)) return false;
      
      // Perform the move
      this.board[toRow][toCol] = this.board[fromRow][fromCol];
      this.board[fromRow][fromCol] = null;
      
      // Switch player turn
      this.switchPlayer();
      
      this.turnCount++;
      this.lastMove = { type: 'move', fromRow, fromCol, toRow, toCol };
      
      return true;
    }
    
    // For capture, cannon needs to jump over exactly one piece
    
    // Check if the move is in a straight line
    if (fromRow !== toRow && fromCol !== toCol) return false;
    
    // Find the direction of movement
    const rowDir = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colDir = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
    
    // Count pieces between source and target
    let screenCount = 0;
    let r = fromRow + rowDir;
    let c = fromCol + colDir;
    
    while (r !== toRow || c !== toCol) {
      if (this.board[r][c]) screenCount++;
      r += rowDir;
      c += colDir;
    }
    
    // Cannon must jump exactly one piece to capture
    if (screenCount !== 1) return false;
    
    // Target must be face up
    if (!targetPiece.faceUp) return false;
    
    // Cannot capture your own piece
    if (targetPiece.color === this.currentPlayer) return false;
    
    // Cannon can capture any piece when jumping
    
    // Perform the capture
    this.board[toRow][toCol] = this.board[fromRow][fromCol];
    this.board[fromRow][fromCol] = null;
    
    // Switch player turn
    this.switchPlayer();
    
    this.turnCount++;
    this.lastMove = { type: 'capture', fromRow, fromCol, toRow, toCol };
    
    // Check if the game is over
    this.checkGameOver();
    
    return true;
  }
  
  /**
   * Check if a piece can capture another piece based on rank
   * @param {Object} attacker - Attacking piece
   * @param {Object} defender - Defending piece
   * @returns {boolean} - Whether the capture is valid
   */
  canCapture(attacker, defender) {
    // Special case: Soldier can capture General
    if (attacker.type === 'SOLDIER' && defender.type === 'GENERAL') {
      return true;
    }
    
    // Special case: General cannot capture Soldier
    if (attacker.type === 'GENERAL' && defender.type === 'SOLDIER') {
      return false;
    }
    
    // Normal case: Higher or equal rank can capture lower rank
    return attacker.rank >= defender.rank;
  }
  
  /**
   * Check if a move is orthogonal (horizontal or vertical) and one square away
   * @param {number} fromRow - Starting row
   * @param {number} fromCol - Starting column
   * @param {number} toRow - Target row
   * @param {number} toCol - Target column
   * @returns {boolean} - Whether the move is orthogonal and one square away
   */
  isOrthogonalMove(fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    // Move must be either horizontal or vertical (not diagonal)
    // and only one square away
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }
  
  /**
   * Check if a position is valid on the board
   * @param {number} row - Row to check
   * @param {number} col - Column to check
   * @returns {boolean} - Whether the position is valid
   */
  isValidPosition(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }
  
  /**
   * Switch the current player
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
  }
  
  /**
   * Get all valid moves for a piece
   * @param {number} row - Row of the piece
   * @param {number} col - Column of the piece
   * @returns {Array} - Array of valid move positions
   */
  getValidMoves(row, col) {
    const validMoves = [];
    const piece = this.board[row][col];
    
    // If no piece or piece is face down or not current player's piece
    if (!piece || !piece.faceUp || piece.color !== this.currentPlayer) {
      return validMoves;
    }
    
    // Check all four directions (up, right, down, left)
    const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      // Skip if position is off the board
      if (!this.isValidPosition(newRow, newCol)) continue;
      
      const targetPiece = this.board[newRow][newCol];
      
      // Special case for Cannon
      if (piece.type === 'CANNON') {
        // For empty space, just check if it's adjacent
        if (!targetPiece) {
          validMoves.push([newRow, newCol]);
          continue;
        }
        
        // For capture, check if there's exactly one piece to jump over
        // in the same direction
        let jumpRow = newRow;
        let jumpCol = newCol;
        let screenFound = false;
        
        while (this.isValidPosition(jumpRow + dr, jumpCol + dc)) {
          jumpRow += dr;
          jumpCol += dc;
          
          const jumpTarget = this.board[jumpRow][jumpCol];
          
          if (jumpTarget) {
            if (screenFound) break; // Already found a screen, so this is a second piece
            
            if (jumpTarget.faceUp && jumpTarget.color !== this.currentPlayer) {
              validMoves.push([jumpRow, jumpCol]);
            }
            
            screenFound = true;
          }
        }
      } else {
        // For other pieces, check if the target is empty or has an opponent's piece
        if (!targetPiece) {
          validMoves.push([newRow, newCol]);
        } else if (targetPiece.faceUp && targetPiece.color !== this.currentPlayer) {
          // Check if the piece can capture the target
          if (this.canCapture(piece, targetPiece)) {
            validMoves.push([newRow, newCol]);
          }
        }
      }
    }
    
    return validMoves;
  }
  
  /**
   * Check if the game is over
   * @returns {boolean} - Whether the game is over
   */
  checkGameOver() {
    // Count pieces for each player
    let redPieces = 0;
    let blackPieces = 0;
    
    // Check if any player has no more pieces
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const piece = this.board[r][c];
        if (piece && piece.faceUp) {
          if (piece.color === 'red') redPieces++;
          else blackPieces++;
        }
      }
    }
    
    // Check if any player has no more pieces
    if (redPieces === 0) {
      this.gameActive = false;
      this.winner = 'black';
      return true;
    }
    
    if (blackPieces === 0) {
      this.gameActive = false;
      this.winner = 'red';
      return true;
    }
    
    // Check if current player has no valid moves
    let hasValidMoves = false;
    
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const piece = this.board[r][c];
        
        // If there are face-down pieces, the player can still make a move
        if (piece && !piece.faceUp) {
          hasValidMoves = true;
          break;
        }
        
        // Check if the current player has any valid moves with their pieces
        if (piece && piece.faceUp && piece.color === this.currentPlayer) {
          if (this.getValidMoves(r, c).length > 0) {
            hasValidMoves = true;
            break;
          }
        }
      }
      
      if (hasValidMoves) break;
    }
    
    // If the current player has no valid moves, they lose
    if (!hasValidMoves) {
      this.gameActive = false;
      this.winner = this.currentPlayer === 'red' ? 'black' : 'red';
      return true;
    }
    
    return false;
  }
  
  /**
   * Get the current game state
   * @returns {Object} - Game state object
   */
  getState() {
    return {
      board: this.board.map(row => [...row]),
      currentPlayer: this.currentPlayer,
      gameActive: this.gameActive,
      winner: this.winner,
      turnCount: this.turnCount,
      lastMove: this.lastMove
    };
  }
}

/**
 * Manages the multiplayer game session for Banqi
 */
class BanqiSession {
  constructor(socket) {
    this.socket = socket;
    this.game = new Banqi();
    this.gameCode = null;
    this.playerColor = null;
    this.isMyTurn = false;
  }
  
  /**
   * Create a new game
   */
  createGame() {
    this.socket.emit('createGame', { gameType: 'banqi' });
  }
  
  /**
   * Join an existing game
   * @param {string} code - Game code to join
   */
  joinGame(code) {
    if (code && code.trim()) {
      this.socket.emit('joinGame', { code: code.trim(), gameType: 'banqi' });
    } else {
      return false;
    }
    return true;
  }
  
  /**
   * Handle game creation response
   * @param {Object} data - Game creation data
   * @param {Function} callback - Callback function
   */
  handleGameCreated(data, callback) {
    this.gameCode = data.gameCode;
    this.playerColor = null; // Will be determined by first reveal
    this.isMyTurn = false; // Will be updated when gameStateUpdate is received
    
    if (callback) callback(data);
  }
  
  /**
   * Handle game join response
   * @param {Object} data - Game join data
   * @param {Function} callback - Callback function
   */
  handleGameJoined(data, callback) {
    this.gameCode = data.gameCode;
    this.playerColor = null; // Will be determined by first reveal
    this.isMyTurn = false; // Will be updated when gameStateUpdate is received
    
    if (callback) callback(data);
  }
  
  /**
   * Handle game start
   * @param {Function} callback - Callback function
   */
  handleGameStart(callback) {
    this.game.reset();
    
    // Note: We no longer set isMyTurn here - it will be set by the gameStateUpdate event
    console.log("In handleGameStart, socket ID:", this.socket.id);
    
    if (callback) callback(this.isMyTurn);
  }
  
  /**
   * Make a move
   * @param {number} fromRow - Starting row (if moving a piece)
   * @param {number} fromCol - Starting column (if moving a piece)
   * @param {number} toRow - Target row
   * @param {number} toCol - Target column
   * @returns {boolean} - Whether the move was valid locally
   */
  makeMove(fromRow, fromCol, toRow, toCol) {
    if (this.game.gameActive) {
      // Log the current game state for debugging
      console.log("makeMove called with state:", {
        isMyTurn: this.isMyTurn,
        playerColor: this.playerColor,
        turnCount: this.game.turnCount,
        fromRow, fromCol, toRow, toCol,
        isReveal: fromRow === toRow && fromCol === toCol
      });
      
      // For revealing a piece
      if (fromRow === toRow && fromCol === toCol) {
        const piece = this.game.board[toRow][toCol];
        if (piece && !piece.faceUp) {
          // Only allow revealing if it's your turn
          if (this.isMyTurn) {
            this.socket.emit('move', { 
              fromRow, fromCol, toRow, toCol,
              gameType: 'banqi'
            });
            return true;
          }
          console.log("Reveal rejected: not your turn");
          return false;
        }
        return false;
      }
      
      // For moving a piece - must be player's turn and their piece
      if (this.isMyTurn) {
        const piece = this.game.board[fromRow][fromCol];
        if (piece && piece.faceUp && piece.color === this.playerColor) {
          this.socket.emit('move', { 
            fromRow, fromCol, toRow, toCol,
            gameType: 'banqi'
          });
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Handle move from server
   * @param {Object} data - Move data
   * @param {Function} callback - Callback function
   */
  handleMove(data, callback) {
    const { fromRow, fromCol, toRow, toCol, result } = data;
    
    if (result && result.valid) {
      // Check if this is a reveal move (same source and destination)
      const isReveal = fromRow === toRow && fromCol === toCol;
      
      // If this was the first reveal, set player colors based on the revealed piece
      if (isReveal && result.firstPiece) {
        const firstPieceColor = result.firstPiece.color;
        
        if (data.playerId === this.socket.id) {
          // I revealed the first piece, so I get that color
          this.playerColor = firstPieceColor;
          console.log('I revealed first piece, my color is:', firstPieceColor);
        } else {
          // Opponent revealed the first piece, so I get the opposite color
          this.playerColor = firstPieceColor === 'red' ? 'black' : 'red';
          console.log('Opponent revealed first piece, my color is:', this.playerColor);
        }
      }
      
      // The rest of the state will be updated by gameStateUpdate event
    }
    
    if (callback) callback(this.game.getState());
  }
  
  /**
   * Reset the game
   */
  resetGame() {
    this.socket.emit('reset', { gameType: 'banqi' });
  }
  
  /**
   * Handle game reset
   * @param {Function} callback - Callback function
   */
  handleReset(callback) {
    this.game.reset();
    // Colors will be determined by the first revealed piece
    this.isMyTurn = false;
    
    if (callback) callback();
  }
  
  /**
   * Handle opponent leaving
   * @param {Function} callback - Callback function
   */
  handleOpponentLeft(callback) {
    this.game.gameActive = false;
    
    if (callback) callback();
  }
}

// Export the classes for use in other files
window.Banqi = Banqi;
window.BanqiSession = BanqiSession;
