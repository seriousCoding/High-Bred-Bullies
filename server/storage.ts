import { 
  User, InsertUser, 
  ApiKey, InsertApiKey,
  FavoriteMarket, InsertFavoriteMarket
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // API Key methods
  storeApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeys(userId: number): Promise<ApiKey[]>;
  getApiKeyById(id: number): Promise<ApiKey | undefined>;
  deleteApiKey(id: number): Promise<void>;
  
  // Favorite markets methods
  addFavoriteMarket(favorite: InsertFavoriteMarket): Promise<FavoriteMarket>;
  getFavoriteMarkets(userId: number): Promise<FavoriteMarket[]>;
  removeFavoriteMarket(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private apiKeys: Map<number, ApiKey>;
  private favoriteMarkets: Map<number, FavoriteMarket>;
  private userIdCounter: number;
  private apiKeyIdCounter: number;
  private favoriteMarketIdCounter: number;

  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.favoriteMarkets = new Map();
    this.userIdCounter = 1;
    this.apiKeyIdCounter = 1;
    this.favoriteMarketIdCounter = 1;
    
    // Initialize with a default user for testing
    this.users.set(1, {
      id: 1,
      username: 'testuser',
      password: 'password123' // This would be hashed in a real app
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // API Key methods
  async storeApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = this.apiKeyIdCounter++;
    const createdAt = new Date();
    
    // Create a properly typed ApiKey object without spreading
    const apiKey: ApiKey = { 
      id,
      userId: insertApiKey.userId, 
      apiKey: insertApiKey.apiKey,
      apiSecret: insertApiKey.apiSecret,
      label: insertApiKey.label || null,
      isActive: true, 
      createdAt
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }
  
  async getApiKeys(userId: number): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter(
      (apiKey) => apiKey.userId === userId
    );
  }
  
  async getApiKeyById(id: number): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }
  
  async deleteApiKey(id: number): Promise<void> {
    this.apiKeys.delete(id);
  }
  
  // Favorite markets methods
  async addFavoriteMarket(insertFavorite: InsertFavoriteMarket): Promise<FavoriteMarket> {
    const id = this.favoriteMarketIdCounter++;
    const createdAt = new Date();
    const favorite: FavoriteMarket = { ...insertFavorite, id, createdAt };
    this.favoriteMarkets.set(id, favorite);
    return favorite;
  }
  
  async getFavoriteMarkets(userId: number): Promise<FavoriteMarket[]> {
    return Array.from(this.favoriteMarkets.values()).filter(
      (favorite) => favorite.userId === userId
    );
  }
  
  async removeFavoriteMarket(id: number): Promise<void> {
    this.favoriteMarkets.delete(id);
  }
}

export const storage = new MemStorage();
