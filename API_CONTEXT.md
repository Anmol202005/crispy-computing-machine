# Chessy Chess Platform API Context

## Base URL
- **Development:** `http://localhost:8080`
- **Swagger Docs:** `http://localhost:8080/api-docs`

## Authentication
- **Type:** Bearer JWT Token
- **Header:** `Authorization: Bearer <token>`

---

## 🔐 Authentication Endpoints (`/api/auth`)

### Register User
- **POST** `/api/auth/register`
- **Body:** `{ username, email, password }`
- **Response:** User object + JWT token

### Login
- **POST** `/api/auth/login`
- **Body:** `{ email, password }`
- **Response:** User object + JWT token

### Verify Email
- **POST** `/api/auth/verify-email`
- **Body:** `{ email, otp }`
- **Response:** Success message

### Resend OTP
- **POST** `/api/auth/resend-otp`
- **Body:** `{ email }`
- **Response:** Success message

### Forgot Password
- **POST** `/api/auth/forgot-password`
- **Body:** `{ email }`
- **Response:** Success message

### Verify Reset OTP
- **POST** `/api/auth/verify-reset-otp`
- **Body:** `{ email, otp }`
- **Response:** Success message

### Change Password
- **POST** `/api/auth/change-password` 🔒
- **Body:** `{ newPassword }`
- **Response:** Success message

---

## 🎯 Matchmaking Endpoints (`/api/game/matchmaking`)

### Join Matchmaking (Registered)
- **POST** `/api/game/matchmaking/join` 🔒
- **Body:** None (uses user from JWT)
- **Response:** `{ gameId?, isWaiting? }`

### Join Matchmaking (Guest)
- **POST** `/api/game/matchmaking/join-guest`
- **Body:** `{ guestName }`
- **Response:** `{ gameId?, isWaiting?, guestId? }`

### Leave Matchmaking
- **POST** `/api/game/matchmaking/leave` 🔒
- **Body:** None
- **Response:** Success message

### Get Matchmaking Status
- **GET** `/api/game/matchmaking/status` 🔒
- **Response:** `{ isWaiting, waitingCount }`

---

## ♟️ Game Endpoints (`/api/game`)

### Get Player's Games
- **GET** `/api/game/games` 🔒
- **Query:** `?status=active|completed` (optional)
- **Response:** `{ games: [Game[]] }`

### Get Game State
- **GET** `/api/game/{gameId}`
- **Response:** `{ game, legalMoves, isCheck, isCheckmate, isDraw, isGameOver }`

### Make Move
- **POST** `/api/game/{gameId}/move` 🔒
- **Body:** `{ move: { from: "e2", to: "e4", promotion?: "q" } }`
- **Response:** Updated game state

### Resign Game
- **POST** `/api/game/{gameId}/resign` 🔒
- **Body:** None
- **Response:** `{ message, game }`

---

## 🔌 WebSocket Events (Socket.IO)

### Connection
```javascript
const socket = io('http://localhost:8080', {
  auth: {
    token: 'jwt_token', // For registered users
    guestId: 'guest_id'  // For guest users
  }
});
```

### Client Events (Emit)
- `join-game` - `(gameId: string)`
- `make-move` - `{ gameId, move: { from, to, promotion? } }`
- `resign` - `(gameId: string)`
- `chat-message` - `{ gameId, message }`

### Server Events (Listen)
- `game-state` - Current game state
- `move-made` - `{ move, gameState, player }`
- `game-over` - `{ result, winner }`
- `game-resigned` - `{ resignedBy, winner }`
- `players-connected` - `{ whiteConnected, blackConnected, spectatorCount }`
- `chat-message` - `{ player, message, timestamp }`
- `error` - `{ message }`
- `move-error` - `{ message }`

---

## 📊 Data Models

### User
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "elo": "number (default: 300)",
  "isVerified": "boolean",
  "createdAt": "date"
}
```

### Game
```json
{
  "id": "string",
  "whitePlayerId": "string",
  "blackPlayerId": "string",
  "whitePlayerName": "string",
  "blackPlayerName": "string",
  "currentTurn": "white|black",
  "status": "active|completed",
  "fen": "string (chess position)",
  "moves": "string[] (SAN notation)",
  "result": "white_wins|black_wins|draw",
  "winner": "string",
  "isGuestGame": "boolean",
  "createdAt": "date",
  "updatedAt": "date"
}
```

### Move
```json
{
  "from": "string (e.g., 'e2')",
  "to": "string (e.g., 'e4')",
  "promotion": "string? (q|r|b|n)"
}
```

---

## 🎮 Game Flow

1. **Register/Login** → Get JWT token
2. **Join Matchmaking** → Wait for opponent or get `gameId`
3. **Connect to WebSocket** → Join game room
4. **Play Game** → Make moves via WebSocket
5. **Game Ends** → Rating updated (registered users only)

---

## 🔄 Rating System

- **Starting ELO:** 300 for new users, 800 for guests
- **Rating Updates:** Only for registered users
- **K-Factor:** 32 (standard chess rating)
- **Matchmaking:** ±100 ELO range, expands over time

---

## 🎯 Key Features

- ✅ Real-time gameplay with Socket.IO
- ✅ Move validation using chess.js
- ✅ Guest player support (no registration required)
- ✅ ELO rating system for registered users
- ✅ Automatic game cleanup for guests (24h TTL)
- ✅ In-game chat functionality
- ✅ Player connection status tracking
- ✅ Comprehensive API documentation with Swagger

---

**🔒 = Requires Authentication**