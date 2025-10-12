"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("./config/database");
const swagger_1 = require("./config/swagger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const game_routes_1 = __importDefault(require("./routes/game.routes"));
const sockets_1 = require("./sockets");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});
const PORT = process.env.PORT || 5000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        connectedPlayers: sockets_1.gameSocketService.getConnectedPlayers(),
        activeGames: sockets_1.gameSocketService.getActiveGames()
    });
});
(0, swagger_1.setupSwagger)(app);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/game', game_routes_1.default);
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
sockets_1.gameSocketService.setupSocket(io);
const startServer = async () => {
    try {
        await (0, database_1.connectDatabase)();
        httpServer.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API Base URL: http://localhost:${PORT}/api`);
            console.log(`WebSocket server ready for connections`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
startServer();
