import mongoose, { Document, Schema } from "mongoose";

enum Color{
    WHITE='white',
    BLACK='black',
}

enum Status{
    ACTIVE='active',
    COMPLETED='completed'
}

enum Result{
    BLACK_WINS = 'black_wins',
    WHITE_WINS = 'white_wins',
    DRAW = 'draw'
}

export interface IGame extends Document{
    whitePlayerId: string,
    blackPlayerId: string,
    whitePlayerName: string,
    blackPlayerName: string,
    currentTurn: Color,
    status: Status,
    fen: string,
    moves: string[],
    result:Result,
    winner: string,
    createdAt: Date,
    updatedAt:Date,
    isGuestGame: boolean
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
  currentTurn: {
    type: String,
    enum: Object.values(Color),
    default: Color.WHITE,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(Status),
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
    required: false,
  },
  winner: {
    type: String,
    required: false,
  },
  isGuestGame: {
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

