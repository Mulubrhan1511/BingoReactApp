import React, { useEffect, useRef, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface DrawnNumbersProps {
  gameId: number | string;
  drawnNumbers?: number[];
}

const ranges = [
  { label: "B", start: 1, end: 15, gradientFrom: "from-red-400", gradientTo: "to-red-600" },
  { label: "I", start: 16, end: 30, gradientFrom: "from-blue-400", gradientTo: "to-blue-600" },
  { label: "N", start: 31, end: 45, gradientFrom: "from-yellow-400", gradientTo: "to-yellow-600" },
  { label: "G", start: 46, end: 60, gradientFrom: "from-purple-400", gradientTo: "to-purple-600" },
  { label: "O", start: 61, end: 75, gradientFrom: "from-green-400", gradientTo: "to-green-600" },
];

// Rolling ball layout/physics constants
const BALL_DIAMETER_PX = 56; // visible ball size
const BALL_RADIUS_PX = BALL_DIAMETER_PX / 2;
const BALL_GAP_PX = 12; // spacing between settled balls
const LEFT_PADDING_PX = 16; // left offset for the first ball
const INITIAL_SPEED_PX_S = 700; // how fast a ball rolls in from the right
const VERTICAL_SPEED_PX_S = 800; // how fast a ball snaps vertically when rows change
const BOTTOM_OFFSET_PX = 18; // base bottom offset for tray content
const MAX_BOTTOM_ROW_COUNT = 28; // wrap after 28 to top row

// Helper to get gradient colors for a number
const getGradientForNumber = (num: number) => {
  const r = ranges.find(({ start, end }) => num >= start && num <= end);
  return {
    from: r?.gradientFrom ?? "from-gray-300",
    to: r?.gradientTo ?? "to-gray-500",
  };
};

// Ball type used for the rolling tray
type RollingBall = {
  id: number;
  createdAt: number;
  number: number;
  x: number; // current center X in px relative to tray
  y: number; // current vertical offset from bottom offset in px
  targetX: number; // where it should settle (X)
  targetY: number; // where it should settle (Y)
  vx: number; // px/sec (negative when moving left)
  rotationDeg: number; // visual rotation for realism
  settled: boolean;
  gradientFrom: string;
  gradientTo: string;
};

const DrawnNumbers: React.FC<DrawnNumbersProps> = ({ gameId }) => {
  const navigate = useNavigate();
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [animateKey, setAnimateKey] = useState(0);
  const [gameStatus, setGameStatus] = useState<"WAITING" | "IN_PROGRESS" | "PAUSED" | "FINISHED">("WAITING");

  // Refs for physics loop
  const trayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const [rollingNumbers, setRollingNumbers] = useState<RollingBall[]>([]);
  const rollingRef = useRef<RollingBall[]>([]);
  useEffect(() => {
    rollingRef.current = rollingNumbers;
  }, [rollingNumbers]);

  // Check card modal state
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [sampleCard, setSampleCard] = useState<number[][]>([]);
  const [checkCardNumber, setCheckCardNumber] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const currentRange = currentNumber
    ? ranges.find(({ start, end }) => currentNumber >= start && currentNumber <= end)
    : null;

  const displayNumber = currentNumber && currentRange ? `${currentRange.label}${currentNumber}` : "-";

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

      // Add new number to rolling animation (ball rolls in from the right and settles to the row)
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

  // ---------- Rolling animation (physics) ----------
  const startLoopIfNeeded = () => {
    if (rafRef.current != null) return;
    lastTsRef.current = null;
    const step = (ts: number) => {
      const prevTs = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = prevTs == null ? 0 : (ts - prevTs) / 1000; // seconds

      if (dt > 0) {
        setRollingNumbers((prev) => {
          const circumference = Math.PI * BALL_DIAMETER_PX;
          const next = prev.map((b) => {
            let x = b.x;
            let y = b.y;
            let rotationDeg = b.rotationDeg;
            let vx = b.vx;
            let settled = b.settled;

            if (!b.settled) {
              x = b.x + b.vx * dt;
              rotationDeg = b.rotationDeg + (b.vx * dt / circumference) * 360;
              if (x <= b.targetX) {
                x = b.targetX;
                rotationDeg = Math.round(rotationDeg);
                vx = 0;
                settled = true;
              }
            }

            // Smooth vertical snap even for settled balls
            if (Math.abs(b.targetY - y) > 0.5) {
              const dir = b.targetY > y ? 1 : -1;
              const dy = VERTICAL_SPEED_PX_S * dt * dir;
              const nextY = y + dy;
              if ((dir > 0 && nextY > b.targetY) || (dir < 0 && nextY < b.targetY)) {
                y = b.targetY;
              } else {
                y = nextY;
              }
            } else {
              y = b.targetY;
            }

            return { ...b, x, y, vx, rotationDeg, settled };
          });
          return next;
        });
      }

      // Continue if there is at least one moving ball or any vertical movement pending
      const hasMoving = rollingRef.current.some((b) => !b.settled || Math.abs(b.y - b.targetY) > 0.5);
      if (hasMoving) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const layoutBalls = (balls: RollingBall[]) => {
    const sorted = [...balls].sort((a, b) => a.createdAt - b.createdAt);
    const total = sorted.length;

    const bottomStartIndex = Math.max(0, total - MAX_BOTTOM_ROW_COUNT);
    const topRow = sorted.slice(0, bottomStartIndex);
    const bottomRow = sorted.slice(bottomStartIndex);

    // Compute sequential X positions for each row independently
    const computeTargetsForRow = (row: RollingBall[], rowIndex: number) => {
      const targets: { id: number; targetX: number; targetY: number }[] = [];
      const firstX = LEFT_PADDING_PX + BALL_RADIUS_PX;
      const rowSpacingX = BALL_DIAMETER_PX + BALL_GAP_PX;
      const rowOffsetY = rowIndex === 0 ? 0 : BALL_DIAMETER_PX + 12; // place second row above
      row.forEach((ball, i) => {
        targets.push({ id: ball.id, targetX: firstX + i * rowSpacingX, targetY: rowOffsetY });
      });
      return targets;
    };

    const targetsTop = computeTargetsForRow(topRow, 1);
    const targetsBottom = computeTargetsForRow(bottomRow, 0);

    const idToTarget = new Map<number, { targetX: number; targetY: number }>();
    [...targetsTop, ...targetsBottom].forEach((t) => idToTarget.set(t.id, { targetX: t.targetX, targetY: t.targetY }));

    return balls.map((b) => {
      const t = idToTarget.get(b.id);
      if (!t) return b;
      return { ...b, targetX: t.targetX, targetY: t.targetY };
    });
  };

  const addRollingNumber = (number: number) => {
    const { from, to } = getGradientForNumber(number);

    setRollingNumbers((prev) => {
      const trayWidth = trayRef.current?.clientWidth ?? window.innerWidth;
      const startX = trayWidth + BALL_DIAMETER_PX; // start off-screen on the right

      const newBall: RollingBall = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        createdAt: Date.now(),
        number,
        x: startX,
        y: 0,
        targetX: startX, // will be updated by layoutBalls
        targetY: 0,
        vx: -INITIAL_SPEED_PX_S,
        rotationDeg: 0,
        settled: false,
        gradientFrom: from,
        gradientTo: to,
      };

      const positioned = layoutBalls([...prev, newBall]);
      return positioned;
    });

    // Ensure loop is running
    startLoopIfNeeded();
  };

  // Check card from backend
  const checkCard = async () => {
    if (!checkCardNumber) return;

    try {
      const res = await axios.post("http://localhost:5002/game/check-card", {
        cardId: checkCardNumber,
        gameId: Number(gameId), // ensure number
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

  // Dynamic tray height (1 or 2 rows)
  const trayRows = rollingNumbers.length > MAX_BOTTOM_ROW_COUNT ? 2 : 1;
  const trayRowHeight = BALL_DIAMETER_PX + 28; // include gaps and shadow space
  const trayHeightPx = BOTTOM_OFFSET_PX + trayRows * trayRowHeight;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-700 to-teal-600 p-10 flex flex-col items-center gap-10 text-white select-none" style={{ paddingBottom: trayHeightPx + 32 }} >
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

      {/* Rolling Balls Tray */}
      <div
        ref={trayRef}
        className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 overflow-hidden border-t border-neutral-800 shadow-inner"
        style={{ height: `${trayHeightPx}px` }}
      >
        {rollingNumbers.map((ball) => (
          <div
            key={ball.id}
            className="absolute left-0"
            style={{
              bottom: BOTTOM_OFFSET_PX,
              transform: `translate(${ball.x - BALL_RADIUS_PX}px, ${ball.y}px)`,
            }}
          >
            {/* Ball with gradient and rotation */}
            <div
              className={`relative rounded-full flex items-center justify-center text-white font-bold select-none shadow-xl bg-gradient-to-br ${ball.gradientFrom} ${ball.gradientTo}`}
              style={{ width: BALL_DIAMETER_PX, height: BALL_DIAMETER_PX, transform: `rotate(${ball.rotationDeg}deg)` }}
            >
              <span className="drop-shadow-md text-xl">{ball.number}</span>
              {/* subtle specular highlight */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-white/10"
                style={{ maskImage: 'radial-gradient(circle at 30% 30%, white 20%, transparent 60%)' }}
              />
            </div>
            {/* Shadow under ball */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2"
              style={{ width: BALL_DIAMETER_PX * 0.9, height: 8, bottom: -6, background: 'rgba(0,0,0,0.45)', filter: 'blur(6px)', borderRadius: 9999 }}
            />
          </div>
        ))}

        {/* Counters */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-400">
          Drawn Numbers: {drawnNumbers.length}
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-yellow-400">
          Rolling: {rollingNumbers.filter(rn => !rn.settled).length}
        </div>
      </div>
    </div>
  );
};

export default DrawnNumbers;
