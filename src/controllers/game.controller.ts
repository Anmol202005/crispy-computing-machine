import { Request, Response } from 'express';
import { matchmakingService, MatchmakingRequest } from '../services/matchmaking.service';
import { gameService, GameCompletionPayload } from '../services/game.service';
import { User } from '../models/user';
import { AuthRequest } from '../types/jwtRequest';
import { normalizeTimeControl } from '../utils/timeControlUtils';
import { gameSocketService } from '../sockets';

export const joinMatchmaking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { timeControl } = req.body;
    const normalizedTimeControl = normalizeTimeControl(timeControl ?? '10 min');

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const matchmakingRequest: MatchmakingRequest = {
      userId,
      username: user.username,
      elo: user.elo,
      avatar: user.avatar,
      timeControl: normalizedTimeControl
    };

    const result = await matchmakingService.joinMatchmaking(matchmakingRequest);
    res.json(result);
  } catch (error) {
    console.error('Error joining matchmaking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Step 1: Register guest and get ID (no matchmaking yet)
export const registerGuest = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    console.error('Error registering guest:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Step 2: Join matchmaking with verified socket
export const joinGuestMatchmaking = async (req: Request, res: Response): Promise<void> => {
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

    const socketExists = gameSocketService.getPlayerSocketId(guestId) === socketId;

    if (!socketExists) {
      res.status(400).json({
        message: 'Socket not connected. Please ensure you are connected to the game server.'
      });
      return;
    }

    const { guestName, avatar } = req.body;
    if (!guestName || guestName.trim().length < 2) {
      res.status(400).json({ message: 'Guest name must be at least 2 characters' });
      return;
    }

    const normalizedTimeControl = normalizeTimeControl(timeControl ?? '10 min');

    const matchmakingRequest: MatchmakingRequest = {
      userId: guestId,
      username: guestName.trim(),
      elo: 300,
      avatar: avatar || 'avatar1.svg',
      isGuest: true,
      guestName: guestName.trim(),
      timeControl: normalizedTimeControl
    };

    const result = await matchmakingService.joinMatchmaking(matchmakingRequest);
    res.json(result);
  } catch (error) {
    console.error('Error joining guest matchmaking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const leaveMatchmaking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    matchmakingService.leaveMatchmaking(userId);
    res.json({ message: 'Left matchmaking successfully' });
  } catch (error) {
    console.error('Error leaving matchmaking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const gameState = await gameService.getGameState(gameId);

    if (!gameState) {
      res.status(404).json({ message: 'Game not found' });
      return;
    }

    res.json(gameState);
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const broadcastGameCompletion = (completion?: GameCompletionPayload): void => {
  if (!completion) return;
  try {
    gameSocketService.publishGameCompletion(completion);
  } catch (error) {
    console.error('Error broadcasting game completion:', error);
  }
};

export const makeMove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { move } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!move || !move.from || !move.to) {
      res.status(400).json({ message: 'Invalid move format' });
      return;
    }

    const result = await gameService.makeMove({ gameId, userId, move });

    if (!result.success || !result.gameState) {
      res.status(result.error === 'Game not found' ? 404 : 400).json({ message: result.error });
      return;
    }

    broadcastGameCompletion(result.completion);

    res.json({
      ...result.gameState,
      completion: result.completion ?? null
    });
  } catch (error) {
    console.error('Error making move:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resignGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.userId;
    const guestId = req.body?.guestId;
    const playerId = userId || guestId;

    if (!playerId) {
      res.status(401).json({ message: 'Unauthorized - no user ID or guest ID provided' });
      return;
    }

    const result = await gameService.resignGame(gameId, playerId);

    if (!result.success || !result.game) {
      res.status(400).json({ message: result.error });
      return;
    }

    broadcastGameCompletion(result.completion);

    res.json({
      message: 'Game resigned successfully',
      game: result.game,
      completion: result.completion ?? null
    });
  } catch (error) {
    console.error('Error resigning game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlayerGames = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { status } = req.query;
    const games = await gameService.getPlayerGames(userId, status as string);

    res.json({ games });
  } catch (error) {
    console.error('Error getting player games:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMatchmakingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isWaiting = matchmakingService.isPlayerWaiting(userId);
    const waitingCount = matchmakingService.getWaitingPlayersCount();

    res.json({ isWaiting, waitingCount });
  } catch (error) {
    console.error('Error getting matchmaking status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlayerGamesSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const games = await gameService.getPlayerGamesSummary(userId);
    res.json({ games });
  } catch (error) {
    console.error('Error getting game summaries:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPerformanceByFormat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const performance = await gameService.getPerformanceByFormat(userId);
    res.json(performance);
  } catch (error) {
    console.error('Error getting performance by format:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ 
      message: 'Failed to fetch performance data',
      error: errorMessage 
    });
  }
};