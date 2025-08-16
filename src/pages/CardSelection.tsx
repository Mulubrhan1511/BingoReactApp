import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface CardSelectionProps {
  playedCards: number[];
  onSelectionChange: (selectedCards: number[]) => void;
  onStart: (selectedCards: number[], gameConfig: {
    gameType: 'STANDARD' | 'ADVANCED';
    patternsRequired: number;
    amount?: number;
    gameName: string;
  }) => void;
}

const TOTAL_CARDS = 100;

const CardSelection: React.FC<CardSelectionProps> = ({ playedCards, onSelectionChange, onStart }) => {
  const [selectedCards, setSelectedCards] = useState<number[]>(playedCards);
  const [gameStatus, setGameStatus] = useState<"idle" | "started">("idle");
  const [gameName, setGameName] = useState<string>("Friday Night Bingo");
  const [gameType, setGameType] = useState<'STANDARD' | 'ADVANCED'>('STANDARD');
  const [patternsRequired, setPatternsRequired] = useState<number>(1);
  const [amount, setAmount] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedHelpGameType, setSelectedHelpGameType] = useState<'STANDARD' | 'ADVANCED'>('STANDARD');
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
      const gameConfig = {
        gameType,
        patternsRequired,
        amount: amount ? parseFloat(amount) : undefined,
        gameName,
      };

      // Create the game and navigate to DrawnNumbers
      onStart(selectedCards, gameConfig);
      setGameStatus("started");
    } catch (err) {
      console.error("Error starting game:", err);
    }
  };

  const renderPatternExample = (pattern: string, description: string, cells: number[][]) => {
    return (
      <div className="mb-4 p-3 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-2">{pattern}</h4>
        <p className="text-sm text-gray-600 mb-3">{description}</p>
        <div className="grid grid-cols-5 gap-1 max-w-xs">
          {cells.map((row, rowIndex) => 
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`w-8 h-8 border border-gray-300 rounded flex items-center justify-center text-xs font-medium ${
                  cell === 1 ? 'bg-blue-500 text-white' : 
                  cell === 2 ? 'bg-green-500 text-white' : 
                  'bg-gray-100'
                }`}
              >
                {cell === 0 ? '' : cell === 1 ? 'X' : 'O'}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const getStandardPatterns = () => [
    {
      name: "Straight Line (Row)",
      description: "Complete any horizontal row",
      cells: [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ]
    },
    {
      name: "Straight Line (Column)",
      description: "Complete any vertical column",
      cells: [
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0]
      ]
    },
    {
      name: "Straight Line (Diagonal)",
      description: "Complete either diagonal",
      cells: [
        [1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 1]
      ]
    },
    {
      name: "Four Corners",
      description: "Mark all four corner cells",
      cells: [
        [1, 0, 0, 0, 1],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 1]
      ]
    }
  ];

  const getAdvancedPatterns = () => [
    ...getStandardPatterns(),
    {
      name: "Custom Pattern 1",
      description: "N2, Free(N3), N4, I3, G3",
      cells: [
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 1, 2, 1, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0]
      ]
    },
    {
      name: "Custom Pattern 2",
      description: "I2, I4, Free(N3), G2, G4",
      cells: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 2, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0]
      ]
    }
  ];

  return (
    <div className="w-full p-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Create New Bingo Game</h1>
          <button
            onClick={() => setShowHelpModal(true)}
            className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-lg font-bold hover:bg-blue-600 transition-colors"
            title="Game Rules & Patterns Help"
          >
            ?
          </button>
        </div>
        
        {/* All Form Fields and Start Button in One Line */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Game Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter game name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Game Type</label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as 'STANDARD' | 'ADVANCED')}
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="STANDARD">Standard</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter amount"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patterns Required</label>
            <input
              type="number"
              min="1"
              max="10"
              value={patternsRequired}
              onChange={(e) => setPatternsRequired(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <button
              onClick={handleStart}
              disabled={selectedCards.length < 2}
              className={`w-full px-6 py-2 rounded-md font-bold text-lg ${
                gameStatus === "started"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Create Game
            </button>
            {selectedCards.length < 2 && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Select at least 2 cards to create game
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Full Width Number Grid - No Side Padding */}
      <div className="w-full grid grid-cols-10 gap-3">
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

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Game Rules & Winning Patterns</h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Game Type Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Select Game Type to View Patterns:</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedHelpGameType('STANDARD')}
                    className={`px-4 py-2 rounded-md font-medium ${
                      selectedHelpGameType === 'STANDARD'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Standard Game
                  </button>
                  <button
                    onClick={() => setSelectedHelpGameType('ADVANCED')}
                    className={`px-4 py-2 rounded-md font-medium ${
                      selectedHelpGameType === 'ADVANCED'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Advanced Game
                  </button>
                </div>
              </div>

              {/* Pattern Examples */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedHelpGameType === 'STANDARD' ? 'Standard' : 'Advanced'} Game Winning Patterns:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(selectedHelpGameType === 'STANDARD' ? getStandardPatterns() : getAdvancedPatterns()).map((pattern, index) => (
                    <div key={index}>
                      {renderPatternExample(pattern.name, pattern.description, pattern.cells)}
                    </div>
                  ))}
                </div>
              </div>

              {/* How to Win */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">How to Win:</h3>
                <div className="text-sm text-blue-700">
                  <p>• <strong>Patterns Required:</strong> Set how many patterns must be completed to win</p>
                  <p>• <strong>Examples:</strong></p>
                  <ul className="ml-4 mt-1">
                    <li>• 1 pattern: Complete any single winning pattern</li>
                    <li>• 2 patterns: Complete any two different patterns (e.g., 1 straight line + 1 four corners)</li>
                    <li>• 3+ patterns: Complete the specified number of patterns</li>
                  </ul>
                  <p className="mt-2"><strong>Note:</strong> Multiple instances of the same pattern type count separately (e.g., 2 different straight lines = 2 patterns)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSelection;
