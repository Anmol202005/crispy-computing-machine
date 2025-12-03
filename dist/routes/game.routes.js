"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const game_controller_1 = require("../controllers/game.controller");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /websocket:
 *   get:
 *     tags:
 *       - WebSocket
 *     summary: WebSocket Connection & Events
 *     description: |
 *       ## WebSocket Connection
 *
 *       Connect to: `wss://tomatowithchilli.duckdns.org` or `ws://localhost:8080`
 *
 *       **Authentication:**
 *       ```javascript
 *       // For registered users
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { token: 'your_jwt_token' }
 *       });
 *
 *       // For guest users
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { guestId: 'your_guest_id' }
 *       });
 *       ```
 *
 *       ## Server Events (Listen)
 *
 *       **Matchmaking Events:**
 *       - `matchmaking-found` - Receive match notification with gameId and opponent info
 *
 *       **Game Events:**
 *       - `game-state` - Current game state when joining a game
 *       - `move-made` - Opponent made a move
 *       - `game-over` - Game ended (checkmate, draw, etc.)
 *       - `game-resigned` - Opponent resigned
 *       - `players-connected` - Player connection status updates
 *
 *       **Chat Events:**
 *       - `chat-message` - Receive chat messages from opponent
 *
 *       **Error Events:**
 *       - `error` - General errors
 *       - `move-error` - Invalid move attempts
 *
 *       ## Client Events (Emit)
 *
 *       **Game Events:**
 *       - `join-game` - Join a game room: `socket.emit('join-game', gameId)`
 *       - `make-move` - Make a move: `socket.emit('make-move', { gameId, move })`
 *       - `resign` - Resign from game: `socket.emit('resign', gameId)`
 *
 *       **Chat Events:**
 *       - `chat-message` - Send chat: `socket.emit('chat-message', { gameId, message })`
 *
 *       ## Matchmaking Flow Example
 *
 *       ```javascript
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { token: 'jwt_token' }
 *       });
 *
 *       // Listen for match notifications
 *       socket.on('matchmaking-found', (data) => {
 *         console.log('Match found!');
 *         console.log('Game ID:', data.gameId);
 *         console.log('Opponent:', data.opponent.username);
 *
 *         // Join the game room
 *         socket.emit('join-game', data.gameId);
 *       });
 *
 *       // Join matchmaking via REST API
 *       fetch('/api/game/matchmaking/join', {
 *         method: 'POST',
 *         headers: { 'Authorization': 'Bearer ' + token }
 *       });
 *       ```
 *
 *     responses:
 *       200:
 *         description: WebSocket connection established
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebSocketEvents'
 */
/**
 * @swagger
 * /api/game/matchmaking/join:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Join matchmaking queue
 *     description: |
 *       Join the matchmaking queue to find an opponent based on ELO rating.
 *
 *       **Important**: Connect to WebSocket first to receive real-time match notifications!
 *
 *       **WebSocket Flow:**
 *       1. Connect to WebSocket with JWT token
 *       2. Listen for `matchmaking-found` event
 *       3. Call this endpoint to join matchmaking
 *       4. Receive notification when matched with opponent
 *
 *       **Example:**
 *       ```javascript
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { token: 'your_jwt_token' }
 *       });
 *
 *       socket.on('matchmaking-found', (data) => {
 *         console.log('Match found!', data.gameId);
 *         // Redirect to game
 *       });
 *       ```
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: |
 *           Successfully joined matchmaking or found a match.
 *           - If `isWaiting: true` - you're in queue, wait for WebSocket notification
 *           - If `gameId` present - immediate match found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchmakingResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/matchmaking/join', auth_1.authenticateToken, game_controller_1.joinMatchmaking);
/**
 * @swagger
 * /api/game/guest/register:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Register as guest and get guest ID
 *     description: |
 *       **Step 1 of guest flow**: Register as a guest player and receive a unique guest ID.
 *       Use this ID to connect to WebSocket before joining matchmaking.
 *
 *       **Complete Guest Flow:**
 *       1. Call this endpoint to get guestId
 *       2. Connect to WebSocket with guestId
 *       3. Call `/matchmaking/join-guest` with guestId and socketId
 *       4. Wait for `matchmaking-found` event
 *
 *       **Example:**
 *       ```javascript
 *       // Step 1: Register
 *       const response = await fetch('/api/game/guest/register', {
 *         method: 'POST',
 *         body: JSON.stringify({ guestName: 'Player1' })
 *       });
 *       const { guestId } = await response.json();
 *
 *       // Step 2: Connect socket
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { guestId }
 *       });
 *
 *       // Step 3: Join matchmaking (after socket connects)
 *       socket.on('connect', () => {
 *         fetch('/api/game/matchmaking/join-guest', {
 *           method: 'POST',
 *           body: JSON.stringify({
 *             guestId,
 *             socketId: socket.id,
 *             guestName: 'Player1'
 *           })
 *         });
 *       });
 *       ```
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
 *         description: Guest ID generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guestId:
 *                   type: string
 *                   example: 'guest_1234567890_abc123'
 *       400:
 *         description: Invalid guest name
 */
router.post('/guest/register', game_controller_1.registerGuest);
/**
 * @swagger
 * /api/game/matchmaking/join-guest:
 *   post:
 *     tags:
 *       - Matchmaking
 *     summary: Join matchmaking as guest
 *     description: |
 *       Join matchmaking queue as a guest player without registration.
 *
 *       **Important**: Connect to WebSocket first to receive real-time match notifications!
 *
 *       **WebSocket Flow for Guests:**
 *       1. Connect to WebSocket with guestId (returned from this endpoint)
 *       2. Listen for `matchmaking-found` event
 *       3. Receive notification when matched with opponent
 *
 *       **Example:**
 *       ```javascript
 *       // After calling this endpoint and getting guestId
 *       const socket = io('wss://tomatowithchilli.duckdns.org', {
 *         auth: { guestId: 'your_guest_id' }
 *       });
 *
 *       socket.on('matchmaking-found', (data) => {
 *         console.log('Match found!', data.gameId);
 *       });
 *       ```
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
router.post('/matchmaking/join-guest', game_controller_1.joinGuestMatchmaking);
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
router.post('/matchmaking/leave', auth_1.authenticateToken, game_controller_1.leaveMatchmaking);
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
router.get('/matchmaking/status', auth_1.authenticateToken, game_controller_1.getMatchmakingStatus);
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
router.get('/games', auth_1.authenticateToken, game_controller_1.getPlayerGames);
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
router.get('/:gameId', game_controller_1.getGame);
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
router.post('/:gameId/move', auth_1.authenticateToken, game_controller_1.makeMove);
/**
 * @swagger
 * /api/game/{gameId}/resign:
 *   post:
 *     tags:
 *       - Games
 *     summary: Resign from game
 *     description: |
 *       Resign from the specified game. Works for both authenticated and guest users.
 *
 *       **For authenticated users:** Include JWT token in Authorization header
 *       **For guest users:** Include guestId in request body
 *
 *       **Example (Guest):**
 *       ```javascript
 *       fetch('/api/game/{gameId}/resign', {
 *         method: 'POST',
 *         body: JSON.stringify({ guestId: 'guest_123...' })
 *       });
 *       ```
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The game ID
 *     requestBody:
 *       description: Required for guest users
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestId:
 *                 type: string
 *                 example: 'guest_1234567890_abc123'
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
 *         description: Unauthorized - userId or guestId required
 *       404:
 *         description: Game not found
 */
// Resign endpoint - supports both authenticated users and guests
// Uses optional auth: populates req.user if token provided, allows guests otherwise
router.post('/:gameId/resign', auth_1.optionalAuth, game_controller_1.resignGame);
exports.default = router;
