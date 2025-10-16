import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chessy API',
      version: '1.0.0',
      description: 'A chess platform API with real-time gameplay, matchmaking, and rating system',
      contact: {
        name: 'Chess Platform',
        url: 'https://github.com/your-repo/chessy'
      }
    },
    servers: [
      {
        url: process.env.SERVER_URL || 'http://localhost:8080',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            elo: { type: 'number', default: 300 },
            createdAt: { type: 'string', format: 'date-time' },
            isVerified: { type: 'boolean' }
          }
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            whitePlayerId: { type: 'string' },
            blackPlayerId: { type: 'string' },
            whitePlayerName: { type: 'string' },
            blackPlayerName: { type: 'string' },
            currentTurn: { type: 'string', enum: ['white', 'black'] },
            status: { type: 'string', enum: ['active', 'completed'] },
            fen: { type: 'string' },
            moves: { type: 'array', items: { type: 'string' } },
            result: { type: 'string', enum: ['white_wins', 'black_wins', 'draw'] },
            winner: { type: 'string' },
            isGuestGame: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        GameState: {
          type: 'object',
          properties: {
            game: { $ref: '#/components/schemas/Game' },
            legalMoves: { type: 'array', items: { type: 'string' } },
            isCheck: { type: 'boolean' },
            isCheckmate: { type: 'boolean' },
            isDraw: { type: 'boolean' },
            isGameOver: { type: 'boolean' }
          }
        },
        Move: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', example: 'e2' },
            to: { type: 'string', example: 'e4' },
            promotion: { type: 'string', enum: ['q', 'r', 'b', 'n'] }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        MatchmakingResponse: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            isWaiting: { type: 'boolean' },
            guestId: { type: 'string' }
          }
        },
        MatchmakingNotification: {
          type: 'object',
          properties: {
            gameId: { type: 'string', description: 'The ID of the newly created game' },
            opponent: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                username: { type: 'string' },
                isGuest: { type: 'boolean' }
              }
            }
          },
          description: 'WebSocket notification sent when a match is found'
        },
        WebSocketEvents: {
          type: 'object',
          description: 'WebSocket Events Documentation',
          properties: {
            client_events: {
              type: 'object',
              description: 'Events that clients can emit',
              properties: {
                'join-game': { type: 'string', description: 'Join a game room with gameId' },
                'make-move': { type: 'object', description: 'Make a chess move' },
                'resign': { type: 'string', description: 'Resign from game with gameId' },
                'chat-message': { type: 'object', description: 'Send chat message' }
              }
            },
            server_events: {
              type: 'object',
              description: 'Events that server emits to clients',
              properties: {
                'matchmaking-found': { $ref: '#/components/schemas/MatchmakingNotification' },
                'game-state': { type: 'object', description: 'Current game state' },
                'move-made': { type: 'object', description: 'Move made by player' },
                'game-over': { type: 'object', description: 'Game ended' },
                'game-resigned': { type: 'object', description: 'Player resigned' },
                'players-connected': { type: 'object', description: 'Player connection status' },
                'chat-message': { type: 'object', description: 'Chat message received' },
                'error': { type: 'object', description: 'Error message' },
                'move-error': { type: 'object', description: 'Invalid move error' }
              }
            }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

const specs = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chessy API Documentation',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true
    }
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📖 Swagger docs available at: /api-docs`);
};

export default specs;