# Chessy Chess Platform

A professional real-time chess platform built with Node.js, TypeScript, and Socket.IO, featuring both registered user accounts and guest play capabilities.

## Features

- **Real-time Gameplay**: WebSocket-based game sessions with live move synchronization
- **Dual User System**: Support for both registered users and guest players
- **ELO Rating System**: Competitive rating calculation for registered users
- **Intelligent Matchmaking**: Automated opponent matching with ELO-based pairing
- **Email Verification**: Secure account verification with OTP-based authentication
- **Password Management**: Complete forgot password and password reset functionality
- **Move Validation**: Chess rule enforcement using chess.js library
- **Game Persistence**: MongoDB-based game state storage and history
- **RESTful API**: Comprehensive REST endpoints with Swagger documentation
- **Real-time Chat**: In-game messaging system
- **Connection Monitoring**: Player connection status tracking
- **Automatic Cleanup**: Guest game expiration and cleanup system

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time Communication**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Password Security**: bcryptjs hashing
- **Email Service**: Nodemailer
- **Game Logic**: chess.js for move validation
- **API Documentation**: Swagger with swagger-jsdoc and swagger-ui-express

### Development Tools
- **Language**: TypeScript 5.9.3
- **Development Server**: ts-node-dev with hot reload
- **Package Manager**: npm
- **CORS**: Configurable cross-origin resource sharing

## Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # MongoDB connection setup
│   └── swagger.ts   # Swagger API documentation config
├── controllers/     # Business logic controllers
│   └── auth.ts      # Authentication controller
├── middleware/      # Express middleware
│   └── auth.ts      # JWT authentication middleware
├── models/          # Database models
│   ├── user.ts      # User data model
│   ├── game.models.ts # Game data model
│   └── otp.ts       # OTP verification model
├── routes/          # API route definitions
│   ├── auth.routes.ts # Authentication routes
│   └── game.routes.ts # Game management routes
├── services/        # Business logic services
│   └── otp.service.ts # OTP generation and verification
├── sockets/         # WebSocket event handlers
├── types/           # TypeScript type definitions
│   ├── authRequest.ts # Authentication request types
│   ├── jwtRequest.ts  # JWT payload types
│   ├── user.ts        # User interface types
│   └── index.ts       # Type exports
└── server.ts        # Application entry point
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB database
- npm package manager

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chessy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=8080
   DATABASE_URL=mongodb://localhost:27017/chessy
   JWT_SECRET=your_jwt_secret_key
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   EMAIL_FROM=Chess Platform <noreply@yoursite.com>
   CLIENT_URL=http://localhost:3000
   ```

4. **Build the application**
   ```bash
   npm run build
   ```

## Development

### Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:8080` with hot reload enabled.

### Build for Production
```bash
npm run build
npm start
```

### API Documentation
Access the interactive Swagger documentation at:
- Development: `http://localhost:8080/api-docs`
- Production: `https://your-domain.com/api-docs`

## API Overview

### Authentication Endpoints (`/api/auth`)
- `POST /register` - User registration with email verification
- `POST /login` - User authentication
- `POST /verify-email` - Email verification with OTP
- `POST /resend-otp` - Resend verification OTP
- `POST /forgot-password` - Password reset request
- `POST /verify-reset-otp` - Verify password reset OTP
- `POST /change-password` - Update user password (authenticated)

### Game Management (`/api/game`)
- `GET /games` - Retrieve user's game history (authenticated)
- `GET /{gameId}` - Get specific game state
- `POST /{gameId}/move` - Make a chess move (authenticated)
- `POST /{gameId}/resign` - Resign from game (authenticated)

### Matchmaking (`/api/game/matchmaking`)
- `POST /join` - Join matchmaking queue (authenticated)
- `POST /join-guest` - Join as guest player
- `POST /leave` - Leave matchmaking queue (authenticated)
- `GET /status` - Get matchmaking status (authenticated)

### Health Check
- `GET /health` - Server status and statistics

## WebSocket Events

### Client to Server
- `join-game` - Join a specific game room
- `make-move` - Submit a chess move
- `resign` - Resign from current game
- `chat-message` - Send in-game message

### Server to Client
- `game-state` - Current game position and status
- `move-made` - Opponent move notification
- `game-over` - Game completion notification
- `game-resigned` - Resignation notification
- `players-connected` - Connection status updates
- `chat-message` - Incoming chat message
- `error` - Error notifications
- `move-error` - Invalid move notifications

## Game Features

### User Types
- **Registered Users**: Full feature access with persistent ELO ratings
- **Guest Players**: Temporary access with basic game functionality

### Rating System
- Starting ELO: 300 (registered), 800 (guests)
- K-factor: 32 (standard chess rating calculation)
- Rating updates: Registered users only

### Matchmaking Algorithm
- ELO-based pairing (±100 rating range)
- Expanding search range over time
- Support for mixed registered/guest games

### Game Persistence
- Complete game history storage
- Move-by-move recording in SAN notation
- FEN position tracking
- Automatic guest game cleanup (24-hour TTL)

## Security Features

- JWT-based authentication with configurable expiration
- Bcrypt password hashing with salt rounds
- Email verification for account security
- OTP-based password reset mechanism
- CORS configuration for cross-origin requests
- Request validation and sanitization

## Monitoring and Health

The `/health` endpoint provides:
- Server operational status
- Connected player count
- Active game statistics
- Timestamp information

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please create an issue in the repository or contact the development team.