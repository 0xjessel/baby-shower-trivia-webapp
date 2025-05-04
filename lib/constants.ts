// Game events
export const EVENTS = {
  NEW_QUESTION: "new-question",
  QUESTION_UPDATE: "question-update",
  ANSWER_SUBMITTED: "answer-submitted",
  TIMER_START: "timer-start",
  TIMER_STOP: "timer-stop",
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
  CUSTOM_ANSWER_ADDED: "custom-answer-added",
  VOTE_COUNTS_UPDATED: "vote-counts-updated",
}

// Channels
export const CHANNELS = {
  GAME: "game-channel",
  ADMIN: "admin-channel",
}

// Local storage keys
export const STORAGE_KEYS = {
  PLAYER_NAME: "playerName",
  ADMIN_TOKEN: "adminToken",
}
