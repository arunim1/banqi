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

// Store which player controls which color
const playerColors = new Map();

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
  // First log the pieces involved in the capture attempt
  console.log('Capture attempt:', {
    attacker: { type: attacker.type, color: attacker.color, rank: attacker.rank },
    defender: { type: defender.type, color: defender.color, rank: defender.rank }
  });
  
  // Basic validation
  if (!attacker || !defender) {
    console.log('Capture invalid: Missing piece');
    return false;
  }
  
  if (attacker.color === defender.color) {
    console.log('Capture invalid: Same color');
    return false;
  }
  
  // Soldier / General special rule
  if (attacker.type === 'SOLDIER' && defender.type === 'GENERAL') {
    console.log('Capture valid: Soldier can capture General (special rule)');
    return true;
  }
  
  if (attacker.type === 'GENERAL' && defender.type === 'SOLDIER') {
    console.log('Capture invalid: General cannot capture Soldier (special rule)');
    return false;
  }
  
  // Regular rank comparison - higher rank can capture lower rank
  const canCaptureByRank = attacker.rank >= defender.rank;
  console.log(`Capture ${canCaptureByRank ? 'valid' : 'invalid'}: Rank comparison ${attacker.rank} >= ${defender.rank} = ${canCaptureByRank}`);
  return canCaptureByRank;
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
      
      // Get this player's assigned color (if any)
      const playerAssignedColor = playerColors.get(socket.id);
      
      // Detailed debug logs for move validation
      console.log("Move validation details:", {
        moveType: isReveal ? 'reveal' : 'move/capture',
        from: { row: data.fromRow, col: data.fromCol },
        to: { row: data.toRow, col: data.toCol },
        socketId: socket.id,
        playerTurn: gameState.playerTurn,
        isPlayerTurn,
        isFirstReveal,
        serverCurrentPlayer: gameState.currentPlayer,
        playerAssignedColor,
        firstPieceRevealed: gameState.firstPieceRevealed,
        sourcePiece: gameState.board[data.fromRow]?.[data.fromCol],
        targetPiece: gameState.board[data.toRow]?.[data.toCol]
      });
      
      if (!isPlayerTurn) {
        console.log("Move rejected: Not player's turn");
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
          
          // CRITICAL: Permanently associate this player with this color
          playerColors.set(socket.id, piece.color);
          
          // Calculate opponent ID and color
          const firstRevealOtherPlayerId = socket.id === gameState.player1 ? gameState.player2 : gameState.player1;
          const otherPlayerColor = piece.color === 'red' ? 'black' : 'red';
          playerColors.set(firstRevealOtherPlayerId, otherPlayerColor);
          
          console.log(`PLAYER COLOR ASSIGNMENT: ${socket.id} -> ${piece.color}, ${firstRevealOtherPlayerId} -> ${otherPlayerColor}`);
          
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
        
        // Get this player's assigned color from the permanent mapping
        const playerAssignedColor = playerColors.get(socket.id);
        
        // Validate the move - piece must match player's assigned color
        console.log("Move validation - source piece check:", {
          sourcePiece: sourcePiece ? { type: sourcePiece.type, color: sourcePiece.color, faceUp: sourcePiece.faceUp } : null,
          serverCurrentPlayer: gameState.currentPlayer,
          playerAssignedColor: playerAssignedColor,
          socketId: socket.id,
          matchesAssignedColor: sourcePiece ? (sourcePiece.color === playerAssignedColor) : false
        });
        
        // Check if source piece belongs to this player's color AND it's this player's turn
        if (sourcePiece && sourcePiece.faceUp && sourcePiece.color === playerAssignedColor && isPlayerTurn) {
          // Cannon movement/capture rules
          if (sourcePiece.type === 'CANNON') {
            // Cannon movement/capture rules
            if (targetPiece) {
              // capture attempt – must be opponent and path with exactly one screen
              if (targetPiece.faceUp && targetPiece.color !== sourcePiece.color) {
                console.log("Cannon capture attempt:", {
                  from: { row: data.fromRow, col: data.fromCol },
                  to: { row: data.toRow, col: data.toCol },
                  screenCheckNeeded: true
                });
                
                const canCapture = cannonCanCapture(gameState.board, data.fromRow, data.fromCol, data.toRow, data.toCol);
                
                if (canCapture) {
                  console.log("Valid cannon capture - exactly one screen found");
                  capturedPiece = { ...targetPiece };
                  gameState.board[data.toRow][data.toCol] = sourcePiece;
                  gameState.board[data.fromRow][data.fromCol] = null;
                  moveValid = true;
                } else {
                  console.log("Invalid cannon capture - wrong number of screens");
                }
              } 
            } else {
              // Regular move: must be orthogonal exactly one square
              const rowDiff = Math.abs(data.toRow - data.fromRow);
              const colDiff = Math.abs(data.toCol - data.fromCol);
              const isOrthogonal = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
              
              if (isOrthogonal) {
                console.log("Valid cannon move to empty square");
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              } else {
                console.log("Invalid cannon move: not orthogonal or not adjacent", { rowDiff, colDiff });
              }
            }
          } else {
            // Non-cannon pieces
            const rowDiff = Math.abs(data.toRow - data.fromRow);
            const colDiff = Math.abs(data.toCol - data.fromCol);
            const isOrthogonal = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
            
            console.log("Non-cannon move check:", {
              rowDiff,
              colDiff, 
              isOrthogonal,
              hasTargetPiece: !!targetPiece
            });
            
            if (isOrthogonal) {
              if (!targetPiece) {
                // move to empty
                console.log("Valid move to empty square");
                gameState.board[data.toRow][data.toCol] = sourcePiece;
                gameState.board[data.fromRow][data.fromCol] = null;
                moveValid = true;
              } else if (targetPiece.faceUp && targetPiece.color !== sourcePiece.color) {
                // First verify that it's an opponent's piece
                console.log("Attempting to capture piece:", {
                  attacker: { type: sourcePiece.type, color: sourcePiece.color, rank: sourcePiece.rank },
                  defender: { type: targetPiece.type, color: targetPiece.color, rank: targetPiece.rank }
                });
                
                // Check if capture is valid according to game rules
                const captureValid = canCapture(sourcePiece, targetPiece);
                console.log("Capture validity check result:", captureValid);
                
                if (captureValid) {
                  capturedPiece = { ...targetPiece };
                  gameState.board[data.toRow][data.toCol] = sourcePiece;
                  gameState.board[data.fromRow][data.fromCol] = null;
                  moveValid = true;
                } else {
                  console.log("Capture rejected: Invalid by rank comparison");
                }
              }
            }
          }
        }
      }
      
      // Only emit the move to all players if it was valid
      if (moveValid) {
        console.log("Move validated successfully");
        
        // First update the game state - increment turn and switch player
        gameState.turnCount++;
        
        // Toggle to the other player's turn
        const otherPlayerId = socket.id === gameState.player1 ? gameState.player2 : gameState.player1;
        gameState.playerTurn = otherPlayerId;
        
        // Set current player color based on whose turn it is next
        const nextPlayerColor = playerColors.get(otherPlayerId);
        gameState.currentPlayer = nextPlayerColor;
        
        console.log("Turn switched to:", {
          player: otherPlayerId,
          color: nextPlayerColor,
          player1Id: gameState.player1,
          player1Color: playerColors.get(gameState.player1),
          player2Id: gameState.player2,
          player2Color: playerColors.get(gameState.player2)
        });

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
      
      // Reset player color assignments for this room
      const player1Id = gameState.player1;
      const player2Id = gameState.player2;
      if (player1Id && playerColors.has(player1Id)) {
        playerColors.delete(player1Id);
      }
      if (player2Id && playerColors.has(player2Id)) {
        playerColors.delete(player2Id);
      }
      
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
      
      console.log('Game reset, player colors cleared');
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
    
    // Clean up player color assignments
    if (playerColors.has(socket.id)) {
      console.log(`Cleaning up player color: ${socket.id} -> ${playerColors.get(socket.id)}`);
      playerColors.delete(socket.id);
    }
    
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
