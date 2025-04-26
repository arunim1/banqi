import React, { useState, useEffect } from 'react';

type PieceType = 'G' | 'A' | 'E' | 'C' | 'H' | 'S' | 'N';
type PlayerColor = 'red' | 'black';

interface PieceInfo {
  name: string;
  rank: number;
  canCaptureGeneral: boolean;
  isSpecial?: boolean;
}

interface Piece {
  type: PieceType;
  color: PlayerColor;
  faceUp: boolean;
  id: string;
}

interface Position {
  row: number;
  col: number;
}

const BanqiGame = () => {
  // Define piece types and their ranks
  const pieceTypes: Record<PieceType, PieceInfo> = {
    'G': { name: 'General', rank: 7, canCaptureGeneral: false },
    'A': { name: 'Advisor', rank: 6, canCaptureGeneral: true },
    'E': { name: 'Elephant', rank: 5, canCaptureGeneral: true },
    'C': { name: 'Chariot', rank: 4, canCaptureGeneral: true },
    'H': { name: 'Horse', rank: 3, canCaptureGeneral: true },
    'S': { name: 'Soldier', rank: 1, canCaptureGeneral: true },
    'N': { name: 'Cannon', rank: 2, canCaptureGeneral: true, isSpecial: true },
  };

  // Game state
  const [board, setBoard] = useState<(Piece | null)[][]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor | null>(null);
  const [gamePhase, setGamePhase] = useState<'initial' | 'playing' | 'gameOver'>('initial');
  const [message, setMessage] = useState("Click any piece to start the game");
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [redPieces, setRedPieces] = useState<number>(16);
  const [blackPieces, setBlackPieces] = useState<number>(16);

  // Initialize the game board
  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    const newBoard = createInitialBoard();
    setBoard(newBoard);
    setSelectedPiece(null);
    setCurrentTurn(null);
    setGamePhase('initial');
    setMessage("Click any piece to start the game");
    setWinner(null);
    setRedPieces(16);
    setBlackPieces(16);
  };

  const createInitialBoard = (): (Piece | null)[][] => {
    // Create all pieces
    const allPieces: Piece[] = [];
    
    // Define piece distribution
    const distribution: [PieceType, number][] = [
      ['G', 1], ['A', 2], ['E', 2], ['C', 2], ['H', 2], ['S', 5], ['N', 2]
    ];
    
    // Create pieces for both colors
    ['red', 'black'].forEach(color => {
      distribution.forEach(([type, count]) => {
        for (let i = 0; i < count; i++) {
          allPieces.push({
            type: type as PieceType,
            color: color as PlayerColor,
            faceUp: false,
            id: `${color}-${type}-${i}`
          });
        }
      });
    });
    
    // Shuffle the pieces
    for (let i = allPieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPieces[i], allPieces[j]] = [allPieces[j], allPieces[i]];
    }
    
    // Create the board (4x8)
    const board: (Piece | null)[][] = Array(4).fill(null).map(() => Array(8).fill(null));
    let pieceIndex = 0;
    
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        board[row][col] = allPieces[pieceIndex++];
      }
    }
    
    return board;
  };

  const handleSquareClick = (row: number, col: number) => {
    if (gamePhase === 'gameOver') return;
    
    const piece = board[row][col];
    
    // Initial phase - first piece reveal determines player colors
    if (gamePhase === 'initial') {
      if (piece && !piece.faceUp) {
        // Reveal the piece
        const newBoard = board.map(r => r.slice());
        newBoard[row][col] = { ...piece, faceUp: true };
        setBoard(newBoard);
        
        // The player who revealed the piece plays the opposite color
        const nextTurn = piece.color === 'red' ? 'black' : 'red';
        setCurrentTurn(nextTurn);
        setGamePhase('playing');
        setMessage(`${piece.color.toUpperCase()} revealed. ${nextTurn.toUpperCase()}'s turn.`);
      }
      return;
    }
    
    // Playing phase
    if (gamePhase === 'playing') {
      // If no piece is selected yet
      if (!selectedPiece) {
        // Case 1: Clicked on a face-down piece
        if (piece && !piece.faceUp) {
          revealPiece(row, col);
          return;
        }
        
        // Case 2: Clicked on own face-up piece
        if (piece && piece.faceUp && piece.color === currentTurn) {
          setSelectedPiece({ row, col });
          setMessage(`Selected ${pieceTypes[piece.type].name}. Click destination.`);
          return;
        }
        
        // Case 3: Clicked on opponent's piece or empty square
        setMessage(`Select one of your pieces to move.`);
        return;
      }
      
      // If a piece is already selected
      const selectedPieceObj = board[selectedPiece.row][selectedPiece.col];
      
      // Case 1: Clicked on the same piece - deselect
      if (row === selectedPiece.row && col === selectedPiece.col) {
        setSelectedPiece(null);
        setMessage(`${currentTurn.toUpperCase()}'s turn.`);
        return;
      }
      
      // Case 2: Clicked on another of own pieces - select that instead
      if (piece && piece.faceUp && piece.color === currentTurn) {
        setSelectedPiece({ row, col });
        setMessage(`Selected ${pieceTypes[piece.type].name}. Click destination.`);
        return;
      }
      
      // Case 3: Attempt to move/capture
      if (isValidMove(selectedPiece, { row, col })) {
        executeMove(selectedPiece, { row, col });
      } else {
        setMessage(`Invalid move. Try again.`);
      }
    }
  };

  const revealPiece = (row: number, col: number) => {
    const piece = board[row][col];
    if (!piece || piece.faceUp) return;
    
    const newBoard = board.map(r => r.slice());
    newBoard[row][col] = { ...piece, faceUp: true };
    setBoard(newBoard);
    
    // Switch turns
    const nextTurn = currentTurn === 'red' ? 'black' : 'red';
    setCurrentTurn(nextTurn);
    setMessage(`Revealed ${piece.color.toUpperCase()} ${pieceTypes[piece.type].name}. ${nextTurn.toUpperCase()}'s turn.`);
    
    // Update piece counts
    if (piece.color === 'red') {
      setRedPieces(prev => prev + 1);
    } else {
      setBlackPieces(prev => prev + 1);
    }
    
    checkGameOver();
  };

  const isValidMove = (from: Position, to: Position): boolean => {
    const fromPiece = board[from.row][from.col];
    const toPiece = board[to.row][to.col];
    
    if (!fromPiece || !fromPiece.faceUp) return false;
    
    // Check if the move is to an adjacent square (unless it's a cannon)
    const rowDiff = Math.abs(from.row - to.row);
    const colDiff = Math.abs(from.col - to.col);
    const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    
    // Special case for Cannon
    if (fromPiece.type === 'N') {
      // Cannon must move in a straight line
      if (from.row !== to.row && from.col !== to.col) return false;
      
      // If moving to an empty square, must be adjacent
      if (!toPiece && !isAdjacent) return false;
      
      // If capturing, must jump exactly one piece
      if (toPiece && toPiece.faceUp) {
        let screenCount = 0;
        
        if (from.row === to.row) {
          // Horizontal move
          const startCol = Math.min(from.col, to.col);
          const endCol = Math.max(from.col, to.col);
          
          for (let c = startCol + 1; c < endCol; c++) {
            if (board[from.row][c]) screenCount++;
          }
        } else {
          // Vertical move
          const startRow = Math.min(from.row, to.row);
          const endRow = Math.max(from.row, to.row);
          
          for (let r = startRow + 1; r < endRow; r++) {
            if (board[r][from.col]) screenCount++;
          }
        }
        
        return screenCount === 1 && toPiece.color !== fromPiece.color;
      }
    }
    
    // Regular pieces must move to adjacent squares
    if (!isAdjacent) return false;
    
    // Cannot move to a square with a face-down piece
    if (toPiece && !toPiece.faceUp) return false;
    
    // If the destination has an opponent's piece, check if capture is valid
    if (toPiece && toPiece.faceUp && toPiece.color !== fromPiece.color) {
      // Special case: General cannot capture Soldier
      if (fromPiece.type === 'G' && toPiece.type === 'S') return false;
      
      // Special case: Soldier can capture General
      if (fromPiece.type === 'S' && toPiece.type === 'G') return true;
      
      // Normal case: Higher or equal rank can capture lower rank
      return pieceTypes[fromPiece.type].rank >= pieceTypes[toPiece.type].rank;
    }
    
    // Moving to an empty square is always valid if adjacent
    return true;
  };

  const executeMove = (from: Position, to: Position) => {
    const fromPiece = board[from.row][from.col];
    const toPiece = board[to.row][to.col];
    
    if (!fromPiece) return;

    const newBoard = board.map(r => r.slice());
    
    // If capturing a piece, update piece count
    if (toPiece && toPiece.faceUp) {
      if (toPiece.color === 'red') {
        setRedPieces(prev => prev - 1);
      } else {
        setBlackPieces(prev => prev - 1);
      }
    }
    
    // Move the piece
    newBoard[to.row][to.col] = fromPiece;
    newBoard[from.row][from.col] = null;
    
    setBoard(newBoard);
    setSelectedPiece(null);
    
    // Switch turns
    const nextTurn = currentTurn === 'red' ? 'black' : 'red';
    setCurrentTurn(nextTurn);
    
    const moveType = toPiece ? 'captured' : 'moved to';
    const captureInfo = toPiece ? ` ${toPiece.color.toUpperCase()} ${pieceTypes[toPiece.type].name}` : '';
    setMessage(`${fromPiece.color.toUpperCase()} ${pieceTypes[fromPiece.type].name} ${moveType}${captureInfo}. ${nextTurn.toUpperCase()}'s turn.`);
    
    checkGameOver();
  };

  const checkGameOver = () => {
    if (redPieces === 0) {
      setGamePhase('gameOver');
      setWinner('black');
      setMessage('BLACK wins! RED has no pieces left.');
    } else if (blackPieces === 0) {
      setGamePhase('gameOver');
      setWinner('red');
      setMessage('RED wins! BLACK has no pieces left.');
    }
    
    // Check if current player has no valid moves
    // This is a complex check and omitted for brevity
  };

  const getPieceSymbol = (piece: Piece | null): string => {
    if (!piece) return '';
    if (!piece.faceUp) return '?';
    
    const symbols: Record<PlayerColor, Record<PieceType, string>> = {
      red: {
        'G': '帥', 'A': '仕', 'E': '相', 'C': '俥', 'H': '傌', 'S': '兵', 'N': '炮'
      },
      black: {
        'G': '將', 'A': '士', 'E': '象', 'C': '車', 'H': '馬', 'S': '卒', 'N': '砲'
      }
    };
    
    return symbols[piece.color][piece.type];
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 p-4">
      <h1 className="text-3xl font-bold mb-4 text-amber-900">Banqi Game</h1>
      
      <div className="mb-4 p-3 bg-amber-100 rounded-lg text-amber-800 font-medium">
        {message}
      </div>
      
      <div className="mb-6 bg-amber-800 p-4 rounded-lg shadow-lg">
        <div className="grid grid-cols-8 gap-1">
          {board.map((row, rowIndex) => 
            row.map((piece, colIndex) => (
              <div 
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                className={
                  `w-12 h-12 md:w-16 md:h-16 flex items-center justify-center 
                  text-xl md:text-2xl font-bold rounded cursor-pointer
                  ${piece && !piece.faceUp ? 'bg-amber-600' : 'bg-amber-200'}
                  ${selectedPiece && selectedPiece.row === rowIndex && selectedPiece.col === colIndex ? 'ring-4 ring-yellow-400' : ''}
                  ${piece && piece.faceUp ? (piece.color === 'red' ? 'text-red-600' : 'text-gray-800') : 'text-amber-800'}
                  transition-all duration-200 hover:bg-amber-300
                  `
                }
              >
                {getPieceSymbol(piece)}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-center">
        {gamePhase === 'gameOver' && (
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-yellow-400 rounded text-amber-900 font-semibold hover:bg-yellow-500 transition"
          >
            Restart Game
          </button>
        )}
      </div>
    </div>
  );
};

export default BanqiGame;
