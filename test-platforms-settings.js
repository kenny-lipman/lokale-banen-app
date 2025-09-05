// Test script to verify platforms API returns all platforms
const fetch = require('node-fetch');

async function testPlatformsAPI() {
  try {
    // First get auth token
    const authResponse = await fetch('http://localhost:3001/api/auth/session', {
      credentials: 'include'
    });
    
    if (!authResponse.ok) {
      console.log('No active session, please login first');
      return;
    }
    
    const session = await authResponse.json();
    
    if (!session?.access_token) {
      console.log('No access token in session');
      return;
    }
    
    // Test platforms endpoint
    const platformsResponse = await fetch('http://localhost:3001/api/platforms', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!platformsResponse.ok) {
      console.log('Failed to fetch platforms:', platformsResponse.status);
      return;
    }
    
    const data = await platformsResponse.json();
    console.log('Total platforms returned:', data.platforms?.length);
    console.log('Platforms with automation_enabled=true:', data.platforms?.filter(p => p.automation_enabled).length);
    console.log('Platforms with automation_enabled=false:', data.platforms?.filter(p => !p.automation_enabled).length);
    
    // Show platforms with automation_enabled=false
    const disabledPlatforms = data.platforms?.filter(p => !p.automation_enabled);
    if (disabledPlatforms?.length > 0) {
      console.log('\nPlatforms with automation_enabled=false:');
      disabledPlatforms.forEach(p => {
        console.log(`  - ${p.regio_platform}: automation_enabled=${p.automation_enabled}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing platforms API:', error);
  }
}

testPlatformsAPI();