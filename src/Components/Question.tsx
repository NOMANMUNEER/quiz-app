import React from 'react';

interface QuestionType {
  id: number;
  question: string;
  options: string[];
  correct_answer: number;
  time_limit: number | null;
}

interface QuestionProps {
  question: QuestionType;
  currentQuestionIndex: number;
  totalQuestions: number;
  onAnswerSelected: (selectedOption: number) => void;
  onSkip: () => void;
  userAnswer: number | null;
}

const Question: React.FC<QuestionProps> = ({
  question,
  currentQuestionIndex,
  totalQuestions,
  onAnswerSelected,
  onSkip,
  userAnswer
}) => {
  // Ensure options is an array
  const options = Array.isArray(question.options) ? question.options : [];

  if (options.length === 0) {
    return (
      <div className="question-container">
        <div className="error-message">
          Error: Invalid question format
        </div>
      </div>
    );
  }

  return (
    <div className="question-container">
      <div className="question-header">
        <span className="question-number">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </span>
      </div>
      <h2 className="question-text">{question.question}</h2>
      <div className="options-container">
        {options.map((option, index) => (
          <button
            key={index}
            className={`option-button ${userAnswer === index ? 'selected' : ''}`}
            onClick={() => onAnswerSelected(index)}
            disabled={userAnswer !== null}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Question; 