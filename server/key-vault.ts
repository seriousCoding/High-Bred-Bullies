import crypto from 'crypto';
import { storage } from './storage';
import { ApiKey } from '@shared/schema';

/**
 * Class that manages API keys securely
 * Provides rotation logic and fallback mechanisms
 */
export class KeyVault {
  // Track keys that recently failed
  private lastFailedKeyId: number | null = null;
  
  // Set of key IDs used in the current rotation cycle
  private usedKeyIds: Set<number> = new Set();
  
  // Key cache to avoid repeated database lookups
  private keyCache: Map<number, ApiKey> = new Map();
  
  constructor() {
    console.log('Initializing KeyVault for secure API key management');
  }
  
  /**
   * Reset the key rotation state
   */
  public resetRotation(): void {
    this.lastFailedKeyId = null;
    this.usedKeyIds.clear();
    this.keyCache.clear();
    console.log('Key rotation state reset');
  }
  
  /**
   * Get the next available API key for a user with rotation
   * Will select keys based on priority, health, and avoid recently failed keys
   */
  public async getNextKey(userId: number): Promise<{ apiKey: string, apiSecret: string, keyId: number } | null> {
    try {
      // Clear the used keys if we've cycled through all available keys
      if (this.usedKeyIds.size > 0) {
        // Check if we need to reset rotation (if too many keys have been used)
        const allKeys = await storage.getActiveApiKeys(userId);
        if (this.usedKeyIds.size >= allKeys.length) {
          console.log('All keys have been tried in this rotation, resetting rotation');
          this.resetRotation();
        }
      }
      
      // Get all active keys for the user
      const keys = await storage.getActiveApiKeys(userId);
      
      if (!keys || keys.length === 0) {
        console.error('No active API keys found for user');
        return null;
      }
      
      console.log(`Found ${keys.length} active API keys for rotation`);
      
      // Filter keys to exclude recently failed keys and those already used in this cycle
      const availableKeys = keys.filter(key => {
        // Skip the last failed key
        if (this.lastFailedKeyId === key.id) {
          console.log(`Skipping recently failed key ${key.id}`);
          return false;
        }
        
        // Skip keys already used in this rotation cycle
        if (this.usedKeyIds.has(key.id)) {
          console.log(`Skipping already used key ${key.id} in this rotation cycle`);
          return false;
        }
        
        return true;
      });
      
      // If no available keys after filtering, reset and try again with any key
      if (availableKeys.length === 0) {
        console.log('No available keys after filtering, resetting rotation');
        this.resetRotation();
        
        // Try again with the first key
        if (keys.length > 0) {
          const key = keys[0];
          console.log(`Using key ${key.id} after rotation reset`);
          
          // Mark as used
          this.usedKeyIds.add(key.id);
          
          return {
            apiKey: key.apiKey,
            apiSecret: key.apiSecret,
            keyId: key.id
          };
        }
        
        return null;
      }
      
      // Select the best available key (should be sorted by priority already)
      const selectedKey = availableKeys[0];
      
      // Mark this key as used in the current rotation cycle
      this.usedKeyIds.add(selectedKey.id);
      
      // Add to cache
      this.keyCache.set(selectedKey.id, selectedKey);
      
      console.log(`Selected API key ${selectedKey.id} for request`);
      
      return {
        apiKey: selectedKey.apiKey,
        apiSecret: selectedKey.apiSecret,
        keyId: selectedKey.id
      };
    } catch (error) {
      console.error('Error getting API keys for rotation:', error);
      return null;
    }
  }
  
  /**
   * Update the status of a key after a request
   * @param keyId The key ID
   * @param success Whether the request was successful
   */
  public async updateKeyStatus(keyId: number, success: boolean): Promise<void> {
    try {
      // Update key status in database
      await storage.updateApiKeyStatus(keyId, success);
      
      if (!success) {
        // Mark this key as the last failed key
        this.lastFailedKeyId = keyId;
        console.error(`Marked API key ${keyId} as failed`);
        
        // Remove from cache
        this.keyCache.delete(keyId);
      } else {
        console.log(`Marked API key ${keyId} as successful`);
      }
    } catch (error) {
      console.error('Error updating key status:', error);
    }
  }
  
  /**
   * Store a new API key
   */
  public async storeKey(userId: number, label: string, apiKey: string, apiSecret: string): Promise<ApiKey> {
    try {
      // Only use fields that are part of the insert schema
      const newKey = await storage.storeApiKey({
        userId,
        label,
        apiKey,
        apiSecret,
        priority: 0
      });
      
      console.log(`Stored new API key ${newKey.id} for user ${userId}`);
      return newKey;
    } catch (error) {
      console.error('Error storing API key:', error);
      throw error;
    }
  }
  
  /**
   * Get all API keys for a user
   */
  public async getUserKeys(userId: number): Promise<ApiKey[]> {
    try {
      const keys = await storage.getApiKeys(userId);
      return keys;
    } catch (error) {
      console.error('Error getting user API keys:', error);
      throw error;
    }
  }
  
  /**
   * Delete an API key
   */
  public async deleteKey(keyId: number): Promise<void> {
    try {
      await storage.deleteApiKey(keyId);
      
      // Remove from cache and rotation state
      this.keyCache.delete(keyId);
      this.usedKeyIds.delete(keyId);
      
      if (this.lastFailedKeyId === keyId) {
        this.lastFailedKeyId = null;
      }
      
      console.log(`Deleted API key ${keyId}`);
    } catch (error) {
      console.error(`Error deleting API key ${keyId}:`, error);
      throw error;
    }
  }
}

export const keyVault = new KeyVault();