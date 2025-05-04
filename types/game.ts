export interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  allowsCustomAnswers?: boolean
  isOpinionQuestion?: boolean
}

export interface CustomAnswer {
  id: string
  text: string
  addedBy: string
}

export interface VoteCounts {
  [option: string]: number
}

export interface GameState {
  currentQuestion: Question | null
  customAnswers: CustomAnswer[]
  voteCounts: VoteCounts
  totalVotes: number
  isWaiting: boolean
  timeIsUp: boolean
  timerActive: boolean
  timerReset: number
}
