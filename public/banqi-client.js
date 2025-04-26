// Banqi Game Client with React
// This file provides a React-based UI integrated with socket.io for multiplayer functionality

const { useState, useEffect, useRef } = React;

// Piece type information
const pieceTypes = {
  'GENERAL': { name: 'General', rank: 7, canCaptureGeneral: false },
  'ADVISOR': { name: 'Advisor', rank: 6, canCaptureGeneral: true },
  'ELEPHANT': { name: 'Elephant', rank: 5, canCaptureGeneral: true },
  'CHARIOT': { name: 'Chariot', rank: 4, canCaptureGeneral: true },
  'HORSE': { name: 'Horse', rank: 3, canCaptureGeneral: true },
  'SOLDIER': { name: 'Soldier', rank: 1, canCaptureGeneral: true },
  'CANNON': { name: 'Cannon', rank: 2, canCaptureGeneral: true, isSpecial: true },
};

// Main App Component
function App() {
  const [view, setView] = useState('lobby'); // 'lobby', 'create', 'join', 'game'
  const [gameCode, setGameCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [availableGames, setAvailableGames] = useState([]);

  const socket = useRef(null);

  // Connect to socket.io when the component mounts
  useEffect(() => {
    // Initialize socket.io
    socket.current = io();

    // Set up event listeners
    socket.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server:', socket.current.id);
    });

    socket.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    socket.current.on('gameCreated', (data) => {
      console.log('Game created:', data);
      setGameCode(data.gameCode);
      setIsCreator(true);
      setView('game');
    });

    socket.current.on('gameJoined', (data) => {
      console.log('Game joined:', data);
      setGameCode(data.gameCode);
      setIsCreator(false);
      setView('game');
    });

    socket.current.on('error', (message) => {
      setErrorMessage(message);
      console.error('Game error:', message);
    });

    socket.current.on('start', (data) => {
      console.log('Game started:', data);
      setGameStarted(true);
    });

    socket.current.on('availableGames', (games) => {
      console.log('Available games:', games);
      setAvailableGames(games);
    });

    // Clean up on unmount
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  // Refresh available games
  const refreshGames = () => {
    socket.current.emit('getAvailableGames');
  };

  // Create a new game
  const createGame = () => {
    socket.current.emit('createGame', { gameType: 'banqi' });
  };

  // Join an existing game
  const joinGame = () => {
    if (inputCode) {
      socket.current.emit('joinGame', { code: inputCode, gameType: 'banqi' });
      setErrorMessage('');
    } else {
      setErrorMessage('Please enter a game code');
    }
  };

  // Reset game
  const resetGame = () => {
    socket.current.emit('reset', { gameType: 'banqi' });
  };

  // Return to lobby
  const returnToLobby = () => {
    setView('lobby');
    setGameCode('');
    setInputCode('');
    setGameStarted(false);
    setErrorMessage('');
    setIsCreator(false);
  };

  // Render based on current view
  switch (view) {
    case 'lobby':
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-4xl font-bold mb-8 text-amber-900">Banqi Game</h1>
          <div className="flex flex-col gap-4 w-full max-w-md">
            <button
              onClick={() => setView('create')}
              className="py-3 px-6 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition"
            >
              Create New Game
            </button>
            <button
              onClick={() => {
                setView('join');
                refreshGames();
              }}
              className="py-3 px-6 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition"
            >
              Join Game
            </button>
          </div>
        </div>
      );

    case 'create':
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-3xl font-bold mb-6 text-amber-900">Create New Game</h1>
          <button
            onClick={createGame}
            className="py-3 px-6 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition mb-4"
          >
            Create Game
          </button>
          <button
            onClick={() => setView('lobby')}
            className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
          >
            Back
          </button>
        </div>
      );

    case 'join':
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-3xl font-bold mb-6 text-amber-900">Join Game</h1>
          
          <div className="mb-4 w-full max-w-md">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter game code"
              className="w-full p-2 border border-gray-300 rounded mb-2"
            />
            <button
              onClick={joinGame}
              className="w-full py-2 px-4 bg-amber-600 text-white font-bold rounded hover:bg-amber-700 transition"
            >
              Join
            </button>
          </div>
          
          {errorMessage && (
            <div className="text-red-600 mb-4">{errorMessage}</div>
          )}
          
          <div className="w-full max-w-md mb-4">
            <h2 className="text-xl font-semibold mb-2 text-amber-900">Available Games</h2>
            <button
              onClick={refreshGames}
              className="mb-2 py-1 px-3 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
            >
              Refresh
            </button>
            
            {availableGames.length === 0 ? (
              <p className="text-gray-600">No games available</p>
            ) : (
              <ul className="border rounded divide-y">
                {availableGames.map((game) => (
                  <li key={game.code} className="p-2 flex justify-between items-center hover:bg-amber-50">
                    <span>{game.code}</span>
                    <button
                      onClick={() => {
                        setInputCode(game.code);
                        joinGame();
                      }}
                      className="py-1 px-3 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition"
                    >
                      Join
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <button
            onClick={() => setView('lobby')}
            className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
          >
            Back
          </button>
        </div>
      );

    case 'game':
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-bold text-amber-900">Banqi Game</h1>
            {gameCode && (
              <div className="mt-2">
                <p className="font-semibold">Game Code: <span className="font-mono bg-amber-100 px-2 py-1 rounded">{gameCode}</span></p>
                {isCreator && (
                  <p className="text-sm text-gray-600 mt-1">Share this code with a friend to play together</p>
                )}
              </div>
            )}
          </div>
          
          <BanqiGame socket={socket.current} gameCode={gameCode} isCreator={isCreator} />
          
          <div className="mt-6 flex gap-4">
            <button
              onClick={resetGame}
              className="py-2 px-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition"
            >
              Reset Game
            </button>
            <button
              onClick={returnToLobby}
              className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
            >
              Leave Game
            </button>
          </div>
        </div>
      );
  }
}

// Banqi Game Component
function BanqiGame({ socket, gameCode, isCreator }) {
  // Game state
  const [board, setBoard] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [validMoveSquares, setValidMoveSquares] = useState({ validMoves: [], captureableMoves: [] });
  const [playerColor, setPlayerColor] = useState(null);
  const [opponentColor, setOpponentColor] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [gamePhase, setGamePhase] = useState('waiting'); // 'waiting', 'playing', 'gameOver'
  const [message, setMessage] = useState("Waiting for opponent to join...");
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('gameReady', (data) => {
      console.log('Game is ready:', data);
      setGamePhase('playing');
      setMessage("Game started! Click any piece to reveal it.");
    });

    socket.on('gameStateUpdate', (data) => {
      console.log('Game state update received from server:', data);
      
      // Important: Update board state first
      setBoard(data.board);

      // CRITICAL: Determine if it's my turn based on the server's playerTurn ID
      const isMyTurnNow = data.playerTurn === socket.id;
      console.log(`Turn status: ${isMyTurnNow ? 'MY TURN' : 'NOT MY TURN'}, playerTurn: ${data.playerTurn}, myId: ${socket.id}`);
      
      // Update client state atomically to avoid race conditions
      setIsMyTurn(isMyTurnNow);
      setCurrentTurn(data.currentPlayer);

      // Clear any selections when turn changes
      if (selectedPiece && !isMyTurnNow) {
        setSelectedPiece(null);
        setValidMoveSquares({ validMoves: [], captureableMoves: [] });
      }

      // Update message based on whose turn it is
      if (data.currentPlayer) {
        if (isMyTurnNow) {
          setMessage(`Your turn - ${playerColor ? playerColor.toUpperCase() : ''}`);
        } else {
          setMessage(`Opponent's turn - ${opponentColor ? opponentColor.toUpperCase() : ''}`);
        }
      }
    });

    socket.on('move', (data) => {
      console.log('Move response received from server:', data);

      // Handle first piece reveal which determines colors
      if (data.result && data.result.firstPiece) {
        const firstPieceColor = data.result.firstPiece.color;

        if (data.playerId === socket.id) {
          // I revealed the first piece, so I get that color
          setPlayerColor(firstPieceColor);
          setOpponentColor(firstPieceColor === 'red' ? 'black' : 'red');
          console.log(`I revealed the first piece. My color is ${firstPieceColor} and will not change.`);
        } else {
          // Opponent revealed the first piece, so they get that color
          setPlayerColor(firstPieceColor === 'red' ? 'black' : 'red');
          setOpponentColor(firstPieceColor);
          console.log(`Opponent revealed the first piece. My color is ${firstPieceColor === 'red' ? 'black' : 'red'} and will not change.`);
        }
      }

      // If move failed, show error message 
      if (data.result && !data.result.valid) {
        console.log('Move was invalid:', data.result.message);
        setMessage(`Invalid move: ${data.result.message || 'Unknown error'}`);
        
        // Provide visual feedback for invalid move
        const moveFeedback = document.getElementById('move-feedback');
        if (moveFeedback) {
          moveFeedback.textContent = 'Invalid Move';
          moveFeedback.classList.remove('hidden');
          setTimeout(() => moveFeedback.classList.add('hidden'), 1500);
        }
      }

      // If a piece was captured, show message
      if (data.result && data.result.capturedPiece) {
        const captured = data.result.capturedPiece;
        setMessage(`${captured.color.toUpperCase()} ${captured.type} was captured!`);
      }
      
      // If the move includes updated turn information, sync our state immediately
      if (data.result && data.result.playerTurn) {
        const isMyTurnNow = data.result.playerTurn === socket.id;
        console.log(`Turn changed in move response: ${isMyTurnNow ? 'MY TURN' : 'NOT MY TURN'}`);
        setIsMyTurn(isMyTurnNow);
      }
    });

    socket.on('opponentLeft', () => {
      setMessage("Opponent left the game. Waiting for new player to join...");
      setGamePhase('waiting');
    });

    socket.on('reset', () => {
      setMessage("Game has been reset. Click any piece to reveal it.");
      setSelectedPiece(null);
      setPlayerColor(null);
      setOpponentColor(null);
    });

    // Clean up event listeners
    return () => {
      socket.off('gameReady');
      socket.off('gameStateUpdate');
      socket.off('move');
      socket.off('opponentLeft');
      socket.off('reset');
    };
  }, [socket]);

  // Calculate valid moves for a piece
  const getValidMoves = (row, col) => {
    if (!board) return [];

    const piece = board[row][col];
    if (!piece || !piece.faceUp || piece.color !== playerColor) return [];

    const validMoves = [];
    const captureableMoves = [];

    // Check all four directions (up, right, down, left)
    const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      // Skip if position is off the board
      if (newRow < 0 || newRow >= 4 || newCol < 0 || newCol >= 8) continue;

      const targetPiece = board[newRow][newCol];

      // Special case for Cannon
      if (piece.type === 'CANNON') {
        // For empty space, just check if it's adjacent
        if (!targetPiece) {
          validMoves.push([newRow, newCol]);
          continue;
        }

        // For capture, check if there's exactly one piece to jump over
        if (targetPiece.faceUp) {
          let jumpRow = newRow;
          let jumpCol = newCol;
          let screenFound = false;
          let moveFound = false;

          while (true) {
            jumpRow += dr;
            jumpCol += dc;

            // If off the board, break
            if (jumpRow < 0 || jumpRow >= 4 || jumpCol < 0 || jumpCol >= 8) break;

            const jumpTarget = board[jumpRow][jumpCol];

            if (jumpTarget) {
              if (screenFound) break; // Already found a screen

              if (jumpTarget.faceUp && jumpTarget.color !== playerColor) {
                captureableMoves.push([jumpRow, jumpCol]);
                moveFound = true;
              }

              screenFound = true;
            }

            if (moveFound) break;
          }
        }
      } else {
        // For other pieces, check if the target is empty or has an opponent's piece
        if (!targetPiece) {
          validMoves.push([newRow, newCol]);
        } else if (targetPiece.faceUp && targetPiece.color !== playerColor) {
          // Check if the piece can capture the target
          const ranks = {
            'GENERAL': 7, 'ADVISOR': 6, 'ELEPHANT': 5, 'CHARIOT': 4,
            'HORSE': 3, 'CANNON': 2, 'SOLDIER': 1
          };

          // Special rule: General cannot capture Soldier
          if (piece.type === 'GENERAL' && targetPiece.type === 'SOLDIER') {
            continue;
          }

          // Special rule: Soldier can capture General
          if (piece.type === 'SOLDIER' && targetPiece.type === 'GENERAL') {
            captureableMoves.push([newRow, newCol]);
            continue;
          }

          // Regular rank comparison
          if (ranks[piece.type] >= ranks[targetPiece.type]) {
            captureableMoves.push([newRow, newCol]);
          }
        }
      }
    }

    return { validMoves, captureableMoves };
  };

  // Handle square click
  const handleSquareClick = (row, col) => {
    if (!board || gamePhase !== 'playing') return;
    
    // First, check if it's actually my turn
    if (!isMyTurn) {
      console.log('Ignoring click - not my turn');
      return;
    }

    const piece = board[row][col];

    // If no piece is selected yet
    if (!selectedPiece) {
      // Case 1: Clicked on a face-down piece
      if (piece && !piece.faceUp) {
        console.log(`Revealing piece at ${row},${col}`);
        socket.emit('move', {
          fromRow: row,
          fromCol: col,
          toRow: row,
          toCol: col,
          gameType: 'banqi'
        });
        return;
      }

      // Case 2: Clicking on own face-up piece
      if (piece && piece.faceUp && piece.color === playerColor && isMyTurn) {
        setSelectedPiece({ row, col });
        setValidMoveSquares(getValidMoves(row, col));
        setMessage(`Selected ${piece.type}. Click destination.`);
        return;
      }

      return;
    }

    // If a piece is already selected

    // Case 1: Clicked on the same piece - deselect
    if (row === selectedPiece.row && col === selectedPiece.col) {
      setSelectedPiece(null);
      setMessage(isMyTurn ? `Your turn (${playerColor.toUpperCase()})` : `Opponent's turn (${opponentColor.toUpperCase()})`);
      return;
    }

    // Case 2: Clicked on another of own pieces - select that instead
    if (piece && piece.faceUp && piece.color === playerColor && isMyTurn) {
      setSelectedPiece({ row, col });
      setValidMoveSquares(getValidMoves(row, col));
      setMessage(`Selected ${piece.type}. Click destination.`);
      return;
    }

    // Case 3: Attempt to move/capture
    if (isMyTurn) {
      // Check if this is a valid move
      const isValidMove = validMoveSquares.validMoves.some(([r, c]) => r === row && c === col);
      const isCapture = validMoveSquares.captureableMoves.some(([r, c]) => r === row && c === col);

      // Log the move attempt for debugging
      console.log('Move attempt details:', {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
        piece: board[selectedPiece.row][selectedPiece.col],
        targetPiece: board[row][col],
        isValidMove,
        isCapture,
        validMoves: validMoveSquares.validMoves,
        captureableMoves: validMoveSquares.captureableMoves,
        playerColor,
        isMyTurn
      });

      if (isValidMove || isCapture) {
        console.log(`Sending move from ${selectedPiece.row},${selectedPiece.col} to ${row},${col}`);
        // Animate the source square to give feedback
        const sourceElement = document.getElementById(`square-${selectedPiece.row}-${selectedPiece.col}`);
        if (sourceElement) {
          sourceElement.classList.add('animate-pulse');
          setTimeout(() => sourceElement.classList.remove('animate-pulse'), 500);
        }
        
        socket.emit('move', {
          fromRow: selectedPiece.row,
          fromCol: selectedPiece.col,
          toRow: row,
          toCol: col,
          gameType: 'banqi'
        });
      } else {
        setMessage('Invalid move. Select a highlighted square.');
      }
      setSelectedPiece(null);
      setValidMoveSquares({ validMoves: [], captureableMoves: [] });
    }
  };

  // Get piece symbol for display
  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    if (!piece.faceUp) return '?';
    
    // Chinese symbols
    const symbols = {
      red: {
        'GENERAL': '帥', 'ADVISOR': '仕', 'ELEPHANT': '相', 
        'CHARIOT': '俥', 'HORSE': '傌', 'SOLDIER': '兵', 'CANNON': '炮'
      },
      black: {
        'GENERAL': '將', 'ADVISOR': '士', 'ELEPHANT': '象', 
        'CHARIOT': '車', 'HORSE': '馬', 'SOLDIER': '卒', 'CANNON': '砲'
      }
    };
    
    // English abbreviations
    const englishAbbr = {
      'GENERAL': 'G', 'ADVISOR': 'A', 'ELEPHANT': 'E',
      'CHARIOT': 'C', 'HORSE': 'H', 'SOLDIER': 'S', 'CANNON': 'N'
    };
    
    const chineseSymbol = symbols[piece.color][piece.type];
    const englishLetter = englishAbbr[piece.type];
    
    return (
      <div className="flex flex-col items-center">
        <div>{chineseSymbol}</div>
        <div className="text-xs mt-[-5px]">{englishLetter}</div>
      </div>
    );
  };
  
  // If board hasn't been initialized yet
  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="mb-4 p-3 bg-amber-100 rounded-lg text-amber-800 font-medium">
          Initializing game...
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4 p-3 bg-amber-100 rounded-lg text-amber-800 font-medium">
        <div id="move-feedback" className="hidden absolute top-0 left-0 w-full bg-red-500 text-white text-center font-bold py-1 rounded-t-lg transition-opacity">
          Invalid Move
        </div>
        {message}
        {playerColor && (
          <div className="mt-2 text-sm flex justify-between items-center">
            <div>
              You are playing as <span className={`font-bold ${playerColor === 'red' ? 'text-red-600' : 'text-gray-800'}`}>
                {playerColor.toUpperCase()}
              </span>
              <br></br>
              {isMyTurn && <span className="text-green-600 font-bold">(Your Turn)</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${playerColor === 'red' ? 'bg-red-600' : 'bg-gray-800'}`}></div>
              <div className="text-xs">You</div>
              <div className={`w-4 h-4 rounded-full ${opponentColor === 'red' ? 'bg-red-600' : 'bg-gray-800'}`}></div>
              <div className="text-xs">Opponent</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mb-6 bg-amber-800 p-4 rounded-lg shadow-lg">
        <div className="grid grid-cols-8 gap-1">
          {board.map((row, rowIndex) => 
            row.map((piece, colIndex) => (
              <div 
                id={`square-${rowIndex}-${colIndex}`}
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                className={`
                  w-12 h-12 md:w-16 md:h-16 flex items-center justify-center 
                  text-xl md:text-2xl font-bold rounded cursor-pointer
                  ${piece && !piece.faceUp ? 'bg-amber-600' : 'bg-amber-200'}
                  ${selectedPiece && selectedPiece.row === rowIndex && selectedPiece.col === colIndex ? 'ring-4 ring-yellow-400' : ''}
                  ${validMoveSquares.validMoves.some(([r, c]) => r === rowIndex && c === colIndex) ? 'ring-2 ring-gray-500' : ''}
                  ${validMoveSquares.captureableMoves.some(([r, c]) => r === rowIndex && c === colIndex) ? 'ring-2 ring-green-500' : ''}
                  ${piece && piece.faceUp ? (piece.color === 'red' ? 'text-red-600' : 'text-gray-800') : 'text-amber-800'}
                  transition-all duration-200 hover:bg-amber-300 hover:scale-105
                `}
              >
                {getPieceSymbol(piece)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Render the App component
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
