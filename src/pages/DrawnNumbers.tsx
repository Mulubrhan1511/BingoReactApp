import React, { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import { io, Socket } from "socket.io-client";
import axios from "axios";

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
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [animateKey, setAnimateKey] = useState(0);
  const [gameStatus, setGameStatus] = useState<"stopped" | "playing" | "paused">("stopped");

  const currentRange = currentNumber
    ? ranges.find(({ start, end }) => currentNumber >= start && currentNumber <= end)
    : null;

  const displayNumber =
    currentNumber && currentRange ? `${currentRange.label}${currentNumber}` : "-";

  useEffect(() => {
    AOS.init({ duration: 800, once: false });

    const socket: Socket = io("http://localhost:5002", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    // Listen to drawnNumbers event from backend
    socket.on("drawnNumbers", (data: { gameId: number; number: number }) => {
      console.log("Received drawn number:", data);
      
        setCurrentNumber(data.number);
        setDrawnNumbers((prev) => [...prev, data.number]);
        setAnimateKey((prev) => prev + 1);
      
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId, gameStatus]);

  // Control handlers
  const startGame = () => {
    axios.post(`http://localhost:5002/game/start/${gameId}`)
      .then(() => {
        setGameStatus("playing");
      })
      .catch(console.error);
  };

  const pauseGame = () => {
    axios.post(`http://localhost:5002/game/pause/${gameId}`)
      .then(() => {
        setGameStatus("paused");
      })
      .catch(console.error);
  };

  const playGame = () => {
    axios.post(`http://localhost:5002/game/play/${gameId}`)
      .then(() => {
        setGameStatus("playing");
      })
      .catch(console.error);
  };

  const stopGame = () => {
    axios.post(`http://localhost:5002/game/stop/${gameId}`)
      .then(() => {
        setGameStatus("stopped");
        setDrawnNumbers([]);
      })
      .catch(console.error);
  };

  const resetGame = () => {
    setCurrentNumber(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-700 to-teal-600 p-10 flex flex-col items-center gap-10 text-white select-none">
      {/* Control Buttons */}
      <div className="flex gap-6">
        <button
          onClick={startGame}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-lg font-bold rounded-lg shadow-lg transition"
        >
          Start
        </button>
        <button
          onClick={pauseGame}
          disabled={gameStatus !== "playing"}
          className={`px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-lg font-bold rounded-lg shadow-lg transition ${
            gameStatus !== "playing" ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Pause
        </button>
        <button
          onClick={stopGame}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-lg font-bold rounded-lg shadow-lg transition"
        >
          Stop
        </button>

        <button
          onClick={playGame}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-lg font-bold rounded-lg shadow-lg transition"
        >
          Play
        </button>
      </div>

      <div className="flex items-center justify-center gap-20 w-full max-w-7xl">
        {/* Grid */}
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
                    <div
                      key={num}
                      className={`w-12 h-12 flex items-center justify-center rounded-full font-semibold cursor-default
                        transform transition duration-300
                        ${
                          isDrawn
                            ? "bg-gradient-to-tr from-green-400 to-green-600 text-white shadow-[0_0_10px_3px_rgba(34,197,94,0.7)]"
                            : "bg-white bg-opacity-20 text-gray-200 border border-white border-opacity-30"
                        }
                      `}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Current Drawn Number */}
        <div
          key={animateKey}
          data-aos="zoom-in"
          className={`flex flex-col items-center justify-center flex-shrink-0 w-56 h-56 rounded-full text-white text-6xl font-extrabold shadow-lg
            ${
              currentRange
                ? `bg-gradient-to-tr ${currentRange.gradientFrom} ${currentRange.gradientTo}`
                : "bg-gray-600"
            }
          `}
        >
          {displayNumber}
        </div>
      </div>
    </div>
  );
};

export default DrawnNumbers;
