"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameSocketService = void 0;
const game_service_1 = require("../services/game.service");
const matchmaking_service_1 = require("../services/matchmaking.service");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = require("../models/user");
class GameSocketService {
    constructor() {
        this.gameRooms = new Map();
        this.playerSockets = new Map(); // userId -> socketId
    }
    setupSocket(io) {
        io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const guestId = socket.handshake.auth.guestId;
                if (guestId) {
                    socket.isGuest = true;
                    socket.guestId = guestId;
                    return next();
                }
                if (!token) {
                    return next(new Error('No token provided'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                const user = await user_1.User.findById(decoded.id);
                if (!user) {
                    return next(new Error('User not found'));
                }
                socket.user = {
                    id: user._id.toString(),
                    username: user.username
                };
                next();
            }
            catch (error) {
                next(new Error('Authentication failed'));
            }
        });
        io.on('connection', (socket) => {
            var _a, _b;
            console.log('User connected:', ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId);
            const userId = ((_b = socket.user) === null || _b === void 0 ? void 0 : _b.id) || socket.guestId;
            this.playerSockets.set(userId, socket.id);
            socket.on('join-game', async (gameId) => {
                try {
                    const gameState = await game_service_1.gameService.getGameState(gameId);
                    if (!gameState) {
                        socket.emit('error', { message: 'Game not found' });
                        return;
                    }
                    const game = gameState.game;
                    const isPlayer = game.whitePlayerId === userId || game.blackPlayerId === userId;
                    if (!isPlayer) {
                        socket.emit('error', { message: 'You are not a player in this game' });
                        return;
                    }
                    socket.join(gameId);
                    if (!this.gameRooms.has(gameId)) {
                        this.gameRooms.set(gameId, {
                            gameId,
                            players: new Map()
                        });
                    }
                    const room = this.gameRooms.get(gameId);
                    room.players.set(userId, socket.id);
                    socket.emit('game-state', gameState);
                    const playersConnected = Array.from(room.players.keys());
                    io.to(gameId).emit('players-connected', {
                        whiteConnected: playersConnected.includes(game.whitePlayerId || ''),
                        blackConnected: playersConnected.includes(game.blackPlayerId || ''),
                        spectatorCount: Math.max(0, room.players.size - 2)
                    });
                }
                catch (error) {
                    console.error('Error joining game:', error);
                    socket.emit('error', { message: 'Failed to join game' });
                }
            });
            socket.on('make-move', async (data) => {
                var _a, _b, _c, _d;
                try {
                    const result = await game_service_1.gameService.makeMove({
                        gameId: data.gameId,
                        userId,
                        move: data.move
                    });
                    if (!result.success) {
                        socket.emit('move-error', { message: result.error });
                        return;
                    }
                    io.to(data.gameId).emit('move-made', {
                        move: data.move,
                        gameState: result.gameState,
                        player: ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId
                    });
                    if ((_b = result.gameState) === null || _b === void 0 ? void 0 : _b.isGameOver) {
                        io.to(data.gameId).emit('game-over', {
                            result: (_c = result.game) === null || _c === void 0 ? void 0 : _c.result,
                            winner: (_d = result.game) === null || _d === void 0 ? void 0 : _d.winner
                        });
                    }
                }
                catch (error) {
                    console.error('Error making move:', error);
                    socket.emit('move-error', { message: 'Failed to make move' });
                }
            });
            socket.on('resign', async (gameId) => {
                var _a, _b;
                try {
                    const result = await game_service_1.gameService.resignGame(gameId, userId);
                    if (!result.success) {
                        socket.emit('error', { message: result.error });
                        return;
                    }
                    io.to(gameId).emit('game-resigned', {
                        resignedBy: ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId,
                        winner: (_b = result.game) === null || _b === void 0 ? void 0 : _b.winner
                    });
                }
                catch (error) {
                    console.error('Error resigning game:', error);
                    socket.emit('error', { message: 'Failed to resign game' });
                }
            });
            socket.on('chat-message', (data) => {
                var _a;
                const { gameId, message } = data;
                if (!message || message.trim().length === 0)
                    return;
                if (message.length > 200)
                    return; // Message length limit
                socket.to(gameId).emit('chat-message', {
                    player: ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId,
                    message: message.trim(),
                    timestamp: new Date()
                });
            });
            socket.on('matchmaking-found', (data) => {
                var _a;
                const opponentSocketId = this.playerSockets.get(data.opponent.userId);
                if (opponentSocketId) {
                    io.to(opponentSocketId).emit('matchmaking-found', {
                        gameId: data.gameId,
                        opponent: ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId
                    });
                }
            });
            socket.on('disconnect', () => {
                var _a;
                console.log('User disconnected:', ((_a = socket.user) === null || _a === void 0 ? void 0 : _a.username) || socket.guestId);
                this.playerSockets.delete(userId);
                // Update game rooms
                for (const [gameId, room] of this.gameRooms) {
                    if (room.players.has(userId)) {
                        room.players.delete(userId);
                        // Notify other players in the room
                        const game = room.players.size > 0 ? room : null;
                        if (game) {
                            const gameState = game_service_1.gameService.getGameState(gameId);
                            gameState.then(state => {
                                if (state) {
                                    const playersConnected = Array.from(room.players.keys());
                                    io.to(gameId).emit('players-connected', {
                                        whiteConnected: playersConnected.includes(state.game.whitePlayerId || ''),
                                        blackConnected: playersConnected.includes(state.game.blackPlayerId || ''),
                                        spectatorCount: Math.max(0, room.players.size - 2)
                                    });
                                }
                            });
                        }
                        // Clean up empty rooms
                        if (room.players.size === 0) {
                            this.gameRooms.delete(gameId);
                        }
                    }
                }
                // Remove from matchmaking if waiting
                matchmaking_service_1.matchmakingService.leaveMatchmaking(userId);
            });
        });
    }
    getConnectedPlayers() {
        return this.playerSockets.size;
    }
    getActiveGames() {
        return this.gameRooms.size;
    }
}
exports.gameSocketService = new GameSocketService();
