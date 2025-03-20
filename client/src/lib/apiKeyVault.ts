// API Key Vault Service
// This service manages secure storage of API keys in local storage
// with encryption for added security

import { encrypt, decrypt } from './crypto';

export interface VaultedApiKey {
  id: string;
  label: string;
  apiKey: string;
  apiSecret: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

// Storage keys
const VAULT_STORAGE_KEY = 'coinbase-api-vault';
const ACTIVE_KEY_ID = 'coinbase-active-key-id';

// Get all stored API keys
export function getAllApiKeys(): VaultedApiKey[] {
  try {
    const vaultData = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!vaultData) return [];
    
    const decrypted = decrypt(vaultData);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to retrieve API keys from vault:', error);
    return [];
  }
}

// Save API keys to the vault
export function saveApiKeysToVault(keys: VaultedApiKey[]): boolean {
  try {
    const encrypted = encrypt(JSON.stringify(keys));
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    return true;
  } catch (error) {
    console.error('Failed to save API keys to vault:', error);
    return false;
  }
}

// Add a new API key to the vault
export function addApiKey(key: Omit<VaultedApiKey, 'id' | 'createdAt'>): VaultedApiKey {
  const keys = getAllApiKeys();
  
  // Generate a unique ID and creation timestamp
  const newKey: VaultedApiKey = {
    ...key,
    id: generateUniqueId(),
    createdAt: new Date().toISOString(),
  };
  
  // Save the updated list
  saveApiKeysToVault([...keys, newKey]);
  
  // If this is the first key or isActive is true, set it as active
  if (keys.length === 0 || key.isActive) {
    setActiveKeyId(newKey.id);
  }
  
  return newKey;
}

// Remove an API key from the vault
export function removeApiKey(id: string): boolean {
  const keys = getAllApiKeys();
  const filteredKeys = keys.filter(key => key.id !== id);
  
  // If we're removing the active key, reset active key
  const activeKeyId = getActiveKeyId();
  if (activeKeyId === id) {
    // Set the first available key as active, or clear if none
    if (filteredKeys.length > 0) {
      setActiveKeyId(filteredKeys[0].id);
    } else {
      clearActiveKey();
    }
  }
  
  return saveApiKeysToVault(filteredKeys);
}

// Get a specific API key by ID
export function getApiKey(id: string): VaultedApiKey | null {
  const keys = getAllApiKeys();
  return keys.find(key => key.id === id) || null;
}

// Set an API key as active
export function setActiveKeyId(id: string): void {
  localStorage.setItem(ACTIVE_KEY_ID, id);
  
  // Update the lastUsed timestamp
  const keys = getAllApiKeys();
  const updatedKeys = keys.map(key => ({
    ...key,
    lastUsed: key.id === id ? new Date().toISOString() : key.lastUsed,
  }));
  
  saveApiKeysToVault(updatedKeys);
}

// Get the active API key ID
export function getActiveKeyId(): string | null {
  return localStorage.getItem(ACTIVE_KEY_ID);
}

// Get the active API key
export function getActiveApiKey(): VaultedApiKey | null {
  const activeId = getActiveKeyId();
  if (!activeId) return null;
  
  return getApiKey(activeId);
}

// Clear the active API key
export function clearActiveKey(): void {
  localStorage.removeItem(ACTIVE_KEY_ID);
}

// Auto-login function to retrieve and apply the active API key
export function autoLogin(): VaultedApiKey | null {
  // Get the active API key
  const activeKey = getActiveApiKey();
  
  if (activeKey) {
    // Update the last used timestamp
    const keys = getAllApiKeys();
    const updatedKeys = keys.map(key => ({
      ...key,
      lastUsed: key.id === activeKey.id ? new Date().toISOString() : key.lastUsed,
    }));
    
    saveApiKeysToVault(updatedKeys);
  }
  
  return activeKey;
}

// Utility function to generate a unique ID
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}