import { Chess, Move } from 'chess.js';
import { Game, IGame, Color, Status, Result } from '../models/game.models';
import { User } from '../models/user';
import { getGameFormat, parseTimeControl } from '../utils/timeControlUtils';

export interface MoveRequest {
  gameId: string;
  userId: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
}

export type GameCompletionReason =
  | 'CHECKMATE'
  | 'RESIGNATION'
  | 'DRAW_STALEMATE'
  | 'DRAW_THREEFOLD'
  | 'DRAW_FIFTY_MOVE'
  | 'DRAW_INSUFFICIENT_MATERIAL'
  | 'DRAW_AGREEMENT'
  | 'TIMEOUT';

export interface GameClockState {
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  incrementSeconds: number;
  lastMoveAt: string;
  currentTurn: Color;
}

export interface GameStateResponse {
  game: IGame;
  legalMoves: string[];
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  clock: GameClockState;
}

export interface RatingUpdate {
  oldRating: number;
  newRating: number;
  delta: number;
}

export interface RatingSummary {
  white?: RatingUpdate;
  black?: RatingUpdate;
}

export interface GameCompletionPayload {
  game: IGame;
  reason: GameCompletionReason;
  result: Result;
  winnerColor?: Color;
  winnerId?: string;
  ratings?: RatingSummary;
}

export interface GameSummary {
  gameId: string;
  opponentName: string;
  opponentElo: number | null;
  playerElo: number | null;
  result: Result | null;
  movesCount: number;
  matchDate: string;
  playerColor: Color;
  playerResult: 'win' | 'loss' | 'draw';
}

class GameService {
  async getGame(gameId: string): Promise<IGame | null> {
    return await Game.findById(gameId);
  }

  async getGameState(gameId: string): Promise<GameStateResponse | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    this.ensureClockDefaults(game);
    const chess = new Chess(game.fen);

    return this.buildGameState(game, chess);
  }

  async makeMove(moveRequest: MoveRequest): Promise<{ success: boolean; game?: IGame; error?: string; gameState?: GameStateResponse; completion?: GameCompletionPayload }> {
    try {
      const game = await this.getGame(moveRequest.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      this.ensureClockDefaults(game);

      if (game.status !== Status.ACTIVE) {
        return { success: false, error: 'Game is not active' };
      }

      const chess = new Chess(game.fen);
      const currentTurn = chess.turn();
      const moverColor = currentTurn === 'w' ? Color.WHITE : Color.BLACK;
      const isWhitePlayer = game.whitePlayerId === moveRequest.userId;
      const isBlackPlayer = game.blackPlayerId === moveRequest.userId;

      const isPlayersTurn = (currentTurn === 'w' && isWhitePlayer) || (currentTurn === 'b' && isBlackPlayer);
      if (!isPlayersTurn) {
        return { success: false, error: 'It is not your turn' };
      }

      if (!game.clockStarted) {
        game.clockStarted = true;
        game.lastMoveAt = new Date();
      }

      // Check for timeout BEFORE accepting the move
      const remainingBeforeMove = this.getTimeRemainingForTurn(game, moverColor);
      if (remainingBeforeMove <= 0) {
        const timeoutCompletion = await this.finishOnTimeout(game, moverColor);
        await game.save();
        return {
          success: false,
          error: 'Time expired',
          game,
          gameState: this.buildGameState(game, chess),
          completion: timeoutCompletion
        };
      }

      const move = chess.move(moveRequest.move);
      if (!move) {
        return { success: false, error: 'Invalid move' };
      }

      // Apply clock changes: subtract elapsed time, add increment
      this.applyClockAfterMove(game, moverColor, remainingBeforeMove);
      
      game.fen = chess.fen();
      game.moves.push(move.san);
      game.currentTurn = chess.turn() === 'w' ? Color.WHITE : Color.BLACK;
      game.lastMoveAt = new Date();
      game.clockStarted = true;

      let completion: GameCompletionPayload | undefined;

      if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
          const winnerColor = chess.turn() === 'w' ? Color.BLACK : Color.WHITE;
          const winnerId = winnerColor === Color.WHITE ? game.whitePlayerId : game.blackPlayerId;

          game.status = Status.COMPLETED;
          game.result = winnerColor === Color.WHITE ? Result.WHITE_WINS : Result.BLACK_WINS;
          game.winner = winnerId;

          const ratings = await this.applyRatingUpdates(game, {
            white: winnerColor === Color.WHITE ? 1 : 0,
            black: winnerColor === Color.BLACK ? 1 : 0
          });

          completion = {
            game,
            reason: 'CHECKMATE',
            result: game.result,
            winnerColor,
            winnerId,
            ratings
          };
        } else {
          game.status = Status.COMPLETED;
          game.result = Result.DRAW;
          game.winner = null;

          const ratings = await this.applyRatingUpdates(game, { white: 0.5, black: 0.5 });

          completion = {
            game,
            reason: this.detectDrawReason(chess),
            result: Result.DRAW,
            ratings
          };
        }
      }

      await game.save();

      const gameState = this.buildGameState(game, chess);

      return { success: true, game, gameState, completion };
    } catch (error) {
      console.error('Error making move:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async getPlayerGames(userId: string, status?: string): Promise<IGame[]> {
    const query: Record<string, unknown> = { $or: [{ whitePlayerId: userId }, { blackPlayerId: userId }] };
    if (status && Object.values(Status).includes(status as Status)) {
      query.status = status;
    }

    return await Game.find(query).sort({ updatedAt: -1 });
  }

  async resignGame(gameId: string, userId: string): Promise<{ success: boolean; game?: IGame; error?: string; completion?: GameCompletionPayload }> {
    try {
      const game = await this.getGame(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.status !== Status.ACTIVE) {
        return { success: false, error: 'Game is not active' };
      }

      const isWhitePlayer = game.whitePlayerId === userId;
      const isBlackPlayer = game.blackPlayerId === userId;

      if (!isWhitePlayer && !isBlackPlayer) {
        return { success: false, error: 'You are not a player in this game' };
      }

      const winnerColor = isWhitePlayer ? Color.BLACK : Color.WHITE;
      const winnerId = winnerColor === Color.WHITE ? game.whitePlayerId : game.blackPlayerId;

      game.status = Status.COMPLETED;
      game.result = winnerColor === Color.WHITE ? Result.WHITE_WINS : Result.BLACK_WINS;
      game.winner = winnerId;

      const ratings = await this.applyRatingUpdates(game, {
        white: winnerColor === Color.WHITE ? 1 : 0,
        black: winnerColor === Color.BLACK ? 1 : 0
      });

      await game.save();

      const completion: GameCompletionPayload = {
        game,
        reason: 'RESIGNATION',
        result: game.result,
        winnerColor,
        winnerId,
        ratings
      };

      return { success: true, game, completion };
    } catch (error) {
      console.error('Error resigning game:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async createGuestGame(guestName: string): Promise<IGame> {
    const gameData = {
      whitePlayerName: guestName,
      blackPlayerName: 'Waiting for opponent...',
      status: Status.ACTIVE,
      isGuestGame: true
    };

    const game = new Game(gameData);
    await game.save();
    return game;
  }

  private buildPerspective(game: IGame, userId: string) {
    const whiteId = (game.whitePlayerId ?? '').toString();
    const blackId = (game.blackPlayerId ?? '').toString();
    const currentUserId = userId.toString();

    const isWhite = whiteId === currentUserId;
    const isBlack = blackId === currentUserId;
    if (!isWhite && !isBlack) {
      return null;
    }

    const playerColor = isWhite ? Color.WHITE : Color.BLACK;
    const opponentId = isWhite ? blackId : whiteId;
    const opponentName = isWhite ? game.blackPlayerName : game.whitePlayerName;

    let playerResult: 'win' | 'loss' | 'draw' = 'draw';
    if (game.status === Status.COMPLETED && game.result) {
      if (game.result === Result.WHITE_WINS) {
        playerResult = isWhite ? 'win' : 'loss';
      } else if (game.result === Result.BLACK_WINS) {
        playerResult = isWhite ? 'loss' : 'win';
      }
    }

    return { playerColor, opponentId, opponentName, playerResult };
  }

  async getPlayerGamesSummary(userId: string): Promise<GameSummary[]> {
    const games = await Game.find({
      $or: [
        { whitePlayerId: userId },
        { blackPlayerId: userId }
      ],
      status: Status.COMPLETED
    }).sort({ updatedAt: -1 });

    const relatedIds = new Set<string>([userId]);
    games.forEach(game => {
      const perspective = this.buildPerspective(game, userId);
      if (perspective?.opponentId && !perspective.opponentId.startsWith('guest_')) {
        relatedIds.add(perspective.opponentId);
      }
      if (game.whitePlayerId) relatedIds.add(game.whitePlayerId);
      if (game.blackPlayerId) relatedIds.add(game.blackPlayerId);
    });

    const profiles = await User.find({ _id: { $in: Array.from(relatedIds) } }, { elo: 1 }).lean();
    const eloMap = new Map<string, number>(
      profiles.map(profile => [profile._id.toString(), profile.elo])
    );

    return games
      .map(game => {
        const perspective = this.buildPerspective(game, userId);
        if (!perspective) return null;

        const timestamp = game.updatedAt ?? game.createdAt ?? new Date();
        const opponentElo = perspective.opponentId ? eloMap.get(perspective.opponentId) ?? null : null;
        const playerElo = eloMap.get(userId) ?? null;

        return {
          gameId: game.id,
          opponentName: perspective.opponentName,
          opponentElo,
          playerElo,
          result: game.result ?? null,
          movesCount: game.moves?.length ?? 0,
          matchDate: new Date(timestamp).toISOString(),
          playerColor: perspective.playerColor,
          playerResult: perspective.playerResult
        };
      })
      .filter((summary): summary is GameSummary => summary !== null);
  }

  async completeDraw(gameId: string, reason: GameCompletionReason = 'DRAW_AGREEMENT'): Promise<{ success: boolean; game?: IGame; completion?: GameCompletionPayload; error?: string }> {
    try {
      const game = await this.getGame(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.status !== Status.ACTIVE) {
        return { success: false, error: 'Game is not active' };
      }

      game.status = Status.COMPLETED;
      game.result = Result.DRAW;
      game.winner = null;

      const ratings = await this.applyRatingUpdates(game, { white: 0.5, black: 0.5 });

      await game.save();

      return {
        success: true,
        game,
        completion: {
          game,
          reason,
          result: Result.DRAW,
          ratings
        }
      };
    } catch (error) {
      console.error('Error completing draw:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  private detectDrawReason(chess: Chess): GameCompletionReason {
    if (chess.isStalemate()) return 'DRAW_STALEMATE';
    if (chess.isThreefoldRepetition()) return 'DRAW_THREEFOLD';
    if (chess.isInsufficientMaterial()) return 'DRAW_INSUFFICIENT_MATERIAL';
    return 'DRAW_FIFTY_MOVE';
  }

  private async applyRatingUpdates(game: IGame, scores: { white: number; black: number }): Promise<RatingSummary | undefined> {
    if (game.isGuestGame) {
      return undefined;
    }

    const whiteId = game.whitePlayerId;
    const blackId = game.blackPlayerId;

    if (!whiteId || !blackId) {
      return undefined;
    }

    const [whitePlayer, blackPlayer] = await Promise.all([
      User.findById(whiteId),
      User.findById(blackId)
    ]);

    if (!whitePlayer || !blackPlayer) {
      return undefined;
    }

    const whiteOld = whitePlayer.elo;
    const blackOld = blackPlayer.elo;

    const expectedWhite = 1 / (1 + Math.pow(10, (blackOld - whiteOld) / 400));
    const expectedBlack = 1 / (1 + Math.pow(10, (whiteOld - blackOld) / 400));

    const K = 32;

    const whiteNew = Math.round(whiteOld + K * (scores.white - expectedWhite));
    const blackNew = Math.round(blackOld + K * (scores.black - expectedBlack));

    whitePlayer.elo = whiteNew;
    blackPlayer.elo = blackNew;

    await Promise.all([whitePlayer.save(), blackPlayer.save()]);

    return {
      white: {
        oldRating: whiteOld,
        newRating: whiteNew,
        delta: whiteNew - whiteOld
      },
      black: {
        oldRating: blackOld,
        newRating: blackNew,
        delta: blackNew - blackOld
      }
    };
  }

  async getPerformanceByFormat(userId: string): Promise<any> {
    try {
      // Fetch all completed games for the user
      const games = await Game.find({
        $or: [
          { whitePlayerId: userId },
          { blackPlayerId: userId }
        ],
        status: Status.COMPLETED
      });

      // Initialize format stats with all possible formats
      const formatStats: Record<string, { played: number; wins: number; losses: number; draws: number }> = {
        Overall: { played: 0, wins: 0, losses: 0, draws: 0 },
        Bullet: { played: 0, wins: 0, losses: 0, draws: 0 },
        Blitz: { played: 0, wins: 0, losses: 0, draws: 0 },
        Rapid: { played: 0, wins: 0, losses: 0, draws: 0 }
      };

      // Process each game
      games.forEach(game => {
        try {
          // Get format from timeControl (defaults to Rapid if missing)
          const format = getGameFormat(game.timeControl || '10 min');
          
          // Safely compare player IDs
          const whiteId = game.whitePlayerId?.toString() || '';
          const blackId = game.blackPlayerId?.toString();
          const currentUserId = userId.toString();
          
          const isWhite = whiteId === currentUserId;
          const isBlack = blackId === currentUserId;

          // Skip if user is neither player (shouldn't happen but safety check)
          if (!isWhite && !isBlack) {
            return;
          }

          // Determine result from user's perspective
          let result: 'win' | 'loss' | 'draw' = 'draw';
          if (game.result === Result.WHITE_WINS) {
            result = isWhite ? 'win' : 'loss';
          } else if (game.result === Result.BLACK_WINS) {
            result = isWhite ? 'loss' : 'win';
          } else if (game.result === Result.DRAW) {
            result = 'draw';
          }

          // Update Overall stats (always count)
          formatStats.Overall.played++;
          if (result === 'win') formatStats.Overall.wins++;
          else if (result === 'loss') formatStats.Overall.losses++;
          else formatStats.Overall.draws++;

          // Update format-specific stats
          formatStats[format].played++;
          if (result === 'win') formatStats[format].wins++;
          else if (result === 'loss') formatStats[format].losses++;
          else formatStats[format].draws++;

        } catch (gameError) {
          console.error('Error processing game:', game._id, gameError);
        }
      });

      // Format response
      const response = Object.entries(formatStats).map(([format, stats]) => ({
        format,
        played: stats.played,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winRate: stats.played > 0 ? parseFloat((stats.wins / stats.played * 100).toFixed(1)) : 0
      }));

      return response;
    } catch (error) {
      console.error('Error getting performance by format:', error);
      throw new Error(`Failed to get performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleTimeout(gameId: string, timedOutColor: Color): Promise<{ success: boolean; game?: IGame; completion?: GameCompletionPayload; error?: string }> {
    try {
      const game = await this.getGame(gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.status !== Status.ACTIVE) {
        return { success: false, error: 'Game is not active' };
      }

      const completion = await this.finishOnTimeout(game, timedOutColor);
      await game.save();

      return { success: true, game, completion };
    } catch (error) {
      console.error('Error handling timeout:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async startGameClockIfNeeded(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== Status.ACTIVE || game.clockStarted) return;

    game.clockStarted = true;
    game.lastMoveAt = new Date();
    await game.save();
  }

  private applyClockAfterMove(game: IGame, moverColor: Color, remainingBeforeMove: number) {
    const increment = game.incrementSeconds ?? 0;
    const updated = Math.max(0, remainingBeforeMove) + increment;

    if (moverColor === Color.WHITE) {
      game.whiteTimeRemaining = updated;
    } else {
      game.blackTimeRemaining = updated;
    }

    game.clockStarted = true;
    game.lastMoveAt = new Date();
  }

  private getTimeRemainingForTurn(game: IGame, turn: Color): number {
    const base = turn === Color.WHITE
      ? (game.whiteTimeRemaining ?? game.initialTimeSeconds ?? 600)
      : (game.blackTimeRemaining ?? game.initialTimeSeconds ?? 600);

    if (!game.clockStarted || !game.lastMoveAt || game.status !== Status.ACTIVE) {
      return base;
    }

    const lastMoveAt = game.lastMoveAt.getTime();
    const now = Date.now();
    const elapsed = Math.max(0, Math.floor((now - lastMoveAt) / 1000));

    // Only subtract time if it's this player's turn
    const isCurrentTurn = turn === (game.currentTurn ?? Color.WHITE);
    return isCurrentTurn ? Math.max(0, base - elapsed) : base;
  }

  private computeClockSnapshot(game: IGame): GameClockState {
    const baseWhite = game.whiteTimeRemaining ?? game.initialTimeSeconds ?? 600;
    const baseBlack = game.blackTimeRemaining ?? game.initialTimeSeconds ?? 600;

    if (!game.clockStarted || !game.lastMoveAt || game.status !== Status.ACTIVE) {
      return {
        whiteTimeRemaining: baseWhite,
        blackTimeRemaining: baseBlack,
        incrementSeconds: game.incrementSeconds ?? 0,
        lastMoveAt: (game.lastMoveAt ?? new Date()).toISOString(),
        currentTurn: game.currentTurn ?? Color.WHITE,
      };
    }

    const lastMoveAt = game.lastMoveAt.getTime();
    const now = Date.now();
    const elapsed = Math.max(0, Math.floor((now - lastMoveAt) / 1000));

    // Calculate display times
    const displayWhite = game.currentTurn === Color.WHITE 
      ? Math.max(0, baseWhite - elapsed) 
      : baseWhite;
    const displayBlack = game.currentTurn === Color.BLACK 
      ? Math.max(0, baseBlack - elapsed) 
      : baseBlack;

    return {
      whiteTimeRemaining: displayWhite,
      blackTimeRemaining: displayBlack,
      incrementSeconds: game.incrementSeconds ?? 0,
      lastMoveAt: game.lastMoveAt.toISOString(),
      currentTurn: game.currentTurn ?? Color.WHITE,
    };
  }

  private async finishOnTimeout(game: IGame, timedOutColor: Color): Promise<GameCompletionPayload> {
    game.clockStarted = true;
    const winnerColor = timedOutColor === Color.WHITE ? Color.BLACK : Color.WHITE;
    const winnerId = winnerColor === Color.WHITE ? game.whitePlayerId : game.blackPlayerId;

    if (timedOutColor === Color.WHITE) {
      game.whiteTimeRemaining = 0;
    } else {
      game.blackTimeRemaining = 0;
    }

    game.status = Status.COMPLETED;
    game.result = winnerColor === Color.WHITE ? Result.WHITE_WINS : Result.BLACK_WINS;
    game.winner = winnerId;

    const ratings = await this.applyRatingUpdates(game, {
      white: winnerColor === Color.WHITE ? 1 : 0,
      black: winnerColor === Color.BLACK ? 1 : 0
    });

    return {
      game,
      reason: 'TIMEOUT',
      result: game.result,
      winnerColor,
      winnerId,
      ratings
    };
  }

  private ensureClockDefaults(game: IGame): void {
    if (!game.initialTimeSeconds || !game.incrementSeconds) {
      const parsed = parseTimeControl(game.timeControl || '10 min');
      game.initialTimeSeconds = parsed.baseSeconds;
      game.incrementSeconds = parsed.incrementSeconds;
    }

    if (game.whiteTimeRemaining === undefined || game.blackTimeRemaining === undefined) {
      game.whiteTimeRemaining = game.initialTimeSeconds;
      game.blackTimeRemaining = game.initialTimeSeconds;
    }

    if (!game.lastMoveAt) {
      game.lastMoveAt = new Date();
    }

    if (!game.currentTurn) {
      game.currentTurn = Color.WHITE;
    }

    if (game.clockStarted && !game.lastMoveAt) {
      game.lastMoveAt = new Date();
    }
  }

  private buildGameState(game: IGame, chessInstance?: Chess): GameStateResponse {
    const chess = chessInstance ?? new Chess(game.fen);
    const clock = this.computeClockSnapshot(game);

    return {
      game,
      legalMoves: chess.moves(),
      isCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition(),
      isGameOver: chess.isGameOver(),
      clock
    };
  }
}

export const gameService = new GameService();