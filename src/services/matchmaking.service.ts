import { Game, IGame } from '../models/game.models';
import { User, IUser } from '../models/user';

export interface MatchmakingRequest {
  userId: string;
  username: string;
  elo: number;
  isGuest?: boolean;
  guestName?: string;
}

class MatchmakingService {
  private waitingPlayers: Map<string, MatchmakingRequest> = new Map();
  private readonly ELO_RANGE_BASE = 100;
  private readonly ELO_RANGE_INCREMENT = 50;
  private readonly MAX_WAIT_TIME = 30000; // 30 seconds

  async joinMatchmaking(request: MatchmakingRequest): Promise<{ gameId?: string; isWaiting?: boolean }> {
    const opponent = this.findOpponent(request);

    if (opponent) {
      this.waitingPlayers.delete(opponent.userId);
      const game = await this.createGame(request, opponent);
      return { gameId: (game._id as any).toString() };
    }

    this.waitingPlayers.set(request.userId, {
      ...request,
      timestamp: Date.now()
    } as any);

    this.scheduleTimeoutCleanup(request.userId);
    return { isWaiting: true };
  }

  leaveMatchmaking(userId: string): void {
    this.waitingPlayers.delete(userId);
  }

  private findOpponent(request: MatchmakingRequest): MatchmakingRequest | null {
    let bestMatch: MatchmakingRequest | null = null;
    let bestRatingDiff = Infinity;

    for (const [waitingUserId, waitingPlayer] of this.waitingPlayers) {
      if (waitingUserId === request.userId) continue;

      const ratingDiff = Math.abs(request.elo - waitingPlayer.elo);
      const waitTime = Date.now() - (waitingPlayer as any).timestamp;

      const maxAllowedDiff = this.calculateMaxEloRange(waitTime);

      if (ratingDiff <= maxAllowedDiff && ratingDiff < bestRatingDiff) {
        bestMatch = waitingPlayer;
        bestRatingDiff = ratingDiff;
      }
    }

    return bestMatch;
  }

  private calculateMaxEloRange(waitTime: number): number {
    const timeSegments = Math.floor(waitTime / 5000); // Every 5 seconds
    return this.ELO_RANGE_BASE + (timeSegments * this.ELO_RANGE_INCREMENT);
  }

  private async createGame(player1: MatchmakingRequest, player2: MatchmakingRequest): Promise<IGame> {
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
      status: 'active' as any,
      isGuestGame: player1.isGuest || player2.isGuest
    };

    const game = new Game(gameData);
    await game.save();
    return game;
  }

  private scheduleTimeoutCleanup(userId: string): void {
    setTimeout(() => {
      const player = this.waitingPlayers.get(userId);
      if (player && Date.now() - (player as any).timestamp >= this.MAX_WAIT_TIME) {
        this.waitingPlayers.delete(userId);
      }
    }, this.MAX_WAIT_TIME);
  }

  getWaitingPlayersCount(): number {
    return this.waitingPlayers.size;
  }

  isPlayerWaiting(userId: string): boolean {
    return this.waitingPlayers.has(userId);
  }
}

export const matchmakingService = new MatchmakingService();