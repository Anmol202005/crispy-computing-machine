// Simple test with longer wait time to see if ELO range expansion works
async function testSimpleMatchmaking() {
  console.log('🔍 Simple Matchmaking Test with ELO Range Expansion\n');

  const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxM2ZmMDUwMDNjZDA2ZjdmMmI1YjIiLCJlbWFpbCI6InZpc2lyZTY5NTNAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlhdCI6MTc2MDY0MTA1MSwiZXhwIjoxNzYwNzI3NDUxfQ.cdrYcKT34KkCdWrt4Kv4mLifweRlfvfVo43owUbMRrQ';
  const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYxNDA3NzUwMDNjZDA2ZjdmMmI1YmUiLCJlbWFpbCI6Imtld2FkMTUxOTBAbWVtZWF6b24uY29tIiwidXNlcm5hbWUiOiJ0ZXN0dXNlcjIiLCJpYXQiOjE3NjA2NDExNjAsImV4cCI6MTc2MDcyNzU2MH0.1aYIGKwaUctyJB9_gwSNa7X9blxWTYjk5Z2GFnZRp6s';

  try {
    // Clear any existing queue
    console.log('🧹 Clearing existing matchmaking queue...');
    await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/leave', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user1Token}` }
    });
    await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/leave', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // User 1 joins
    console.log('1️⃣ User 1 joining matchmaking...');
    const response1 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const result1 = await response1.json();
    console.log('User 1 response:', result1);

    // Wait 10 seconds for ELO range to expand (base: 100, increment: 50 every 5 seconds)
    console.log('\n⏳ Waiting 10 seconds for ELO range expansion...');
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');

    // User 2 joins after ELO range has expanded
    console.log('2️⃣ User 2 joining matchmaking (after ELO expansion)...');
    const response2 = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user2Token}`
      }
    });
    const result2 = await response2.json();
    console.log('User 2 response:', result2);

    if (result2.gameId) {
      console.log('✅ Match found after ELO expansion! Game ID:', result2.gameId);

      // Clean up
      console.log('\n🧹 Cleaning up game...');
      await fetch(`https://tomatowithchilli.duckdns.org/api/game/${result2.gameId}/resign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user1Token}` }
      });
      console.log('✅ Game cleaned up');
    } else {
      console.log('❌ Still no match even after ELO expansion');

      // Check final status
      const statusResponse = await fetch('https://tomatowithchilli.duckdns.org/api/game/matchmaking/status', {
        headers: { 'Authorization': `Bearer ${user1Token}` }
      });
      const status = await statusResponse.json();
      console.log('Final status:', status);
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testSimpleMatchmaking();