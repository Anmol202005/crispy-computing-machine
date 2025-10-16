"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingService = void 0;
const game_models_1 = require("../models/game.models");
class MatchmakingService {
    constructor() {
        this.waitingPlayers = new Map();
        this.ELO_RANGE_BASE = 100;
        this.ELO_RANGE_INCREMENT = 50;
        this.MAX_WAIT_TIME = 30000; // 30 seconds
        this.io = null;
    }
    setSocketServer(io) {
        this.io = io;
    }
    async joinMatchmaking(request) {
        const opponent = this.findOpponent(request);
        if (opponent) {
            this.waitingPlayers.delete(opponent.userId);
            const game = await this.createGame(request, opponent);
            const gameId = game._id.toString();
            // Notify both players via WebSocket
            this.notifyMatchFound(request, opponent, gameId);
            return { gameId };
        }
        this.waitingPlayers.set(request.userId, Object.assign(Object.assign({}, request), { timestamp: Date.now() }));
        this.scheduleTimeoutCleanup(request.userId);
        return { isWaiting: true };
    }
    leaveMatchmaking(userId) {
        this.waitingPlayers.delete(userId);
    }
    findOpponent(request) {
        let bestMatch = null;
        let bestRatingDiff = Infinity;
        for (const [waitingUserId, waitingPlayer] of this.waitingPlayers) {
            if (waitingUserId === request.userId)
                continue;
            const ratingDiff = Math.abs(request.elo - waitingPlayer.elo);
            const waitTime = Date.now() - waitingPlayer.timestamp;
            const maxAllowedDiff = this.calculateMaxEloRange(waitTime);
            if (ratingDiff <= maxAllowedDiff && ratingDiff < bestRatingDiff) {
                bestMatch = waitingPlayer;
                bestRatingDiff = ratingDiff;
            }
        }
        return bestMatch;
    }
    calculateMaxEloRange(waitTime) {
        const timeSegments = Math.floor(waitTime / 5000); // Every 5 seconds
        return this.ELO_RANGE_BASE + (timeSegments * this.ELO_RANGE_INCREMENT);
    }
    async createGame(player1, player2) {
        const isPlayer1White = Math.random() < 0.5;
        const gameData = {
            whitePlayerId: isPlayer1White ? player1.userId : player2.userId,
            blackPlayerId: isPlayer1White ? player2.userId : player1.userId,
            whitePlayerName: isPlayer1White ?
                (player1.isGuest ? player1.guestName : player1.username) :
                (player2.isGuest ? player2.guestName : player2.username),
            blackPlayerName: isPlayer1White ?
                (player2.isGuest ? player2.guestName : player2.username) :
                (player1.isGuest ? player1.guestName : player1.username),
            status: 'active',
            isGuestGame: player1.isGuest || player2.isGuest
        };
        const game = new game_models_1.Game(gameData);
        await game.save();
        return game;
    }
    scheduleTimeoutCleanup(userId) {
        setTimeout(() => {
            const player = this.waitingPlayers.get(userId);
            if (player && Date.now() - player.timestamp >= this.MAX_WAIT_TIME) {
                this.waitingPlayers.delete(userId);
            }
        }, this.MAX_WAIT_TIME);
    }
    getWaitingPlayersCount() {
        return this.waitingPlayers.size;
    }
    isPlayerWaiting(userId) {
        return this.waitingPlayers.has(userId);
    }
    notifyMatchFound(player1, player2, gameId) {
        if (!this.io)
            return;
        const matchData = {
            gameId,
            opponent: null
        };
        // Notify player1 about the match with player2 as opponent
        const player1Data = Object.assign(Object.assign({}, matchData), { opponent: {
                userId: player2.userId,
                username: player2.isGuest ? player2.guestName : player2.username,
                isGuest: player2.isGuest || false
            } });
        // Notify player2 about the match with player1 as opponent
        const player2Data = Object.assign(Object.assign({}, matchData), { opponent: {
                userId: player1.userId,
                username: player1.isGuest ? player1.guestName : player1.username,
                isGuest: player1.isGuest || false
            } });
        // Broadcast to all connected clients (they'll filter by user)
        this.io.emit('matchmaking-found', Object.assign({ targetUserId: player1.userId }, player1Data));
        this.io.emit('matchmaking-found', Object.assign({ targetUserId: player2.userId }, player2Data));
        console.log(`Match found: ${player1.isGuest ? player1.guestName : player1.username} vs ${player2.isGuest ? player2.guestName : player2.username} - Game ID: ${gameId}`);
    }
}
exports.matchmakingService = new MatchmakingService();
