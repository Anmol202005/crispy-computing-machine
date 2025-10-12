"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const options = {
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
const specs = (0, swagger_jsdoc_1.default)(options);
const setupSwagger = (app) => {
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs, {
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
exports.setupSwagger = setupSwagger;
exports.default = specs;
