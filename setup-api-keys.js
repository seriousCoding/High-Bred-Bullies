// Script to set up API keys from environment variables
// This script creates a test user and stores the COINBASE_API_KEY and COINBASE_API_SECRET
// from environment variables as an active API key for that user

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Hash a password
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

async function main() {
  try {
    // Check for required environment variables
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.error('Error: COINBASE_API_KEY and COINBASE_API_SECRET environment variables must be set');
      process.exit(1);
    }
    
    console.log('Setting up API key vault with provided credentials...');
    
    // Create a test user
    const hashedPassword = await hashPassword('testuser123');
    
    // Check if test user already exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      ['testuser']
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // Create the user
      const insertUserResult = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
        ['testuser', hashedPassword]
      );
      userId = insertUserResult.rows[0].id;
      console.log(`Created test user with ID ${userId}`);
    } else {
      userId = userResult.rows[0].id;
      console.log(`Using existing test user with ID ${userId}`);
    }
    
    // Check if API key already exists for this user
    const keyResult = await pool.query(
      'SELECT id FROM api_keys WHERE user_id = $1 AND api_key = $2',
      [userId, apiKey]
    );
    
    if (keyResult.rows.length === 0) {
      // Insert the API key
      const now = new Date();
      const insertKeyResult = await pool.query(
        `INSERT INTO api_keys 
         (user_id, api_key, api_secret, is_active, label, priority, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [userId, apiKey, apiSecret, true, 'Coinbase API Key', 10, now]
      );
      
      const keyId = insertKeyResult.rows[0].id;
      console.log(`Added API key with ID ${keyId} for user ${userId}`);
    } else {
      const keyId = keyResult.rows[0].id;
      
      // Update the existing key
      await pool.query(
        `UPDATE api_keys 
         SET api_secret = $1, is_active = true, priority = 10 
         WHERE id = $2`,
        [apiSecret, keyId]
      );
      
      console.log(`Updated existing API key with ID ${keyId} for user ${userId}`);
    }
    
    console.log('API keys set up successfully! You can now use the application.');
    
  } catch (error) {
    console.error('Error setting up API keys:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();