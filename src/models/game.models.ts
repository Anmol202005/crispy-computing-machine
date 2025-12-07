import mongoose, { Document, Schema } from "mongoose";

export enum Color {
  WHITE = 'white',
  BLACK = 'black',
}

export enum Status {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum Result {
  BLACK_WINS = 'black_wins',
  WHITE_WINS = 'white_wins',
  DRAW = 'draw',
}

export interface IGame extends Document {
  id: string;
  _id: mongoose.Types.ObjectId;
  whitePlayerId: string,
  blackPlayerId: string,
  whitePlayerName: string,
  blackPlayerName: string,
  whitePlayerAvatar: string,
  blackPlayerAvatar: string,
  whitePlayerElo?: number | null, // ELO at match start
  blackPlayerElo?: number | null, // ELO at match start
  currentTurn: Color,
  status: Status,
  fen: string,
  moves: string[],
  result?: Result | null;
  winner?: string | null;
  createdAt: Date,
  updatedAt:Date,
  isGuestGame: boolean,
  timeControl: string
  initialTimeSeconds?: number;
  incrementSeconds?: number;
  whiteTimeRemaining?: number;
  blackTimeRemaining?: number;
  lastMoveAt?: Date;
  clockStarted?: boolean;
}
const gameSchema = new Schema<IGame>({

  whitePlayerId: {
    type: String,
    required: false,
    index: true,
  },
  blackPlayerId: {
    type: String,
    required: false,
    index: true,
  },
  whitePlayerName: {
    type: String,
    required: true,
  },
  blackPlayerName: {
    type: String,
    required: false,
  },
  whitePlayerAvatar: {
    type: String,
    default: 'avatar1.svg',
  },
  blackPlayerAvatar: {
    type: String,
    default: 'avatar1.svg',
  },
  whitePlayerElo: {
    type: Number,
    default: null,
  },
  blackPlayerElo: {
    type: Number,
    default: null,
  },
  currentTurn: {
    type: String,
    enum: Object.values(Color),
    default: Color.WHITE,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(Status),
    default: Status.ACTIVE,
    required: true,
  },
  fen: {
    type: String,
    required: true,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  moves: {
    type: [String],
    default: [],
  },
  result: {
    type: String,
    enum: Object.values(Result),
    default: null,
  },
  winner: {
    type: String,
    default: null,
  },
  isGuestGame: {
    type: Boolean,
    default: false,
  },
  timeControl: {
    type: String,
    required: false,
  },
  initialTimeSeconds: {
    type: Number,
    default: 600,
  },
  incrementSeconds: {
    type: Number,
    default: 0,
  },
  whiteTimeRemaining: {
    type: Number,
    default: 600,
  },
  blackTimeRemaining: {
    type: Number,
    default: 600,
  },
  lastMoveAt: {
    type: Date,
    default: null,
  },
  clockStarted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// TTL index - Auto-delete guest games after 24 hours of completion
gameSchema.index(
  { updatedAt: 1 }, 
  { 
    expireAfterSeconds: 86400,  // 24 hours
    partialFilterExpression: { 
      isGuestGame: true, 
      status: Status.COMPLETED 
    } 
  }
);


gameSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Game = mongoose.model<IGame>('Game', gameSchema);

