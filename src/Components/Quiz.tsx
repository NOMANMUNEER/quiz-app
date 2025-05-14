import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Question from './Question';
import Results from './Results';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_answer: number; // Match the database column name
  time_limit: number | null;
}

interface QuizState {
  attempted: boolean[];
  skipped: boolean[];
}

const Quiz: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({
    attempted: [],
    skipped: []
  });
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('Fetching questions with token...');
        const response = await fetch('http://localhost:5000/api/questions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }

        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data = await response.json();
        
        // Validate question format
        const validQuestions = data.filter(question => {
          if (!Array.isArray(question.options)) {
            console.error('Invalid options format for question:', question);
            return false;
          }
          return true;
        });

        if (validQuestions.length === 0) {
          throw new Error('No valid questions found');
        }

        console.log('Questions fetched:', validQuestions.length);
        setQuestions(validQuestions);
      } catch (err) {
        console.error('Error fetching questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        if (err instanceof Error && err.message.includes('authentication')) {
          // Clear invalid token
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchQuestions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (questions.length > 0) {
      setQuizState({
        attempted: new Array(questions.length).fill(false),
        skipped: new Array(questions.length).fill(false)
      });
      setUserAnswers(new Array(questions.length).fill(null));
      
      // Set initial time limit if exists
      const firstQuestionTimeLimit = questions[0].time_limit;
      if (firstQuestionTimeLimit) {
        setTimeLeft(firstQuestionTimeLimit);
      }
    }
  }, [questions]);

  useEffect(() => {
    if (timeLeft === null || showResults) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, showResults]);

  const handleTimeUp = useCallback(() => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const attemptedCount = quizState.attempted.filter(Boolean).length;
    const skippedCount = quizState.skipped.filter(Boolean).length;

    submitScore(score, attemptedCount, skippedCount, timeTaken);
    setShowResults(true);
  }, [score, quizState, startTime]);

  const submitScore = async (finalScore: number, attempted: number, skipped: number, timeTaken: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('http://localhost:5000/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score: finalScore,
          totalQuestions: questions.length,
          attemptedQuestions: attempted,
          skippedQuestions: skipped,
          timeTaken: timeTaken
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save score');
      }
    } catch (err) {
      console.error('Failed to save score:', err);
      setError('Failed to save score. Your progress may not be recorded.');
    }
  };

  const handleAnswerSelected = async (selectedAnswer: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;

    if (isCorrect) {
      setScore(prevScore => prevScore + 1);
    }

    // Update quiz state
    setQuizState(prev => ({
      ...prev,
      attempted: prev.attempted.map((val, idx) => 
        idx === currentQuestionIndex ? true : val
      ),
      skipped: prev.skipped.map((val, idx) => 
        idx === currentQuestionIndex ? false : val
      )
    }));

    // Update user answers
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = selectedAnswer;
      return newAnswers;
    });

    // Move to next question if not at the end
    if (currentQuestionIndex + 1 < questions.length) {
      handleNextQuestion();
    } else {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const attemptedCount = quizState.attempted.filter(Boolean).length + 1;
      const skippedCount = quizState.skipped.filter(Boolean).length;
      
      await submitScore(score + (isCorrect ? 1 : 0), attemptedCount, skippedCount, timeTaken);
      setShowResults(true);
    }
  };

  const handleSkip = () => {
    setQuizState(prev => ({
      ...prev,
      skipped: prev.skipped.map((val, idx) => 
        idx === currentQuestionIndex ? true : val
      )
    }));
    handleNextQuestion();
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      // Update timer for next question if it has a time limit
      if (questions[nextIndex].time_limit) {
        setTimeLeft(questions[nextIndex].time_limit);
      }
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Update timer for previous question if it has a time limit
      if (questions[currentQuestionIndex - 1].time_limit) {
        setTimeLeft(questions[currentQuestionIndex - 1].time_limit);
      }
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    // Update timer for jumped question if it has a time limit
    if (questions[index].time_limit) {
      setTimeLeft(questions[index].time_limit);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResults(false);
    setUserAnswers(new Array(questions.length).fill(null));
    setQuizState({
      attempted: new Array(questions.length).fill(false),
      skipped: new Array(questions.length).fill(false)
    });
    setError(null);
    if (questions[0].time_limit) {
      setTimeLeft(questions[0].time_limit);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="quiz-container">
        <div className="message-container">
          <p>Please log in to take the quiz.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="quiz-container">
        <div className="loading-container">
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-container">
        <div className="error-container">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="message-container">
          <p>No questions available. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <h1>Quiz App</h1>
      <div className="user-info">
        Welcome, {user?.username}!
      </div>
      {!showResults ? (
        <>
          <div className="quiz-navigation">
            <button 
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </button>
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => handleJumpToQuestion(index)}
                className={`question-nav-button ${
                  index === currentQuestionIndex ? 'active' : ''
                } ${
                  quizState.attempted[index] ? 'attempted' : ''
                } ${
                  quizState.skipped[index] ? 'skipped' : ''
                }`}
              >
                {index + 1}
              </button>
            ))}
            <button 
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next
            </button>
          </div>
          {timeLeft !== null && (
            <div className="timer">
              Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
          <Question
            question={questions[currentQuestionIndex]}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={questions.length}
            onAnswerSelected={handleAnswerSelected}
            onSkip={handleSkip}
            userAnswer={userAnswers[currentQuestionIndex]}
          />
          <button 
            onClick={handleSkip}
            className="skip-button"
          >
            Skip Question
          </button>
        </>
      ) : (
        <Results
          score={score}
          totalQuestions={questions.length}
          attemptedQuestions={quizState.attempted.filter(Boolean).length}
          skippedQuestions={quizState.skipped.filter(Boolean).length}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};

export default Quiz; 