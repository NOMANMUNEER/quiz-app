export interface Question {
  id: number;
  question: string;
  options: string[];
  correct_answer: number;
}

export interface QuizState {
  currentQuestionIndex: number;
  score: number;
  showResults: boolean;
  questions: Question[];
  userAnswers: number[];
} 