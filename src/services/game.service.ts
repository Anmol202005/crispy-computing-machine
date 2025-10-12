import { Chess, Move } from 'chess.js';
import { Game, IGame } from '../models/game.models';
import { User } from '../models/user';

export interface MoveRequest {
  gameId: string;
  userId: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
}

export interface GameStateResponse {
  game: IGame;
  legalMoves: string[];
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
}

class GameService {
  async getGame(gameId: string): Promise<IGame | null> {
    return await Game.findById(gameId);
  }

  async getGameState(gameId: string): Promise<GameStateResponse | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    const chess = new Chess(game.fen);

    return {
      game,
      legalMoves: chess.moves(),
      isCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition(),
      isGameOver: chess.isGameOver()
    };
  }

  async makeMove(moveRequest: MoveRequest): Promise<{ success: boolean; game?: IGame; error?: string; gameState?: GameStateResponse }> {
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

      const chess = new Chess(game.fen);
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
      game.currentTurn = chess.turn() === 'w' ? 'white' as any : 'black' as any;

      if (chess.isGameOver()) {
        game.status = 'completed' as any;

        if (chess.isCheckmate()) {
          const winner = chess.turn() === 'w' ? 'black' : 'white';
          game.result = winner === 'white' ? 'white_wins' as any : 'black_wins' as any;
          game.winner = winner === 'white' ? game.whitePlayerId : game.blackPlayerId;

          await this.updatePlayerRatings(game, winner);
        } else {
          game.result = 'draw' as any;
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
    } catch (error) {
      console.error('Error making move:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async getPlayerGames(userId: string, status?: string): Promise<IGame[]> {
    const query: any = {
      $or: [
        { whitePlayerId: userId },
        { blackPlayerId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    return await Game.find(query)
      .sort({ updatedAt: -1 })
      .limit(50);
  }

  async resignGame(gameId: string, userId: string): Promise<{ success: boolean; game?: IGame; error?: string }> {
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

      game.status = 'completed' as any;
      const winner = isWhitePlayer ? 'black' : 'white';
      game.result = winner === 'white' ? 'white_wins' as any : 'black_wins' as any;
      game.winner = winner === 'white' ? game.whitePlayerId : game.blackPlayerId;

      await this.updatePlayerRatings(game, winner);
      await game.save();

      return { success: true, game };
    } catch (error) {
      console.error('Error resigning game:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  private async updatePlayerRatings(game: IGame, winner: 'white' | 'black'): Promise<void> {
    if (game.isGuestGame) return;

    try {
      const whitePlayer = await User.findById(game.whitePlayerId);
      const blackPlayer = await User.findById(game.blackPlayerId);

      if (!whitePlayer || !blackPlayer) return;

      const whiteRating = whitePlayer.elo;
      const blackRating = blackPlayer.elo;

      const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
      const expectedBlack = 1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));

      const actualWhite = winner === 'white' ? 1 : 0;
      const actualBlack = winner === 'black' ? 1 : 0;

      const K = 32; // K-factor for rating change

      const newWhiteRating = Math.round(whiteRating + K * (actualWhite - expectedWhite));
      const newBlackRating = Math.round(blackRating + K * (actualBlack - expectedBlack));

      await User.findByIdAndUpdate(game.whitePlayerId, { elo: newWhiteRating });
      await User.findByIdAndUpdate(game.blackPlayerId, { elo: newBlackRating });
    } catch (error) {
      console.error('Error updating player ratings:', error);
    }
  }

  async createGuestGame(guestName: string): Promise<IGame> {
    const gameData = {
      whitePlayerName: guestName,
      blackPlayerName: 'Waiting for opponent...',
      status: 'active' as any,
      isGuestGame: true
    };

    const game = new Game(gameData);
    await game.save();
    return game;
  }
}

export const gameService = new GameService();