// This script adds the API keys from environment variables to the database

import { db } from './server/db';
import { apiKeys } from './shared/schema';

async function setupApiKeys() {
  try {
    console.log('Adding Coinbase API keys to database...');
    
    // Check if we have the environment variables
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.error('Missing API key or secret in environment variables');
      process.exit(1);
    }
    
    // Insert primary key
    await db.insert(apiKeys).values({
      userId: 1,
      apiKey: apiKey,
      apiSecret: apiSecret,
      label: 'Primary API Key',
      priority: 10,
      isActive: true,
      failCount: 0
    }).onConflictDoUpdate({
      target: [apiKeys.userId, apiKeys.apiKey],
      set: {
        apiSecret: apiSecret,
        isActive: true,
        priority: 10
      }
    });
    
    console.log('API keys added to database successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding API keys to database:', error);
    process.exit(1);
  }
}

setupApiKeys();