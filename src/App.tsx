// App.js
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";

import Loader from "./common/Loader";
import CardSelection from "./pages/CardSelection";
import DrawnNumbers from "./pages/DrawnNumbers";

const socket = io("https://bingonestjsapp.onrender.com"); // adjust if backend is on different host

function DrawnNumbersWrapper() {
  const { id } = useParams();
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);

  useEffect(() => {
    if (!id) return;

    // Initial fetch for already drawn numbers
    axios.get(`https://bingonestjsapp.onrender.com/game/${id}/numbers`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setDrawnNumbers(res.data);
        }
      })
      .catch(console.error);

    // Listen for live drawn numbers from socket.io
    socket.on("numberDrawn", (number) => {
      setDrawnNumbers(prev => [...prev, number]);
    });

    return () => {
      socket.off("numberDrawn");
    };
  }, [id]);

  return <DrawnNumbers drawnNumbers={drawnNumbers} gameId={id} />;
}

function App() {
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  const handleStartGame = async (selectedCards: number[], gameConfig: {
    gameType?: 'STANDARD' | 'ADVANCED';
    patternsRequired?: number;
    amount?: number;
    gameName?: string;
  }) => {
    try {
      const payload = {
        name: gameConfig.gameName || "Friday Night Bingo",
        createdBy: 1,
        cardIds: selectedCards,
        gameType: gameConfig.gameType || 'STANDARD',
        patternsRequired: gameConfig.patternsRequired || 1,
        amount: gameConfig.amount,
      };
      const res = await axios.post("https://bingonestjsapp.onrender.com/game", payload);
      const gameId = res.data?.id || res.data?._id; // Adjust depending on backend response
      if (gameId) {
        // Don't start the game here - let the Start button in DrawnNumbers do that
        navigate(`/drawn-numbers/${gameId}`);
      }
    } catch (err) {
      console.error("Error starting game", err);
    }
  };

  return loading ? (
    <Loader />
  ) : (
    <Routes>
      <Route
        path="/"
        element={
          <CardSelection
            playedCards={[]}
            onSelectionChange={() => {}}
            onStart={(cards, gameConfig) => handleStartGame(cards, gameConfig)}
          />
        }
      />
      <Route path="/drawn-numbers/:id" element={<DrawnNumbersWrapper />} />
    </Routes>
  );
}

export default App;
