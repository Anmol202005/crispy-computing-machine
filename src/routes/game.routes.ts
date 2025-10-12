import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  joinMatchmaking,
  joinGuestMatchmaking,
  leaveMatchmaking,
  getGame,
  makeMove,
  resignGame,
  getPlayerGames,
  getMatchmakingStatus
} from '../controllers/game.controller';

const router = Router();

/**
 * @swagger
 * /api/game/matchmaking/join:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Join matchmaking queue
 *     description: Join the matchmaking queue to find an opponent based on ELO rating
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully joined matchmaking or found a match
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchmakingResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/matchmaking/join', authenticateToken, joinMatchmaking);

/**
 * @swagger
 * /api/game/matchmaking/join-guest:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Join matchmaking as guest
 *     description: Join matchmaking queue as a guest player without registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestName
 *             properties:
 *               guestName:
 *                 type: string
 *                 minLength: 2
 *                 example: 'GuestPlayer123'
 *     responses:
 *       200:
 *         description: Successfully joined matchmaking as guest
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/MatchmakingResponse'
 *                 - type: object
 *                   properties:
 *                     guestId:
 *                       type: string
 *       400:
 *         description: Invalid guest name
 */
router.post('/matchmaking/join-guest', joinGuestMatchmaking);

/**
 * @swagger
 * /api/game/matchmaking/leave:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Leave matchmaking queue
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully left matchmaking queue
 *       401:
 *         description: Unauthorized
 */
router.post('/matchmaking/leave', authenticateToken, leaveMatchmaking);

/**
 * @swagger
 * /api/game/matchmaking/status:
 *   get:
 *     tags:
 *       - Matchmaking
 *     summary: Get matchmaking status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current matchmaking status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isWaiting:
 *                   type: boolean
 *                 waitingCount:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/matchmaking/status', authenticateToken, getMatchmakingStatus);

/**
 * @swagger
 * /api/game/games:
 *   get:
 *     tags:
 *       - Games
 *     summary: Get player's games
 *     description: Retrieve all games for the authenticated player
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *         description: Filter games by status
 *     responses:
 *       200:
 *         description: List of player's games
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Game'
 *       401:
 *         description: Unauthorized
 */
router.get('/games', authenticateToken, getPlayerGames);

/**
 * @swagger
 * /api/game/{gameId}:
 *   get:
 *     tags:
 *       - Games
 *     summary: Get game state
 *     description: Retrieve current state of a specific game
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The game ID
 *     responses:
 *       200:
 *         description: Current game state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       404:
 *         description: Game not found
 */
router.get('/:gameId', getGame);

/**
 * @swagger
 * /api/game/{gameId}/move:
 *   post:
 *     tags:
 *       - Games
 *     summary: Make a move
 *     description: Make a chess move in the specified game
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The game ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - move
 *             properties:
 *               move:
 *                 $ref: '#/components/schemas/Move'
 *     responses:
 *       200:
 *         description: Move made successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameState'
 *       400:
 *         description: Invalid move or not player's turn
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/move', authenticateToken, makeMove);

/**
 * @swagger
 * /api/game/{gameId}/resign:
 *   post:
 *     tags:
 *       - Games
 *     summary: Resign from game
 *     description: Resign from the specified game
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The game ID
 *     responses:
 *       200:
 *         description: Game resigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 game:
 *                   $ref: '#/components/schemas/Game'
 *       400:
 *         description: Cannot resign from this game
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Game not found
 */
router.post('/:gameId/resign', authenticateToken, resignGame);

export default router;