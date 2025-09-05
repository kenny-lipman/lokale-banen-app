// Test script to verify platforms API behavior
// Run with: node test-platforms-api.js

const BASE_URL = 'http://localhost:3003'

async function testPlatformsAPI() {
    console.log('🧪 Testing Platforms API...\n')
    
    try {
        // Test without auth (should fail)
        console.log('1️⃣ Testing /api/platforms without auth...')
        const noAuthResponse = await fetch(`${BASE_URL}/api/platforms`)
        const noAuthData = await noAuthResponse.json()
        console.log('Status:', noAuthResponse.status)
        console.log('Response:', noAuthData)
        
        if (noAuthResponse.status === 401) {
            console.log('✅ Correctly requires authentication\n')
        } else {
            console.log('❌ Should require authentication\n')
        }
        
        // Note: To test with auth, you'd need a valid token
        console.log('💡 To test with authentication:')
        console.log('1. Go to http://localhost:3003/settings in browser')
        console.log('2. Open Network tab and look at the API call')
        console.log('3. Copy the Authorization header')
        console.log('4. Test with curl or add it to this script\n')
        
    } catch (error) {
        console.error('❌ Test failed:', error.message)
    }
}

// Run if called directly
if (require.main === module) {
    testPlatformsAPI()
}

module.exports = { testPlatformsAPI }