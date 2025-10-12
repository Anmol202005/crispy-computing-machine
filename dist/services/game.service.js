"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameService = void 0;
const chess_js_1 = require("chess.js");
const game_models_1 = require("../models/game.models");
const user_1 = require("../models/user");
class GameService {
    async getGame(gameId) {
        return await game_models_1.Game.findById(gameId);
    }
    async getGameState(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return null;
        const chess = new chess_js_1.Chess(game.fen);
        return {
            game,
            legalMoves: chess.moves(),
            isCheck: chess.inCheck(),
            isCheckmate: chess.isCheckmate(),
            isDraw: chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition(),
            isGameOver: chess.isGameOver()
        };
    }
    async makeMove(moveRequest) {
        try {
            const game = await this.getGame(moveRequest.gameId);
            if (!game) {
                return { success: false, error: 'Game not found' };
            }
            if (game.status !== 'active') {
                return { success: false, error: 'Game is not active' };
            }
            const isWhitePlayer = game.whitePlayerId === moveRequest.userId;
            const isBlackPlayer = game.blackPlayerId === moveRequest.userId;
            if (!isWhitePlayer && !isBlackPlayer) {
                return { success: false, error: 'You are not a player in this game' };
            }
            const chess = new chess_js_1.Chess(game.fen);
            const currentTurn = chess.turn();
            const isPlayersTurn = (currentTurn === 'w' && isWhitePlayer) || (currentTurn === 'b' && isBlackPlayer);
            if (!isPlayersTurn) {
                return { success: false, error: 'It is not your turn' };
            }
            const move = chess.move(moveRequest.move);
            if (!move) {
                return { success: false, error: 'Invalid move' };
            }
            game.fen = chess.fen();
            game.moves.push(move.san);
            game.currentTurn = chess.turn() === 'w' ? 'white' : 'black';
            if (chess.isGameOver()) {
                game.status = 'completed';
                if (chess.isCheckmate()) {
                    const winner = chess.turn() === 'w' ? 'black' : 'white';
                    game.result = winner === 'white' ? 'white_wins' : 'black_wins';
                    game.winner = winner === 'white' ? game.whitePlayerId : game.blackPlayerId;
                    await this.updatePlayerRatings(game, winner);
                }
                else {
                    game.result = 'draw';
                }
            }
            await game.save();
            const gameState = {
                game,
                legalMoves: chess.moves(),
                isCheck: chess.inCheck(),
                isCheckmate: chess.isCheckmate(),
                isDraw: chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition(),
                isGameOver: chess.isGameOver()
            };
            return { success: true, game, gameState };
        }
        catch (error) {
            console.error('Error making move:', error);
            return { success: false, error: 'Internal server error' };
        }
    }
    async getPlayerGames(userId, status) {
        const query = {
            $or: [
                { whitePlayerId: userId },
                { blackPlayerId: userId }
            ]
        };
        if (status) {
            query.status = status;
        }
        return await game_models_1.Game.find(query)
            .sort({ updatedAt: -1 })
            .limit(50);
    }
    async resignGame(gameId, userId) {
        try {
            const game = await this.getGame(gameId);
            if (!game) {
                return { success: false, error: 'Game not found' };
            }
            if (game.status !== 'active') {
                return { success: false, error: 'Game is not active' };
            }
            const isWhitePlayer = game.whitePlayerId === userId;
            const isBlackPlayer = game.blackPlayerId === userId;
            if (!isWhitePlayer && !isBlackPlayer) {
                return { success: false, error: 'You are not a player in this game' };
            }
            game.status = 'completed';
            const winner = isWhitePlayer ? 'black' : 'white';
            game.result = winner === 'white' ? 'white_wins' : 'black_wins';
            game.winner = winner === 'white' ? game.whitePlayerId : game.blackPlayerId;
            await this.updatePlayerRatings(game, winner);
            await game.save();
            return { success: true, game };
        }
        catch (error) {
            console.error('Error resigning game:', error);
            return { success: false, error: 'Internal server error' };
        }
    }
    async updatePlayerRatings(game, winner) {
        if (game.isGuestGame)
            return;
        try {
            const whitePlayer = await user_1.User.findById(game.whitePlayerId);
            const blackPlayer = await user_1.User.findById(game.blackPlayerId);
            if (!whitePlayer || !blackPlayer)
                return;
            const whiteRating = whitePlayer.elo;
            const blackRating = blackPlayer.elo;
            const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
            const expectedBlack = 1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));
            const actualWhite = winner === 'white' ? 1 : 0;
            const actualBlack = winner === 'black' ? 1 : 0;
            const K = 32; // K-factor for rating change
            const newWhiteRating = Math.round(whiteRating + K * (actualWhite - expectedWhite));
            const newBlackRating = Math.round(blackRating + K * (actualBlack - expectedBlack));
            await user_1.User.findByIdAndUpdate(game.whitePlayerId, { elo: newWhiteRating });
            await user_1.User.findByIdAndUpdate(game.blackPlayerId, { elo: newBlackRating });
        }
        catch (error) {
            console.error('Error updating player ratings:', error);
        }
    }
    async createGuestGame(guestName) {
        const gameData = {
            whitePlayerName: guestName,
            blackPlayerName: 'Waiting for opponent...',
            status: 'active',
            isGuestGame: true
        };
        const game = new game_models_1.Game(gameData);
        await game.save();
        return game;
    }
}
exports.gameService = new GameService();
