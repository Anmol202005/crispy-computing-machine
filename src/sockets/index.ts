import { Server, Socket } from 'socket.io';
import { gameService } from '../services/game.service';
import type { GameCompletionPayload } from '../services/game.service';
import { matchmakingService } from '../services/matchmaking.service';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';
import { Game, Color, Result } from '../models/game.models';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
  };
  isGuest?: boolean;
  guestId?: string;
}

interface GameRoom {
  gameId: string;
  players: Map<string, string>; // userId -> socketId
}

class GameSocketService {
  private gameRooms = new Map<string, GameRoom>();
  private playerSockets = new Map<string, string>();
  private io?: Server;
  private clockIntervals = new Map<string, NodeJS.Timeout>();

  setupSocket(io: Server) {
    this.io = io;

    io.use(async (socket: AuthenticatedSocket, next) => {
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.userId);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = {
          id: (user._id as any).toString(),
          username: user.username
        };

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
      console.log('User connected:', socket.user?.username || socket.guestId);

      const userId = socket.user?.id || socket.guestId!;
      this.playerSockets.set(userId, socket.id);

      socket.on('join-game', async (gameId: string) => {
        try {
          const gameState = await gameService.getGameState(gameId);
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

          const room = this.gameRooms.get(gameId)!;
          room.players.set(userId, socket.id);

          socket.emit('game-state', gameState);

          const playersConnected = Array.from(room.players.keys());
          const whiteConnected = playersConnected.includes(game.whitePlayerId || '');
          const blackConnected = playersConnected.includes(game.blackPlayerId || '');

          this.emitToRoom(gameId, 'players-connected', {
            whiteConnected,
            blackConnected,
            spectatorCount: Math.max(0, room.players.size - 2),
          });

          if (whiteConnected && blackConnected) {
            gameService.startGameClockIfNeeded(gameId).catch((err) =>
              console.error('Failed to start game clock:', err)
            );
          }

          // Start clock sync for active games
          if (game.status === 'active' && !this.clockIntervals.has(gameId)) {
            this.startClockSync(gameId);
          }

        } catch (error) {
          console.error('Error joining game:', error);
          socket.emit('error', { message: 'Failed to join game' });
        }
      });

      socket.on('make-move', async (data: { gameId: string; move: any }) => {
        try {
          const result = await gameService.makeMove({
            gameId: data.gameId,
            userId,
            move: data.move
          });

          if (!result.success) {
            socket.emit('move-error', { message: result.error });
            return;
          }

          socket.to(data.gameId).emit('move-made', {
            move: data.move,
            gameState: result.gameState,
            player: socket.user?.username || socket.guestId
          });

          if (result.completion) {
            this.publishGameCompletion(result.completion);
          }

        } catch (error) {
          console.error('Error making move:', error);
          socket.emit('move-error', { message: 'Failed to make move' });
        }
      });

      socket.on('resign', async (gameId: string) => {
        try {
          const result = await gameService.resignGame(gameId, userId);

          if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
          }

          const game = result.game!;
          const resignedPlayer = socket.user?.username || socket.guestId;
          const winnerUserId = game.winner;

          const isWhiteWinner = game.winner === game.whitePlayerId;
          const winnerName = isWhiteWinner ? game.whitePlayerName : game.blackPlayerName;

          const resignationData = {
            gameId,
            resignedBy: resignedPlayer,
            resignedPlayerId: userId,
            result: game.result,
            winner: {
              userId: winnerUserId,
              username: winnerName,
              color: isWhiteWinner ? Color.WHITE : Color.BLACK
            },
            ratings: result.completion?.ratings ?? null
          };

          this.emitToRoom(gameId, 'game-resigned', resignationData);

          if (result.completion) {
            this.publishGameCompletion(result.completion);
          }

        } catch (error) {
          console.error('Error resigning game:', error);
          socket.emit('error', { message: 'Failed to resign game' });
        }
      });

      socket.on('chat-message', (data: { gameId: string; message: string }) => {
        const { gameId, message } = data;

        if (!message || message.trim().length === 0) return;
        if (message.length > 200) return; // Message length limit

        socket.to(gameId).emit('chat-message', {
          player: socket.user?.username || socket.guestId,
          message: message.trim(),
          timestamp: new Date()
        });
      });

      // Draw offer handlers
      socket.on('draw-offer', (data: { gameId: string; from: string }) => {
        const { gameId, from } = data;
        console.log('Draw offer from:', from, 'in game:', gameId);

        // Send to other players in the game room
        socket.to(gameId).emit('draw-offer', {
          from,
          timestamp: new Date()
        });
      });

      socket.on('draw-accept', async (data: { gameId: string }) => {
        const { gameId } = data;
        console.log('Draw accepted in game:', gameId);

        try {
          const conclusion = await gameService.completeDraw(gameId, 'DRAW_AGREEMENT');
          if (!conclusion.success || !conclusion.completion) {
            socket.emit('error', { message: conclusion.error ?? 'Unable to complete draw' });
            return;
          }

          this.emitToRoom(gameId, 'draw-accept', {
            timestamp: new Date(),
            acceptedBy: socket.user?.username || socket.guestId,
            ratings: conclusion.completion.ratings ?? null
          });

          this.publishGameCompletion(conclusion.completion);
        } catch (error) {
          console.error('Error accepting draw:', error);
          socket.emit('error', { message: 'Failed to accept draw' });
        }
      });

      socket.on('draw-decline', (data: { gameId: string }) => {
        const { gameId } = data;
        console.log('Draw declined in game:', gameId);

        // Notify all players in the game room
        io.to(gameId).emit('draw-decline', {
          timestamp: new Date()
        });
      });

      socket.on('draw-cancel', (data: { gameId: string }) => {
        const { gameId } = data;
        console.log('Draw offer canceled in game:', gameId);

        // Notify all players in the game room
        socket.to(gameId).emit('draw-cancel', {
          timestamp: new Date()
        });
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user?.username || socket.guestId);

        this.playerSockets.delete(userId);

        // Update game rooms
        for (const [gameId, room] of this.gameRooms) {
          if (room.players.has(userId)) {
            room.players.delete(userId);

            // Notify other players in the room
            const game = room.players.size > 0 ? room : null;
            if (game) {
              const gameState = gameService.getGameState(gameId);
              gameState.then(state => {
                if (state) {
                  const playersConnected = Array.from(room.players.keys());
                  this.emitToRoom(gameId, 'players-connected', {
                    whiteConnected: playersConnected.includes(state.game.whitePlayerId || ''),
                    blackConnected: playersConnected.includes(state.game.blackPlayerId || ''),
                    spectatorCount: Math.max(0, room.players.size - 2)
                  });
                }
              });
            }

            // Clean up empty rooms and stop clock sync
            if (room.players.size === 0) {
              this.gameRooms.delete(gameId);
              this.stopClockSync(gameId);
            }
          }
        }

        // Remove from matchmaking if waiting
        matchmakingService.leaveMatchmaking(userId);
      });
    });
  }

  private startClockSync(gameId: string): void {
    if (this.clockIntervals.has(gameId)) return;

    const interval = setInterval(async () => {
      try {
        const gameState = await gameService.getGameState(gameId);
        if (!gameState || gameState.game.status !== 'active') {
          this.stopClockSync(gameId);
          return;
        }

        const { clock, game } = gameState;
        const currentTurn = clock.currentTurn;
        const timeRemaining = currentTurn === Color.WHITE 
          ? clock.whiteTimeRemaining 
          : clock.blackTimeRemaining;

        // Check for timeout and end game
        if (timeRemaining <= 0) {
          console.log(`Timeout detected in game ${gameId} for ${currentTurn}`);
          this.stopClockSync(gameId);
          
          // Trigger timeout completion
          const timedOutColor = currentTurn;
          const result = await gameService.handleTimeout(gameId, timedOutColor);
          
          if (result.success && result.completion) {
            this.publishGameCompletion(result.completion);
          }
          return;
        }

        // Broadcast clock update
        this.emitToRoom(gameId, 'clock-sync', {
          clock: gameState.clock
        });

      } catch (error) {
        console.error(`Error syncing clock for game ${gameId}:`, error);
      }
    }, 1000);

    this.clockIntervals.set(gameId, interval);
    console.log(`Started clock sync for game ${gameId}`);
  }

  private stopClockSync(gameId: string): void {
    const interval = this.clockIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.clockIntervals.delete(gameId);
      console.log(`Stopped clock sync for game ${gameId}`);
    }
  }

  getConnectedPlayers(): number {
    return this.playerSockets.size;
  }

  getActiveGames(): number {
    return this.gameRooms.size;
  }

  getPlayerSocketId(userId: string): string | undefined {
    return this.playerSockets.get(userId);
  }

  public emitToSocket(socketId: string | undefined, event: string, payload: unknown): boolean {
    if (!socketId) {
      return false;
    }
    if (!this.io) {
      console.warn(`[socket] Unable to emit "${event}" - socket server not initialised.`);
      return false;
    }
    this.io.to(socketId).emit(event, payload);
    return true;
  }

  public emitToRoom(roomId: string, event: string, payload: unknown): boolean {
    if (!this.io) {
      console.warn(`[socket] Unable to emit "${event}" to room ${roomId} - socket server not initialised.`);
      return false;
    }
    this.io.to(roomId).emit(event, payload);
    return true;
  }

  public publishGameCompletion(completion: GameCompletionPayload): void {
    if (!this.io) {
      console.warn('[socket] publishGameCompletion called before socket server initialised.');
      return;
    }

    const gameId = completion.game.id;
    
    // Stop clock sync when game completes
    this.stopClockSync(gameId);

    const winnerId = completion.winnerId ?? null;
    const loserId = winnerId
      ? (winnerId === completion.game.whitePlayerId ? completion.game.blackPlayerId : completion.game.whitePlayerId)
      : null;

    const winnerPayload = winnerId && completion.winnerColor
      ? {
          userId: winnerId,
          username: completion.winnerColor === Color.WHITE
            ? completion.game.whitePlayerName
            : completion.game.blackPlayerName,
          color: completion.winnerColor
        }
      : null;

    this.emitToRoom(gameId, 'game-over', {
      gameId,
      result: completion.result,
      reason: completion.reason,
      winner: winnerPayload,
      winnerId,
      loserId,
      ratings: completion.ratings ?? null,
      movesCount: completion.game.moves?.length ?? 0,
      matchDate: new Date(completion.game.updatedAt ?? completion.game.createdAt ?? new Date()).toISOString(),
      timeControl: completion.game.timeControl
    });

    const whitePlayerId = completion.game.whitePlayerId;
    const blackPlayerId = completion.game.blackPlayerId;

    if (completion.ratings && (whitePlayerId || blackPlayerId)) {
      const whiteSocketId = whitePlayerId ? this.playerSockets.get(whitePlayerId) : undefined;
      const blackSocketId = blackPlayerId ? this.playerSockets.get(blackPlayerId) : undefined;

      if (whiteSocketId) {
        this.emitToSocket(whiteSocketId, "rating-updated", {
          gameId,
          playerColor: Color.WHITE,
          self: completion.ratings.white ?? null,
          opponent: completion.ratings.black ?? null,
        });
      }

      if (blackSocketId) {
        this.emitToSocket(blackSocketId, "rating-updated", {
          gameId,
          playerColor: Color.BLACK,
          self: completion.ratings.black ?? null,
          opponent: completion.ratings.white ?? null,
        });
      }
    }
  }
}

export const gameSocketService = new GameSocketService();