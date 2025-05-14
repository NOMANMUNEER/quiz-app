import React from 'react';

interface ResultsProps {
  score: number;
  totalQuestions: number;
  attemptedQuestions: number;
  skippedQuestions: number;
  onRestart: () => void;
}

const Results: React.FC<ResultsProps> = ({ 
  score, 
  totalQuestions, 
  attemptedQuestions,
  skippedQuestions,
  onRestart 
}) => {
  const percentage = (score / totalQuestions) * 100;

  return (
    <div className="results-container">
      <h2>Quiz Complete!</h2>
      <div className="score-container">
        <p>Your Score: {score} out of {totalQuestions}</p>
        <p className="percentage">Percentage: {percentage.toFixed(1)}%</p>
        <p className="stats">
          Questions Attempted: {attemptedQuestions} / {totalQuestions}
        </p>
        <p className="stats">
          Questions Skipped: {skippedQuestions}
        </p>
        {percentage === 100 && (
          <p className="perfect-score">Perfect Score! 🎉</p>
        )}
      </div>
      <button className="restart-button" onClick={onRestart}>
        Try Again
      </button>
    </div>
  );
};

export default Results; 