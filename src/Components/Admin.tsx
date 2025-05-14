import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Question {
  id: number;
  question: string;
  options: string[];
  correct_answer: number;
  time_limit: number | null;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    time_limit: null as number | null
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/questions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      setError('Failed to fetch questions');
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion({ ...newQuestion, options: newOptions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newQuestion),
      });

      if (!response.ok) {
        throw new Error('Failed to add question');
      }

      setNewQuestion({
        question: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        time_limit: null
      });
      fetchQuestions();
    } catch (err) {
      setError('Failed to add question');
    }
  };

  if (!user?.isAdmin) {
    return <div>Access denied. Admin only area.</div>;
  }

  return (
    <div className="admin-container">
      <h2>Admin Dashboard</h2>
      <div className="add-question-form">
        <h3>Add New Question</h3>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="question">Question:</label>
            <input
              type="text"
              id="question"
              value={newQuestion.question}
              onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
              required
            />
          </div>
          {newQuestion.options.map((option, index) => (
            <div key={index} className="form-group">
              <label htmlFor={`option${index}`}>Option {index + 1}:</label>
              <input
                type="text"
                id={`option${index}`}
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                required
              />
            </div>
          ))}
          <div className="form-group">
            <label htmlFor="correctAnswer">Correct Answer (1-4):</label>
            <input
              type="number"
              id="correctAnswer"
              min="1"
              max="4"
              value={newQuestion.correct_answer + 1}
              onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: Number(e.target.value) - 1 })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="timeLimit">Time Limit (seconds, optional):</label>
            <input
              type="number"
              id="timeLimit"
              min="0"
              value={newQuestion.time_limit || ''}
              onChange={(e) => setNewQuestion({ 
                ...newQuestion, 
                time_limit: e.target.value ? Number(e.target.value) : null 
              })}
              placeholder="Leave empty for no limit"
            />
          </div>
          <button type="submit" className="admin-button">
            Add Question
          </button>
        </form>
      </div>

      <div className="questions-list">
        <h3>Existing Questions</h3>
        {questions.map((q) => (
          <div key={q.id} className="question-item">
            <h4>{q.question}</h4>
            <ul>
              {q.options.map((option, index) => (
                <li key={index} className={index === q.correct_answer ? 'correct-answer' : ''}>
                  {option}
                </li>
              ))}
            </ul>
            <p className="time-limit">
              Time Limit: {q.time_limit ? `${q.time_limit} seconds` : 'No limit'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin; 