// Debug matchmaking - check user details and ELO ratings
async function debugMatchmaking() {
  console.log('🔍 Debugging Matchmaking System\n');

  const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxM2ZmMDUwMDNjZDA2ZjdmMmI1YjIiLCJlbWFpbCI6InZpc2lyZTY5NTNAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTc2MDY0MTA1MSwiZXhwIjoxNzYwNzI3NDUxfQ.cdrYcKT34KkCdWrt4Kv4mLifweRlfvfVo43owUbMRrQ';
  const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxNDA3NzUwMDNjZDA2ZjdmMmI1YmUiLCJlbWFpbCI6Imtld2FkMTUxOTBAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlcjIiLCJpYXQiOjE3NjA2NDExNjAsImV4cCI6MTc2MDcyNzU2MH0.1aYIGKwaUctyJB9_gwSNa7X9blxWTYjk5Z2GFnZRp6s';

  // Decode JWT to see user IDs
  console.log('📋 JWT Token Analysis:');
  const user1Payload = JSON.parse(Buffer.from(user1Token.split('.')[1], 'base64').toString());
  const user2Payload = JSON.parse(Buffer.from(user2Token.split('.')[1], 'base64').toString());

  console.log('User 1:', {
    userId: user1Payload.userId,
    username: user1Payload.username,
    email: user1Payload.email
  });

  console.log('User 2:', {
    userId: user2Payload.userId,
    username: user2Payload.username,
    email: user2Payload.email
  });

  // Check if users are the same
  if (user1Payload.userId === user2Payload.userId) {
    console.log('❌ ERROR: Both tokens are for the same user!');
    return;
  }

  console.log('\n🎮 Testing Guest Matchmaking Instead...\n');

  // Test with guest users to see if the system works
  console.log('1️⃣ Guest 1 joining...');
  const guest1Response = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName: 'DebugGuest1' })
  });
  const guest1Result = await guest1Response.json();
  console.log('Guest 1 response:', guest1Result);

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n2️⃣ Guest 2 joining...');
  const guest2Response = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName: 'DebugGuest2' })
  });
  const guest2Result = await guest2Response.json();
  console.log('Guest 2 response:', guest2Result);

  if (guest2Result.gameId) {
    console.log('✅ Guest matchmaking works! Game created:', guest2Result.gameId);
  } else {
    console.log('❌ Guest matchmaking also failed');
  }
}

debugMatchmaking().catch(console.error);