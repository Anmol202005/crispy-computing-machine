












































const io = require('socket.io-client');

// Test matchmaking with two users and WebSocket notifications
async function testTwoUserMatchmaking() {
  console.log('🎯 Testing Two User Matchmaking with WebSocket Notifications\n');

  // User tokens (replace with actual tokens if needed)
  const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxM2ZmMDUwMDNjZDA2ZjdmMmI1YjIiLCJlbWFpbCI6InZpc2lyZTY5NTNAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTc2MDY0MTA1MSwiZXhwIjoxNzYwNzI3NDUxfQ.cdrYcKT34KkCdWrt4Kv4mLifweRlfvfVo43owUbMRrQ';
  const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxNDA3NzUwMDNjZDA2ZjdmMmI1YmUiLCJlbWFpbCI6Imtld2FkMTUxOTBAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlcjIiLCJpYXQiOjE3NjA2NDExNjAsImV4cCI6MTc2MDcyNzU2MH0.1aYIGKwaUctyJB9_gwSNa7X9blxWTYjk5Z2GFnZRp6s';

  // Connect User 1 to WebSocket
  console.log('1️⃣ Connecting User 1 (testuser) to WebSocket...');
  const socket1 = io('https://tomatowithchilli.duckdns.org', {
    auth: { token: user1Token }
  });

  // Connect User 2 to WebSocket
  console.log('2️⃣ Connecting User 2 (testuser2) to WebSocket...');
  const socket2 = io('https://tomatowithchilli.duckdns.org', {
    auth: { token: user2Token }
  });

  // Set up WebSocket event listeners
  socket1.on('connect', () => {
    console.log('✅ User 1 connected to WebSocket');
  });

  socket2.on('connect', () => {
    console.log('✅ User 2 connected to WebSocket');
  });

  socket1.on('connect_error', (error) => {
    console.log('❌ User 1 WebSocket error:', error.message);












































const io = require('socket.io-client');

// Test matchmaking with two users and WebSocket notifications
async function testTwoUserMatchmaking() {
  console.log('🎯 Testing Two User Matchmaking with WebSocket Notifications\n');

  // User tokens (replace with actual tokens if needed)
  const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxM2ZmMDUwMDNjZDA2ZjdmMmI1YjIiLCJlbWFpbCI6InZpc2lyZTY5NTNAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTc2MDY0MTA1MSwiZXhwIjoxNzYwNzI3NDUxfQ.cdrYcKT34KkCdWrt4Kv4mLifweRlfvfVo43owUbMRrQ';
  const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxNDA3NzUwMDNjZDA2ZjdmMmI1YmUiLCJlbWFpbCI6Imtld2FkMTUxOTBAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlcjIiLCJpYXQiOjE3NjA2NDExNjAsImV4cCI6MTc2MDcyNzU2MH0.1aYIGKwaUctyJB9_gwSNa7X9blxWTYjk5Z2GFnZRp6s';

  // Connect User 1 to WebSocket
  console.log('1️⃣ Connecting User 1 (testuser) to WebSocket...');
  const socket1 = io('https://tomatowithchilli.duckdns.org', {
    auth: { token: user1Token }
  });

  // Connect User 2 to WebSocket
  console.log('2️⃣ Connecting User 2 (testuser2) to WebSocket...');
  const socket2 = io('https://tomatowithchilli.duckdns.org', {
    auth: { token: user2Token }
  });

  // Set up WebSocket event listeners
  socket1.on('connect', () => {
    console.log('✅ User 1 connected to WebSocket');
  });

  socket2.on('connect', () => {
    console.log('✅ User 2 connected to WebSocket');
  });

  socket1.on('connect_error', (error) => {
    console.log('❌ User 1 WebSocket error:', error.message);
  });

  socket2.on('connect_error', (error) => {
    console.log('❌ User 2 WebSocket error:', error.message);
  });

  // Listen for matchmaking notifications
  socket1.on('matchmaking-found', (data) => {
    console.log('🎯 User 1 received matchmaking notification!');
    console.log('   Game ID:', data.gameId);
    console.log('   Opponent:', data.opponent.username);
    console.log('   Opponent is guest:', data.opponent.isGuest);
  });

  socket2.on('matchmaking-found', (data) => {
    console.log('🎯 User 2 received matchmaking notification!');
    console.log('   Game ID:', data.gameId);
    console.log('   Opponent:', data.opponent.username);
    console.log('   Opponent is guest:', data.opponent.isGuest);
  });

  // Wait for connections to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📡 WebSocket connections established. Starting matchmaking test...\n');

  try {
    // Step 1: User 1 joins matchmaking (should wait)
    console.log('🔄 Step 1: User 1 joining matchmaking...');
    const response1 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const result1 = await response1.json();
    console.log('   Response:', result1);

    if (result1.isWaiting) {
      console.log('✅ User 1 is waiting in matchmaking queue');
    } else {
      console.log('⚠️  User 1 got immediate match (unexpected)');
    }

    // Wait 3 seconds before User 2 joins
    console.log('\n⏳ Waiting 3 seconds before User 2 joins...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: User 2 joins matchmaking (should create match)
    console.log('🔄 Step 2: User 2 joining matchmaking...');
    const response2 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user2Token}`
      }
    });
    const result2 = await response2.json();
    console.log('   Response:', result2);

    if (result2.gameId) {
      console.log('✅ Match created! Game ID:', result2.gameId);
      console.log('🔔 Both users should receive WebSocket notifications...');
    } else {
      console.log('❌ No match created (unexpected)');
    }

    // Wait for notifications to be received
    console.log('\n⏳ Waiting 5 seconds for WebSocket notifications...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Check matchmaking status (should be empty)
    console.log('🔄 Step 3: Checking matchmaking status...');
    const statusResponse = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/status', {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const status = await statusResponse.json();
    console.log('   Status:', status);

    if (!status.isWaiting && status.waitingCount === 0) {
      console.log('✅ Matchmaking queue is empty (both users matched)');
    } else {
      console.log('⚠️  Matchmaking queue still has waiting players');
    }

    // Step 4: Clean up - resign from the game
    if (result2.gameId) {
      console.log('\n🧹 Step 4: Cleaning up - resigning from game...');
      const resignResponse = await fetch(`https://tomatowithchilli.duckdns.org/api/game/${result2.gameId}/resign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      const resignResult = await resignResponse.json();
      console.log('   Resignation result:', resignResult.message);
    }

  } catch (error) {
    console.log('❌ Error during matchmaking test:', error.message);
  }

  // Disconnect WebSockets
  console.log('\n🔌 Disconnecting WebSocket connections...');
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n🎉 Two User Matchmaking Test Completed!');
}

// Run the test
testTwoUserMatchmaking().catch(error => {
  console.error('❌ Test failed:', error);
});
  });

  socket2.on('connect_error', (error) => {
    console.log('❌ User 2 WebSocket error:', error.message);
  });

  // Listen for matchmaking notifications
  socket1.on('matchmaking-found', (data) => {
    console.log('🎯 User 1 received matchmaking notification!');
    console.log('   Game ID:', data.gameId);
    console.log('   Opponent:', data.opponent.username);
    console.log('   Opponent is guest:', data.opponent.isGuest);
  });

  socket2.on('matchmaking-found', (data) => {
    console.log('🎯 User 2 received matchmaking notification!');
    console.log('   Game ID:', data.gameId);
    console.log('   Opponent:', data.opponent.username);
    console.log('   Opponent is guest:', data.opponent.isGuest);
  });

  // Wait for connections to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📡 WebSocket connections established. Starting matchmaking test...\n');

  try {
    // Step 1: User 1 joins matchmaking (should wait)
    console.log('🔄 Step 1: User 1 joining matchmaking...');
    const response1 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const result1 = await response1.json();
    console.log('   Response:', result1);

    if (result1.isWaiting) {
      console.log('✅ User 1 is waiting in matchmaking queue');
    } else {
      console.log('⚠️  User 1 got immediate match (unexpected)');
    }

    // Wait 3 seconds before User 2 joins
    console.log('\n⏳ Waiting 3 seconds before User 2 joins...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: User 2 joins matchmaking (should create match)
    console.log('🔄 Step 2: User 2 joining matchmaking...');
    const response2 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user2Token}`
      }
    });
    const result2 = await response2.json();
    console.log('   Response:', result2);

    if (result2.gameId) {
      console.log('✅ Match created! Game ID:', result2.gameId);
      console.log('🔔 Both users should receive WebSocket notifications...');
    } else {
      console.log('❌ No match created (unexpected)');
    }

    // Wait for notifications to be received
    console.log('\n⏳ Waiting 5 seconds for WebSocket notifications...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Check matchmaking status (should be empty)
    console.log('🔄 Step 3: Checking matchmaking status...');
    const statusResponse = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/status', {
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const status = await statusResponse.json();
    console.log('   Status:', status);

    if (!status.isWaiting && status.waitingCount === 0) {
      console.log('✅ Matchmaking queue is empty (both users matched)');
    } else {
      console.log('⚠️  Matchmaking queue still has waiting players');
    }

    // Step 4: Clean up - resign from the game
    if (result2.gameId) {
      console.log('\n🧹 Step 4: Cleaning up - resigning from game...');
      const resignResponse = await fetch(`https://tomatowithchilli.duckdns.org/api/game/${result2.gameId}/resign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      const resignResult = await resignResponse.json();
      console.log('   Resignation result:', resignResult.message);
    }

  } catch (error) {
    console.log('❌ Error during matchmaking test:', error.message);
  }

  // Disconnect WebSockets
  console.log('\n🔌 Disconnecting WebSocket connections...');
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n🎉 Two User Matchmaking Test Completed!');
}

// Run the test
testTwoUserMatchmaking().catch(error => {
  console.error('❌ Test failed:', error);
});