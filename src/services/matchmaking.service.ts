import { Game, IGame, Status } from '../models/game.models';
import { User, IUser } from '../models/user';
import { Server } from 'socket.io';
import { gameSocketService } from '../sockets';
import { parseTimeControl } from '../utils/timeControlUtils';

export interface MatchmakingRequest {
  userId: string;
  username: string;
  elo: number;
  avatar?: string;
  isGuest?: boolean;
  guestName?: string;
  timeControl: string;
}

type WaitingPlayer = MatchmakingRequest & { timestamp: number };

class MatchmakingService {
  private waitingPlayers: Map<string, WaitingPlayer> = new Map();
  private readonly ELO_RANGE_BASE = 200;
  private readonly ELO_RANGE_INCREMENT = 100;
  private readonly MAX_WAIT_TIME = 180000; // Changed from 30000 to 180000 (3 minutes)
  private io: Server | null = null;

  setSocketServer(io: Server): void {
    this.io = io;
  }

  async joinMatchmaking(request: MatchmakingRequest): Promise<{ gameId?: string; isWaiting?: boolean }> {
    const opponent = this.findOpponent(request);

    if (opponent) {
      this.waitingPlayers.delete(opponent.userId);
      const game = await this.createGame(request, opponent);
      const gameId = (game._id as any).toString();

      this.notifyMatchFound(request, opponent, gameId);

      return { gameId };
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

      // Only match players with the same time control
      if (waitingPlayer.timeControl !== request.timeControl) continue;

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

  private calculateMaxEloRange(waitTime: number): number {
    const timeSegments = Math.floor(waitTime / 5000); // Every 5 seconds
    return this.ELO_RANGE_BASE + (timeSegments * this.ELO_RANGE_INCREMENT);
  }

  private async createGame(player1: MatchmakingRequest, player2: MatchmakingRequest): Promise<IGame> {
    const isPlayer1White = Math.random() < 0.5;
    const { baseSeconds, incrementSeconds } = parseTimeControl(player1.timeControl);

    const gameData = {
      whitePlayerId: isPlayer1White ? player1.userId : player2.userId,
      blackPlayerId: isPlayer1White ? player2.userId : player1.userId,
      whitePlayerName: isPlayer1White ?
        (player1.isGuest ? player1.guestName : player1.username) :
        (player2.isGuest ? player2.guestName : player2.username),
      blackPlayerName: isPlayer1White ?
        (player2.isGuest ? player2.guestName : player2.username) :
        (player1.isGuest ? player1.guestName : player1.username),
      whitePlayerAvatar: (isPlayer1White ? player1.avatar : player2.avatar) || 'avatar1.svg',
      blackPlayerAvatar: (isPlayer1White ? player2.avatar : player1.avatar) || 'avatar1.svg',
      status: Status.ACTIVE,
      isGuestGame: player1.isGuest || player2.isGuest,
      timeControl: player1.timeControl,
      initialTimeSeconds: baseSeconds,
      incrementSeconds,
      whiteTimeRemaining: baseSeconds,
      blackTimeRemaining: baseSeconds,
      lastMoveAt: null,
      clockStarted: false,
      // Store ELO at match start for accurate historical tracking
      whitePlayerElo: isPlayer1White ? player1.elo : player2.elo,
      blackPlayerElo: isPlayer1White ? player2.elo : player1.elo,
    };

    console.debug('Creating game with timeControl:', player1.timeControl);

    const game = new Game(gameData);
    await game.save();
    return game;
  }

  private scheduleTimeoutCleanup(userId: string): void {
    setTimeout(() => {
      const player = this.waitingPlayers.get(userId);
      if (player && Date.now() - player.timestamp >= this.MAX_WAIT_TIME) {
        this.waitingPlayers.delete(userId);
        
        // Notify player via socket that matchmaking timed out
        const socketId = gameSocketService.getPlayerSocketId(userId);
        if (socketId) {
          gameSocketService.emitToSocket(socketId, 'matchmaking-timeout', {
            message: 'No opponent found. Please try again.'
          });
        }
      }
    }, this.MAX_WAIT_TIME);
  }

  getWaitingPlayersCount(): number {
    return this.waitingPlayers.size;
  }

  isPlayerWaiting(userId: string): boolean {
    return this.waitingPlayers.has(userId);
  }

  private notifyMatchFound(player1: MatchmakingRequest, player2: MatchmakingRequest, gameId: string): void {
    const opponentForPlayer1 = {
      userId: player2.userId,
      username: player2.isGuest ? player2.guestName : player2.username,
      avatar: player2.avatar || 'avatar1.svg',
      isGuest: player2.isGuest || false,
      elo: player2.elo
    };

    const opponentForPlayer2 = {
      userId: player1.userId,
      username: player1.isGuest ? player1.guestName : player1.username,
      avatar: player1.avatar || 'avatar1.svg',
      isGuest: player1.isGuest || false,
      elo: player1.elo
    };

    const player1SocketId = gameSocketService.getPlayerSocketId(player1.userId);
    const player2SocketId = gameSocketService.getPlayerSocketId(player2.userId);

    if (!player1SocketId) {
      console.warn(`[matchmaking] Missing socket for ${player1.userId} while notifying match.`);
    }
    if (!player2SocketId) {
      console.warn(`[matchmaking] Missing socket for ${player2.userId} while notifying match.`);
    }

    gameSocketService.emitToSocket(player1SocketId, 'matchmaking-found', {
      gameId,
      timeControl: player1.timeControl,
      opponent: opponentForPlayer1,
      player: {
        userId: player1.userId,
        username: player1.isGuest ? player1.guestName : player1.username,
        isGuest: player1.isGuest || false,
        elo: player1.elo
      }
    });

    gameSocketService.emitToSocket(player2SocketId, 'matchmaking-found', {
      gameId,
      timeControl: player2.timeControl,
      opponent: opponentForPlayer2,
      player: {
        userId: player2.userId,
        username: player2.isGuest ? player2.guestName : player2.username,
        isGuest: player2.isGuest || false,
        elo: player2.elo
      }
    });

    if ((!player1SocketId || !player2SocketId) && this.io) {
      this.io.emit('matchmaking-found', {
        fallback: true,
        details: { player1: player1.userId, player2: player2.userId, gameId }
      });
    }

    console.debug(`[matchmaking] Match created (${gameId}) :: ${player1.username} ↔ ${player2.username}`);
  }
}

export const matchmakingService = new MatchmakingService();