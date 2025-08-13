import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface CardSelectionProps {
  playedCards: number[];
  onSelectionChange: (selectedCards: number[]) => void;
}

const TOTAL_CARDS = 100;

const CardSelection: React.FC<CardSelectionProps> = ({ playedCards, onSelectionChange }) => {
  const [selectedCards, setSelectedCards] = useState<number[]>(playedCards);
  const [gameStatus, setGameStatus] = useState<"idle" | "started">("idle");
  const navigate = useNavigate();

  const toggleCard = (cardId: number) => {
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  useEffect(() => {
    onSelectionChange(selectedCards);
  }, [selectedCards, onSelectionChange]);

  const handleStart = async () => {
    try {
      const payload = {
        name: "Friday Night Bingo",
        createdBy: 1,
        cardIds: selectedCards
      };

      const res = await fetch("http://localhost:5002/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to start game");

      const data = await res.json();
      setGameStatus("started");

      // Assuming backend returns something like { id: 123, ... }
      if (data.id) {
        navigate(`/drawn-numbers/${data.id}`);
      } else {
        console.error("Game ID missing in response", data);
      }
    } catch (err) {
      console.error("Error starting game:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mt-1 flex justify-center gap-4 mb-2">
        <button
          onClick={handleStart}
          disabled={selectedCards.length === 0}
          className={`px-5 py-2 rounded-md font-bold ${
            gameStatus === "started"
              ? "bg-blue-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Start
        </button>
        <input type="text" placeholder="Amount" className="border p-2 rounded-md" />
      </div>

      <div className="grid grid-cols-10 gap-3">
        {[...Array(TOTAL_CARDS)].map((_, index) => {
          const cardNumber = index + 1;
          const isSelected = selectedCards.includes(cardNumber);

          return (
            <button
              key={cardNumber}
              onClick={() => toggleCard(cardNumber)}
              className={`w-full py-3 rounded-md font-semibold border
                ${
                  isSelected
                    ? "bg-green-500 text-white border-green-700"
                    : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                }
                transition-colors duration-200`}
              aria-pressed={isSelected}
            >
              {cardNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CardSelection;
