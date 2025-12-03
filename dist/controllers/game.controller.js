"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchmakingStatus = exports.getPlayerGames = exports.resignGame = exports.makeMove = exports.getGame = exports.leaveMatchmaking = exports.joinGuestMatchmaking = exports.registerGuest = exports.joinMatchmaking = void 0;
const matchmaking_service_1 = require("../services/matchmaking.service");
const game_service_1 = require("../services/game.service");
const user_1 = require("../models/user");
const joinMatchmaking = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { timeControl } = req.body;
        if (!timeControl) {
            res.status(400).json({ message: 'Time control is required' });
            return;
        }
        const user = await user_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const matchmakingRequest = {
            userId,
            username: user.username,
            elo: user.elo,
            avatar: user.avatar,
            timeControl
        };
        const result = await matchmaking_service_1.matchmakingService.joinMatchmaking(matchmakingRequest);
        res.json(result);
    }
    catch (error) {
        console.error('Error joining matchmaking:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.joinMatchmaking = joinMatchmaking;
// Step 1: Register guest and get ID (no matchmaking yet)
const registerGuest = async (req, res) => {
    try {
        const { guestName, avatar } = req.body;
        if (!guestName || guestName.trim().length < 2) {
            res.status(400).json({ message: 'Guest name must be at least 2 characters' });
            return;
        }
        // Generate unique guest ID
        const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Return guest ID without joining matchmaking
        res.json({ guestId, avatar: avatar || 'avatar1.svg' });
    }
    catch (error) {
        console.error('Error registering guest:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.registerGuest = registerGuest;
// Step 2: Join matchmaking with verified socket
const joinGuestMatchmaking = async (req, res) => {
    try {
        const { guestId, socketId, timeControl } = req.body;
        if (!guestId || !guestId.startsWith('guest_')) {
            res.status(400).json({ message: 'Valid guest ID is required' });
            return;
        }
        if (!socketId) {
            res.status(400).json({ message: 'Socket ID is required' });
            return;
        }
        if (!timeControl) {
            res.status(400).json({ message: 'Time control is required' });
            return;
        }
        // Verify socket exists - import io from socket service
        const { gameSocketService } = require('../sockets/index');
        const socketExists = gameSocketService.getPlayerSocketId(guestId) === socketId;
        if (!socketExists) {
            res.status(400).json({
                message: 'Socket not connected. Please ensure you are connected to the game server.'
            });
            return;
        }
        // Extract guest name from guestId or require it in the request
        const { guestName, avatar } = req.body;
        if (!guestName || guestName.trim().length < 2) {
            res.status(400).json({ message: 'Guest name must be at least 2 characters' });
            return;
        }
        const matchmakingRequest = {
            userId: guestId,
            username: guestName.trim(),
            elo: 300, // Default rating for guests (matches auth users)
            avatar: avatar || 'avatar1.svg',
            isGuest: true,
            guestName: guestName.trim(),
            timeControl
        };
        const result = await matchmaking_service_1.matchmakingService.joinMatchmaking(matchmakingRequest);
        res.json(result);
    }
    catch (error) {
        console.error('Error joining guest matchmaking:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.joinGuestMatchmaking = joinGuestMatchmaking;
const leaveMatchmaking = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        matchmaking_service_1.matchmakingService.leaveMatchmaking(userId);
        res.json({ message: 'Left matchmaking successfully' });
    }
    catch (error) {
        console.error('Error leaving matchmaking:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.leaveMatchmaking = leaveMatchmaking;
const getGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const gameState = await game_service_1.gameService.getGameState(gameId);
        if (!gameState) {
            res.status(404).json({ message: 'Game not found' });
            return;
        }
        res.json(gameState);
    }
    catch (error) {
        console.error('Error getting game:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getGame = getGame;
const makeMove = async (req, res) => {
    var _a;
    try {
        const { gameId } = req.params;
        const { move } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        if (!move || !move.from || !move.to) {
            res.status(400).json({ message: 'Invalid move format' });
            return;
        }
        const result = await game_service_1.gameService.makeMove({ gameId, userId, move });
        if (!result.success) {
            res.status(400).json({ message: result.error });
            return;
        }
        res.json(result.gameState);
    }
    catch (error) {
        console.error('Error making move:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.makeMove = makeMove;
const resignGame = async (req, res) => {
    var _a, _b;
    try {
        const { gameId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const guestId = (_b = req.body) === null || _b === void 0 ? void 0 : _b.guestId; // Support guest resignations
        // Support both authenticated users and guests
        const playerId = userId || guestId;
        if (!playerId) {
            res.status(401).json({ message: 'Unauthorized - no user ID or guest ID provided' });
            return;
        }
        const result = await game_service_1.gameService.resignGame(gameId, playerId);
        if (!result.success) {
            res.status(400).json({ message: result.error });
            return;
        }
        res.json({ message: 'Game resigned successfully', game: result.game });
    }
    catch (error) {
        console.error('Error resigning game:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.resignGame = resignGame;
const getPlayerGames = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { status } = req.query;
        const games = await game_service_1.gameService.getPlayerGames(userId, status);
        res.json({ games });
    }
    catch (error) {
        console.error('Error getting player games:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getPlayerGames = getPlayerGames;
const getMatchmakingStatus = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const isWaiting = matchmaking_service_1.matchmakingService.isPlayerWaiting(userId);
        const waitingCount = matchmaking_service_1.matchmakingService.getWaitingPlayersCount();
        res.json({ isWaiting, waitingCount });
    }
    catch (error) {
        console.error('Error getting matchmaking status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getMatchmakingStatus = getMatchmakingStatus;
