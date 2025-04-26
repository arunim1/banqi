// Banqi game server
// Run with:  node server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static('public'));           // serves index.html + client JS

// Map to store active games
const activeGames = new Map();

// Store Banqi game states shared across all sockets
const banqiGames = new Map();

// Game types
const GAME_TYPE = 'banqi';

// === Helper: generate a fresh shuffled Banqi board ===
function generateBanqiBoard() {
  const pieceTypes = {
    GENERAL: { rank: 7, count: 1 },
    ADVISOR: { rank: 6, count: 2 },
    ELEPHANT: { rank: 5, count: 2 },
    CHARIOT: { rank: 4, count: 2 },
    HORSE: { rank: 3, count: 2 },
    CANNON: { rank: 2, count: 2 },
    SOLDIER: { rank: 1, count: 5 }
  };
  const pieces = [];
  for (const type in pieceTypes) {
    for (let i = 0; i < pieceTypes[type].count; i++) {
      pieces.push({ type, color: 'red', rank: pieceTypes[type].rank });
    }
  }
  for (const type in pieceTypes) {
    for (let i = 0; i < pieceTypes[type].count; i++) {
      pieces.push({ type, color: 'black', rank: pieceTypes[type].rank });
    }
  }
  // Fisher-Yates shuffle
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  // Build 4×8 board
  const board = Array(4)
    .fill()
    .map(() => Array(8).fill(null));
  let idx = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      board[r][c] = { ...pieces[idx++], faceUp: false };
    }
  }
  return board;
}

// Helper to evaluate capture legality
function canCapture(attacker, defender) {
  if (!attacker || !defender) return false;
  if (attacker.color === defender.color) return false;
  // Soldier / General special rule
  if (attacker.type === 'SOLDIER' && defender.type === 'GENERAL') return true;
  if (attacker.type === 'GENERAL' && defender.type === 'SOLDIER') return false;
  return attacker.rank >= defender.rank;
}

// Helper to check cannon capture path: exactly one screen piece between source and target along same row/col
function cannonCanCapture(board, fromRow, fromCol, toRow, toCol) {
  if (fromRow !== toRow && fromCol !== toCol) return false; // must be orthogonal
  let screens = 0;
  if (fromRow === toRow) {
    const dir = toCol > fromCol ? 1 : -1;
    for (let c = fromCol + dir; c !== toCol; c += dir) {
      if (board[fromRow][c]) screens++;
    }
  } else {
    const dir = toRow > fromRow ? 1 : -1;
    for (let r = fromRow + dir; r !== toRow; r += dir) {
      if (board[r][fromCol]) screens++;
    }
  }
  return screens === 1; // exactly one piece between
}

io.on('connection', socket => {
  // Each browser tab is a "player".
  let room = null;
  
  // Create a new game
  socket.on('createGame', (data = {}) => {
    console.log('Create game request received', data);
    
    // Verify game type is banqi
    const gameType = GAME_TYPE;
    
    // Generate a unique game code
    const gameCode = crypto.randomUUID().substring(0, 8);
    console.log('Generated game code:', gameCode);
    
    // Set up the room with the game code
    room = gameCode;
    socket.join(room);
    
    // Store game info
    activeGames.set(gameCode, {
      creator: socket.id,
      createdAt: new Date(),
      gameType: gameType
    });
    
    // Set player as player 1
    socket.data.playerNumber = 1;
    socket.data.gameCode = gameCode;
    socket.data.gameType = gameType;
    
    // Send game code to creator
    const responseData = {
      gameCode: gameCode,
      playerNumber: 1,
      gameType: gameType
    };
    
    console.log('Sending gameCreated event with data:', responseData);
    socket.emit('gameCreated', responseData);
    
    // If this is a Banqi game, create the initial shared board and game state
    if (gameType === GAME_TYPE) {
      const board = generateBanqiBoard();
      banqiGames.set(gameCode, {
        board,
        firstPieceRevealed: false,
        firstPieceColor: null,
        firstRevealPlayerId: null,
        currentPlayer: null,
        turnCount: 0,
        playerTurn: null, // will be randomly assigned when another player joins
        revealedPieces: {},
        player1: socket.id,
        player2: null
      });
    }
  });
  
  // Join an existing game
  socket.on('joinGame', (data) => {
    // Handle both string and object formats for backward compatibility
    const gameCode = typeof data === 'string' ? data : data.code;
    const gameType = GAME_TYPE;
    
    // Check if game exists
    if (!activeGames.has(gameCode)) {
      socket.emit('error', 'Game not found. Check your game code.');
      return;
    }
    
    // Check if game types match
    const gameInfo = activeGames.get(gameCode);
    if (gameInfo.gameType !== gameType) {
      socket.emit('error', `This code is for a ${gameInfo.gameType} game, not a ${gameType} game.`);
      return;
    }
    
    // Get the room for this game code
    room = gameCode;
    
    // Check if room is full
    const clients = io.sockets.adapter.rooms.get(room);
    if (clients && clients.size >= 2) {
      socket.emit('error', 'Game is full. Try another code.');
      return;
    }
    
    // Join the room
    socket.join(room);
    
    // Set player as player 2
    socket.data.playerNumber = 2;
    socket.data.gameCode = gameCode;
    socket.data.gameType = gameType;
    
    // For Banqi, register second player and randomly choose who goes first
    if (banqiGames.has(room)) {
      const gameState = banqiGames.get(room);
      gameState.player2 = socket.id;
      // Randomly decide which socket ID gets the first turn
      gameState.playerTurn = Math.random() < 0.5 ? gameState.player1 : gameState.player2;
    }
    
    // Tell the client they're player 2
    socket.emit('gameJoined', {
      gameCode: gameCode,
      playerNumber: 2,
      gameType: gameType
    });
    
    // Start the game for both players
    io.to(room).emit('start', { gameType: GAME_TYPE });
    io.to(room).emit('gameReady', { isReady: true, gameType: GAME_TYPE });
    
    // If this is a Banqi game, send the current game state
    if (banqiGames.has(room)) {
      const gameState = banqiGames.get(room);
      
      // Log debug info
      console.log("Game joined - Turn information:");
      console.log("Creator Socket ID:", activeGames.get(room).creator);
      console.log("Joiner Socket ID:", socket.id);
      console.log("Current playerTurn:", gameState.playerTurn);
      
      io.to(room).emit('gameStateUpdate', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        playerTurn: gameState.playerTurn
      });
    }
  });

  socket.on('move', data => {
    if (!room) return;
    
    const gameType = GAME_TYPE;
    
    if (gameType === GAME_TYPE) {
      // For Banqi, data contains more information
      const isReveal = data.fromRow === data.toRow && data.fromCol === data.toCol;
      
      // Initialize game state if it doesn't exist
      if (!banqiGames.has(room)) {
        // Generate a shared board for both players
        const board = generateBanqiBoard();
        banqiGames.set(room, {
          board,
          firstPieceRevealed: false,
          firstPieceColor: null,
          firstRevealPlayerId: null,
          currentPlayer: null,
          turnCount: 0,
          playerTurn: null, // will be randomly assigned when another player joins
          revealedPieces: {},
          player1: null,
          player2: null
        });
      }
      
      const gameState = banqiGames.get(room);
      
      // Immediately notify both players about the initial game state when move is received
      io.to(room).emit('gameStateUpdate', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        playerTurn: gameState.playerTurn
      });
      
      // Validate move
      let moveValid = false;
      let capturedPiece = null;
      
      // First verify that it's this player's turn
      // Only the very first reveal gets special treatment
      const isFirstReveal = isReveal && !gameState.firstPieceRevealed;
      const isPlayerTurn = gameState.playerTurn === socket.id;
      
      // Debug logs for turn verification
      console.log("Move validation info:");
      console.log("Move from socket ID:", socket.id);
      console.log("Current playerTurn:", gameState.playerTurn);
      console.log("Is player's turn?", isPlayerTurn);
      console.log("Is first reveal?", isFirstReveal);
      
      if (!isPlayerTurn) {
        // Not this player's turn, send invalid move
        socket.emit('move', {
          fromRow: data.fromRow,
          fromCol: data.fromCol,
          toRow: data.toRow,
          toCol: data.toCol,
          playerId: socket.id,
          player: socket.data.playerNumber,
          gameType: GAME_TYPE,
          result: { 
            valid: false,
            message: "Not your turn"
          }
        });
        return;
      }
      
      // Handle first piece reveal
      let firstPiece = null;
      if (isFirstReveal) {
        const piece = gameState.board[data.toRow][data.toCol];
        if (piece && !piece.faceUp) {
          // First piece revealed determines player colors
          gameState.firstPieceRevealed = true;
          gameState.firstPieceColor = piece.color;
          gameState.firstRevealPlayerId = socket.id;
          gameState.turnCount++;
          
          // Reveal the piece on the shared board
          gameState.board[data.toRow][data.toCol].faceUp = true;
          
          // Track this revealed piece
          const pieceKey = `${data.toRow},${data.toCol}`;
          gameState.revealedPieces[pieceKey] = true;
          
          firstPiece = { color: piece.color };
          console.log(`First piece revealed: ${piece.color} by player ${socket.id}`);
          
          // The player who revealed gets that color
          gameState.currentPlayer = piece.color;
          
          // Other player goes next - determine who that is
          const otherPlayerId = socket.id === gameState.player1 
            ? gameState.player2 
            : gameState.player1;
            
          gameState.playerTurn = otherPlayerId;
          
          moveValid = true;
        }
      } else if (isReveal) {
        // Subsequent reveals
        const piece = gameState.board[data.toRow][data.toCol];
        
        if (piece && !piece.faceUp) {
          // Reveal the piece on the shared board
          gameState.board[data.toRow][data.toCol].faceUp = true;
          
          // Track this revealed piece
          const pieceKey = `${data.toRow},${data.toCol}`;
          gameState.revealedPieces[pieceKey] = true;
          
          gameState.turnCount++;
          
          // Switch current player
          gameState.currentPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';
          
          // Other player goes next - determine who that is
          const otherPlayerId = socket.id === gameState.player1 
            ? gameState.player2 
            : gameState.player1;
            
          gameState.playerTurn = otherPlayerId;
          
          moveValid = true;
        }
      } else {
        // Regular move (not a reveal)
        const sourcePiece = gameState.board[data.fromRow][data.fromCol];
        const targetPiece = gameState.board[data.toRow][data.toCol];
        
        // Validate the move - source piece must be face up and belong to the player
        if (sourcePiece && sourcePiece.faceUp && sourcePiece.color === gameState.currentPlayer) {
          // Cannon movement/capture rules
          if (sourcePiece.type === 'CANNON') {
            // Cannon movement/capture rules
            if (targetPiece) {
              // capture attempt – must be opponent and path with exactly one screen
              if (targetPiece.faceUp && targetPiece.color !== sourcePiece.color && cannonCanCapture(gameState.board, data.fromRow, data.fromCol, data.toRow, data.toCol)) {
                capturedPiece = { ...targetPiece };
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              }
            } else {
              // Regular move: must be orthogonal exactly one square
              const isOrthogonal = (Math.abs(data.toRow - data.fromRow) === 1 && data.toCol === data.fromCol) || (data.toRow === data.fromRow && Math.abs(data.toCol - data.fromCol) === 1);
              if (isOrthogonal) {
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              }
            }
          } else {
            // Non-cannon pieces
            const isOrthogonal = (Math.abs(data.toRow - data.fromRow) === 1 && data.toCol === data.fromCol) || (data.toRow === data.fromRow && Math.abs(data.toCol - data.fromCol) === 1);
            if (isOrthogonal) {
              if (!targetPiece) {
                // move to empty
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              } else if (targetPiece.faceUp && canCapture(sourcePiece, targetPiece)) {
                capturedPiece = { ...targetPiece };
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              }
            }
          }
        }
      }
      
      // Only emit the move to all players if it was valid
      if (moveValid) {
        // First update the game state - increment turn and switch player
        gameState.turnCount++;
        // Switch current player color
        gameState.currentPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';
        // Toggle socket turn
        const otherPlayerId = socket.id === gameState.player1 ? gameState.player2 : gameState.player1;
        gameState.playerTurn = otherPlayerId;

        // Then emit the move event with the updated player turn
        io.to(room).emit('move', {
          fromRow: data.fromRow,
          fromCol: data.fromCol,
          toRow: data.toRow,
          toCol: data.toCol,
          playerId: socket.id,
          player: socket.data.playerNumber,
          gameType: GAME_TYPE,
          result: { 
            valid: true, 
            firstPiece: firstPiece,
            currentPlayer: gameState.currentPlayer,
            capturedPiece: capturedPiece,
            playerTurn: gameState.playerTurn // Include updated player turn
          }
        });
        
        // Then emit the full game state update with the new turn information
        io.to(room).emit('gameStateUpdate', {
          board: gameState.board,
          currentPlayer: gameState.currentPlayer,
          playerTurn: gameState.playerTurn
        });
      }
    }
  });

  socket.on('reset', (data = {}) => {
    if (!room) return;
    
    // Reset Banqi game state
    if (banqiGames.has(room)) {
      const gameState = banqiGames.get(room);
      // Re-generate a fresh board
      gameState.board = generateBanqiBoard();
      gameState.firstPieceRevealed = false;
      gameState.firstPieceColor = null;
      gameState.firstRevealPlayerId = null;
      gameState.currentPlayer = null;
      gameState.turnCount = 0;
      gameState.revealedPieces = {};
      // Randomly assign next starting player
      gameState.playerTurn = Math.random() < 0.5 ? gameState.player1 : gameState.player2;
    }
    
    io.to(room).emit('reset', { gameType: GAME_TYPE });
    
    // Send the updated game state after reset
    if (banqiGames.has(room)) {
      const gameState = banqiGames.get(room);
      io.to(room).emit('gameStateUpdate', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        playerTurn: gameState.playerTurn
      });
    }
  });

  socket.on('disconnect', () => {
    if (!room) return;
    
    // Notify remaining player that opponent left
    io.to(room).emit('opponentLeft');
    io.to(room).emit('reset');
    
    // Clean up game if this was the creator
    const gameInfo = activeGames.get(room);
    if (gameInfo && gameInfo.creator === socket.id) {
      activeGames.delete(room);
      
      // Clean up Banqi game state if applicable
      if (banqiGames.has(room)) {
        banqiGames.delete(room);
      }
    }
  });
  
  // Get list of available games
  socket.on('getAvailableGames', () => {
    const availableGames = [];
    
    for (const [code, info] of activeGames.entries()) {
      const clients = io.sockets.adapter.rooms.get(code);
      if (clients && clients.size === 1) {
        availableGames.push({
          code: code,
          createdAt: info.createdAt
        });
      }
    }
    
    socket.emit('availableGames', availableGames);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () =>
  console.log(`Banqi game running on http://localhost:${PORT}`)
);
