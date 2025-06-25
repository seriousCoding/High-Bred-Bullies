// Debug authentication flow
const testAuth = async () => {
  console.log('=== Authentication Debug Test ===');
  
  // Test 1: Health check
  try {
    const healthRes = await fetch('http://localhost:5000/api/health');
    const healthData = await healthRes.json();
    console.log('✓ Health check:', healthData);
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    return;
  }
  
  // Test 2: Login with correct credentials
  try {
    const loginRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'gpass1979@gmail.com',
        password: 'gpass1979'
      })
    });
    
    console.log('Login response status:', loginRes.status);
    console.log('Login response headers:', Object.fromEntries(loginRes.headers.entries()));
    
    const loginData = await loginRes.json();
    console.log('✓ Login response:', loginData);
    
    if (loginData.token) {
      // Test 3: Protected endpoint with token
      const userRes = await fetch('http://localhost:5000/api/user', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const userData = await userRes.json();
      console.log('✓ Protected endpoint test:', userData);
    }
    
  } catch (error) {
    console.error('✗ Login test failed:', error.message);
  }
};

testAuth();