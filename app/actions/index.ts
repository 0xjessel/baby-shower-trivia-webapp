// Barrel file to re-export all actions for backward compatibility

// Auth actions
export { adminLogin, joinGame } from "./auth-actions"

// Game management actions
export {
  createGame,
  setActiveGame,
  deleteGame,
  resetGame,
  resetSingleGame,
  resetVotes,
} from "./game-actions"

// Question management actions
export {
  uploadQuestion,
  deleteQuestion,
  setActiveQuestion,
  nextQuestion,
  previousQuestion,
  showResults,
} from "./question-actions"

// Answer management actions
export {
  submitAnswer,
  addCustomAnswer,
  updateVoteCount,
} from "./answer-actions"

// Re-export the migration action
export { migrateToGameSystem } from "./migration"
