import { Server, Socket } from 'socket.io';
import { gameService } from '../services/game.service';
import { matchmakingService } from '../services/matchmaking.service';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';

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
  private playerSockets = new Map<string, string>(); // userId -> socketId

  setupSocket(io: Server) {
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
        const user = await User.findById(decoded.id);

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
          io.to(gameId).emit('players-connected', {
            whiteConnected: playersConnected.includes(game.whitePlayerId || ''),
            blackConnected: playersConnected.includes(game.blackPlayerId || ''),
            spectatorCount: Math.max(0, room.players.size - 2)
          });

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

          io.to(data.gameId).emit('move-made', {
            move: data.move,
            gameState: result.gameState,
            player: socket.user?.username || socket.guestId
          });

          if (result.gameState?.isGameOver) {
            io.to(data.gameId).emit('game-over', {
              result: result.game?.result,
              winner: result.game?.winner
            });
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

          io.to(gameId).emit('game-resigned', {
            resignedBy: socket.user?.username || socket.guestId,
            winner: result.game?.winner
          });

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

      socket.on('matchmaking-found', (data: { gameId: string; opponent: any }) => {
        const opponentSocketId = this.playerSockets.get(data.opponent.userId);
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('matchmaking-found', {
            gameId: data.gameId,
            opponent: socket.user?.username || socket.guestId
          });
        }
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
        matchmakingService.leaveMatchmaking(userId);
      });
    });
  }

  getConnectedPlayers(): number {
    return this.playerSockets.size;
  }

  getActiveGames(): number {
    return this.gameRooms.size;
  }
}

export const gameSocketService = new GameSocketService();