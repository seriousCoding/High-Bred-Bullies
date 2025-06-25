// Simple encryption/decryption utilities for the API key vault
// This uses a basic encryption - in a production app, consider using a more robust solution

// A fixed encryption key for local storage (in production, this would come from environment variables)
const ENCRYPTION_KEY = 'COINBASE_CLIENT_APP_LOCAL_ENCRYPTION_KEY';

// Simple XOR-based encryption (suitable for local storage only)
export function encrypt(plainText: string): string {
  // Convert to base64 first to handle non-ASCII characters
  const text = btoa(unescape(encodeURIComponent(plainText)));
  
  // XOR encryption with the key
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    result += String.fromCharCode(charCode);
  }
  
  // Convert to base64 again for safe storage
  return btoa(result);
}

// Corresponding decryption function
export function decrypt(encryptedText: string): string {
  try {
    // Decode the base64 string
    const encoded = atob(encryptedText);
    
    // XOR decryption with the key
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      const charCode = encoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    
    // Decode the base64 and convert back to the original string
    return decodeURIComponent(escape(atob(result)));
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}