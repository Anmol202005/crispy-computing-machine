"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var Color;
(function (Color) {
    Color["WHITE"] = "white";
    Color["BLACK"] = "black";
})(Color || (Color = {}));
var Status;
(function (Status) {
    Status["ACTIVE"] = "active";
    Status["COMPLETED"] = "completed";
})(Status || (Status = {}));
var Result;
(function (Result) {
    Result["BLACK_WINS"] = "black_wins";
    Result["WHITE_WINS"] = "white_wins";
    Result["DRAW"] = "draw";
})(Result || (Result = {}));
const gameSchema = new mongoose_1.Schema({
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
    timeControl: {
        type: String,
        required: false,
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
gameSchema.index({ updatedAt: 1 }, {
    expireAfterSeconds: 86400, // 24 hours
    partialFilterExpression: {
        isGuestGame: true,
        status: Status.COMPLETED
    }
});
gameSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.Game = mongoose_1.default.model('Game', gameSchema);
