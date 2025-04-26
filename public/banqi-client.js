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
  const [playerColor, setPlayerColor] = useState(null);
  const [opponentColor, setOpponentColor] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [message, setMessage] = useState("Waiting for opponent to join...");
  const [gamePhase, setGamePhase] = useState('waiting');
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    socket.on('gameReady', (data) => {
      console.log('Game is ready:', data);
      setGamePhase('playing');
      setMessage("Game started! Click any piece to reveal it.");
    });
    
    socket.on('gameStateUpdate', (data) => {
      console.log('Game state update:', data);
      setBoard(data.board);
      
      // Determine if it's my turn based on the playerTurn socket ID
      const isMyTurnNow = data.playerTurn === socket.id;
      setIsMyTurn(isMyTurnNow);
      
      // Update the current player's color
      setCurrentTurn(data.currentPlayer);
      
      // Update message based on whose turn it is
      if (data.currentPlayer) {
        if (isMyTurnNow) {
          setMessage(`Your turn (${data.currentPlayer.toUpperCase()})`);
        } else {
          setMessage(`Opponent's turn (${data.currentPlayer.toUpperCase()})`);
        }
      }
    });
    
    socket.on('move', (data) => {
      console.log('Move received:', data);
      
      // Handle first piece reveal which determines colors
      if (data.result && data.result.firstPiece) {
        const firstPieceColor = data.result.firstPiece.color;
        
        if (data.playerId === socket.id) {
          // I revealed the first piece, so I play the opposite color
          setPlayerColor(firstPieceColor === 'red' ? 'black' : 'red');
          setOpponentColor(firstPieceColor);
        } else {
          // Opponent revealed the first piece, so I play the opposite color
          setPlayerColor(firstPieceColor === 'red' ? 'red' : 'black');
          setOpponentColor(firstPieceColor === 'red' ? 'black' : 'red');
        }
        
        console.log(`First piece revealed: ${firstPieceColor}. My color: ${playerColor}`);
      }
      
      // If move failed, show error message
      if (data.result && !data.result.valid) {
        setMessage(`Invalid move: ${data.result.message}`);
      }
      
      // If a piece was captured, show message
      if (data.result && data.result.capturedPiece) {
        const captured = data.result.capturedPiece;
        setMessage(`${captured.color.toUpperCase()} ${captured.type} was captured!`);
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
  
  // Handle square click
  const handleSquareClick = (row, col) => {
    if (!board || gamePhase !== 'playing') return;
    
    const piece = board[row][col];
    
    // If no piece is selected yet
    if (!selectedPiece) {
      // Case 1: Clicking on a face-down piece to reveal it
      if (piece && !piece.faceUp && isMyTurn) {
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
      setMessage(`Selected ${piece.type}. Click destination.`);
      return;
    }
    
    // Case 3: Attempt to move/capture
    if (isMyTurn) {
      console.log(`Moving from ${selectedPiece.row},${selectedPiece.col} to ${row},${col}`);
      socket.emit('move', {
        fromRow: selectedPiece.row,
        fromCol: selectedPiece.col,
        toRow: row,
        toCol: col,
        gameType: 'banqi'
      });
      setSelectedPiece(null);
    }
  };
  
  // Get piece symbol for display
  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    if (!piece.faceUp) return '?';
    
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
    
    return symbols[piece.color][piece.type];
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
      <div className="mb-4 p-3 bg-amber-100 rounded-lg text-amber-800 font-medium">
        {message}
        {playerColor && (
          <div className="mt-2 text-sm">
            You are playing as <span className={`font-bold ${playerColor === 'red' ? 'text-red-600' : 'text-gray-800'}`}>
              {playerColor.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="mb-6 bg-amber-800 p-4 rounded-lg shadow-lg">
        <div className="grid grid-cols-8 gap-1">
          {board.map((row, rowIndex) => 
            row.map((piece, colIndex) => (
              <div 
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                className={`
                  w-12 h-12 md:w-16 md:h-16 flex items-center justify-center 
                  text-xl md:text-2xl font-bold rounded cursor-pointer
                  ${piece && !piece.faceUp ? 'bg-amber-600' : 'bg-amber-200'}
                  ${selectedPiece && selectedPiece.row === rowIndex && selectedPiece.col === colIndex ? 'ring-4 ring-yellow-400' : ''}
                  ${piece && piece.faceUp ? (piece.color === 'red' ? 'text-red-600' : 'text-gray-800') : 'text-amber-800'}
                  transition-all duration-200 hover:bg-amber-300
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
