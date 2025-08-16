import React, { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface DrawnNumbersProps {
  gameId: number;
}

const ranges = [
  { label: "B", start: 1, end: 15, gradientFrom: "from-red-400", gradientTo: "to-red-600" },
  { label: "I", start: 16, end: 30, gradientFrom: "from-blue-400", gradientTo: "to-blue-600" },
  { label: "N", start: 31, end: 45, gradientFrom: "from-yellow-400", gradientTo: "to-yellow-600" },
  { label: "G", start: 46, end: 60, gradientFrom: "from-purple-400", gradientTo: "to-purple-600" },
  { label: "O", start: 61, end: 75, gradientFrom: "from-green-400", gradientTo: "to-green-600" },
];

const DrawnNumbers: React.FC<DrawnNumbersProps> = ({ gameId }) => {
  const navigate = useNavigate();
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [animateKey, setAnimateKey] = useState(0);
  const [gameStatus, setGameStatus] = useState<"WAITING" | "IN_PROGRESS" | "PAUSED" | "FINISHED">("WAITING");
  const [rollingNumbers, setRollingNumbers] = useState<Array<{number: number, isRolling: boolean, position: {x: number, y: number}}>>([]);

  // Check card modal state
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [sampleCard, setSampleCard] = useState<number[][]>([]);
  const [checkCardNumber, setCheckCardNumber] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const currentRange = currentNumber
    ? ranges.find(({ start, end }) => currentNumber >= start && currentNumber <= end)
    : null;

  const displayNumber =
    currentNumber && currentRange ? `${currentRange.label}${currentNumber}` : "-";

  useEffect(() => {
    AOS.init({ duration: 800, once: false });

    // Fetch current game status
    const fetchGameStatus = async () => {
      try {
        const response = await axios.get(`http://localhost:5002/game/${gameId}`);
        setGameStatus(response.data.status);
      } catch (error) {
        console.error('Error fetching game status:', error);
      }
    };

    fetchGameStatus();

    const socket: Socket = io("http://localhost:5002", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    socket.on("drawnNumbers", (data: { gameId: number; number: number }) => {
      console.log("Received drawn number:", data);
      setCurrentNumber(data.number);
      setDrawnNumbers((prev) => [...prev, data.number]);
      setAnimateKey((prev) => prev + 1);
      
      // Add new number to rolling animation
      addRollingNumber(data.number);
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId]);

  // Control handlers
  const startGame = async () => {
    try {
      await axios.post(`http://localhost:5002/game/start/${gameId}`);
      setGameStatus("IN_PROGRESS");
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const pauseGame = async () => {
    try {
      await axios.post(`http://localhost:5002/game/pause/${gameId}`);
      setGameStatus("PAUSED");
    } catch (error) {
      console.error('Error pausing game:', error);
    }
  };

  const playGame = async () => {
    try {
      await axios.post(`http://localhost:5002/game/play/${gameId}`);
      setGameStatus("IN_PROGRESS");
    } catch (error) {
      console.error('Error resuming game:', error);
    }
  };

  const stopGame = async () => {
    try {
      await axios.post(`http://localhost:5002/game/stop/${gameId}`);
      setGameStatus("FINISHED");
      setDrawnNumbers([]);
      // Navigate back to card selection page
      navigate("/");
    } catch (error) {
      console.error('Error stopping game:', error);
    }
  };

  const resetGame = async () => {
    try {
      await axios.post(`http://localhost:5002/game/reset/${gameId}`);
      setGameStatus("WAITING");
      setDrawnNumbers([]);
      setCurrentNumber(null);
      // Navigate back to card selection page
      navigate("/");
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  const refreshGameStatus = async () => {
    try {
      const response = await axios.get(`http://localhost:5002/game/${gameId}`);
      setGameStatus(response.data.status);
    } catch (error) {
      console.error('Error fetching game status:', error);
    }
  };

  // Rolling animation functions
  const addRollingNumber = (number: number) => {
    const newRollingNumber = {
      number,
      isRolling: true,
      position: { x: Math.random() * 80, y: -100 } // Start above screen
    };
    
    setRollingNumbers(prev => [...prev, newRollingNumber]);
    
    // Start rolling animation
    setTimeout(() => {
      setRollingNumbers(prev => 
        prev.map(rn => 
          rn.number === number 
            ? { ...rn, isRolling: false, position: calculateFinalPosition(prev, number) }
            : rn
        )
      );
    }, 2000); // Roll for 2 seconds
  };

  const calculateFinalPosition = (existingNumbers: typeof rollingNumbers, newNumber: number) => {
    // Calculate position based on existing numbers
    const baseY = 85; // Bottom of screen
    const spacing = 65; // Space between numbers
    const maxPerRow = 7; // Maximum numbers per row
    
    if (existingNumbers.length === 0) {
      return { x: 5, y: baseY };
    }
    
    // Find the rightmost position in the current row
    const currentRowNumbers = existingNumbers.filter(rn => 
      Math.abs(rn.position.y - baseY) < 10
    );
    
    if (currentRowNumbers.length < maxPerRow) {
      // Add to current row
      const rightmostX = Math.max(...currentRowNumbers.map(rn => rn.position.x));
      return { x: rightmostX + spacing, y: baseY };
    } else {
      // Start new row above
      const newRowY = baseY - 50;
      return { x: 5, y: newRowY };
    }
  };

  // Check card from backend
  const checkCard = async () => {
  if (!checkCardNumber) return;

  try {
    const res = await axios.post("http://localhost:5002/game/check-card", {
      cardId: checkCardNumber,
      gameId: Number(gameId), // ✅ ensure number
    });

    const data = res.data;

    setSampleCard(data.card.card.layout);
    setCheckResult(data.isWinner ? "🎉 Card is a WINNER!" : "❌ Card did NOT win.");
    setDrawnNumbers(data.drawnNumbers || []);
  } catch (err: any) {
    if (err.response && err.response.data && err.response.data.message) {
      setCheckResult(`⚠️ ${err.response.data.message}`);
    } else {
      setCheckResult("⚠️ Error checking card. Please try again.");
    }
    setSampleCard([]); // clear the card display
  }
};

// Close modal and reset state
const handleCloseCheckModal = () => {
  setShowCheckModal(false);
  setSampleCard([]);       // clear the card
  setCheckCardNumber(null); // clear input
  setCheckResult(null);     // clear result
};




  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-700 to-teal-600 p-10 flex flex-col items-center gap-10 text-white select-none">
      {/* Game Status Display */}
      <div className="flex items-center gap-4">
        <div className="text-xl font-bold">
          Game Status: <span className="capitalize">{gameStatus.toLowerCase().replace('_', ' ')}</span>
        </div>
        <button 
          onClick={refreshGameStatus}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-6">
        {gameStatus === "WAITING" && (
          <button onClick={startGame} className="px-6 py-3 bg-green-500 hover:bg-green-600 text-lg font-bold rounded-lg shadow-lg transition">
            Start
          </button>
        )}
        {gameStatus === "IN_PROGRESS" && (
          <button onClick={pauseGame} className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-lg font-bold rounded-lg shadow-lg transition">
            Pause
          </button>
        )}
        {gameStatus === "PAUSED" && (
          <>
            <button onClick={playGame} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-lg font-bold rounded-lg shadow-lg transition">
              Play
            </button>
            <button onClick={stopGame} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-lg font-bold rounded-lg shadow-lg transition">
              Stop
            </button>
          </>
        )}
        {gameStatus === "FINISHED" && (
          <button onClick={resetGame} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-lg font-bold rounded-lg shadow-lg transition">
            Reset
          </button>
        )}
        <button onClick={() => setShowCheckModal(true)} className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-bold shadow-lg transition">
          Check
        </button>
      </div>

      {/* Bingo board */}
      <div className="flex items-center justify-center gap-20 w-full max-w-7xl">
        <div className="flex flex-col gap-10 items-center max-w-5xl w-full">
          {ranges.map(({ label, start, end }) => (
            <div key={label} className="flex items-center gap-8 w-full justify-center">
              <div className="w-12 text-4xl font-extrabold font-mono text-yellow-300 drop-shadow-lg">
                {label}
              </div>
              <div className="flex gap-3 flex-wrap justify-center max-w-4xl">
                {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((num) => {
                  const isDrawn = drawnNumbers.includes(num);
                  return (
                    <div key={num} className={`w-12 h-12 flex items-center justify-center rounded-full font-semibold ${isDrawn ? "bg-gradient-to-tr from-green-400 to-green-600 text-white shadow-[0_0_10px_3px_rgba(34,197,94,0.7)]" : "bg-white bg-opacity-20 text-gray-200 border border-white border-opacity-30"}`}>
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Current Number */}
        <div key={animateKey} data-aos="zoom-in" className={`flex flex-col items-center justify-center flex-shrink-0 w-56 h-56 rounded-full text-white text-6xl font-extrabold shadow-lg ${currentRange ? `bg-gradient-to-tr ${currentRange.gradientFrom} ${currentRange.gradientTo}` : "bg-gray-600"}`}>
          {displayNumber}
        </div>
      </div>

      {/* Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg w-96 relative">
            
            {/* X Close Button */}
            {/* X Close Button */}
        <button
          onClick={handleCloseCheckModal}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ×
        </button>


            <h2 className="text-xl font-bold mb-4 text-center">Check Card</h2>

            <input
              type="number"
              placeholder="Enter Card ID"
              className="border p-2 w-full rounded mb-4"
              onChange={(e) => setCheckCardNumber(Number(e.target.value))}
            />

            <button
              onClick={checkCard}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mb-4"
            >
              Check
            </button>

            {checkResult && (
              <div className="mb-4 text-center font-semibold">{checkResult}</div>
            )}

            {/* Bingo Card UI */}
            {sampleCard.length > 0 && (
              <div className="flex justify-center">
                {/* Render columns */}
                <div className="grid grid-cols-5 gap-2">
                  {["B", "I", "N", "G", "O"].map((letter, colIndex) => (
                    <div key={letter} className="flex flex-col items-center gap-2">
                      {/* Column Letter */}
                      <div className="w-10 h-10 flex items-center justify-center font-bold text-lg bg-blue-500 text-white rounded">
                        {letter}
                      </div>

                      {/* Column Numbers */}
                      {sampleCard[colIndex].map((num, rowIndex) => {
                        const marked = drawnNumbers.includes(num);
                        return (
                          <div
                            key={`${colIndex}-${rowIndex}`}
                            className={`w-10 h-10 flex items-center justify-center rounded font-semibold ${
                              marked
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-black"
                            }`}
                          >
                            {num === 0 ? "★" : num}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rolling Numbers Display */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-black bg-opacity-80 overflow-hidden border-t-2 border-yellow-400">
        {rollingNumbers.map((rollingNumber, index) => (
          <div
            key={`${rollingNumber.number}-${index}`}
            className={`absolute text-2xl font-bold text-white ${
              rollingNumber.isRolling 
                ? 'animate-bounce text-yellow-400 drop-shadow-lg' 
                : 'text-green-400 drop-shadow-md'
            }`}
            style={{
              left: `${rollingNumber.position.x}%`,
              top: `${rollingNumber.position.y}%`,
              transform: rollingNumber.isRolling ? 'scale(1.2)' : 'scale(1)',
              transition: rollingNumber.isRolling ? 'none' : 'all 0.5s ease-out',
              textShadow: rollingNumber.isRolling 
                ? '0 0 10px rgba(255, 255, 0, 0.8)' 
                : '0 0 5px rgba(34, 197, 94, 0.6)',
            }}
          >
            {rollingNumber.number}
            {/* Trail effect for rolling numbers */}
            {rollingNumber.isRolling && (
              <div className="absolute -top-1 -left-1 w-8 h-8 bg-yellow-400 bg-opacity-30 rounded-full animate-ping"></div>
            )}
          </div>
        ))}
        
        {/* Instructions and Counter */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-400">
          Drawn Numbers: {drawnNumbers.length}
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-yellow-400">
          Rolling: {rollingNumbers.filter(rn => rn.isRolling).length}
        </div>
      </div>
    </div>
  );
};

export default DrawnNumbers;
