import { 
  User, InsertUser, 
  ApiKey, InsertApiKey,
  FavoriteMarket, InsertFavoriteMarket,
  UserProfile
} from "../shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserProfile(userId: number): Promise<UserProfile | undefined>;
  
  // API Key methods
  storeApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeys(userId: number): Promise<ApiKey[]>;
  getActiveApiKeys(userId: number): Promise<ApiKey[]>;
  getApiKeyById(id: number): Promise<ApiKey | undefined>;
  updateApiKeyStatus(id: number, success: boolean): Promise<ApiKey | undefined>;
  deleteApiKey(id: number): Promise<void>;
  
  // Favorite markets methods
  addFavoriteMarket(favorite: InsertFavoriteMarket): Promise<FavoriteMarket>;
  getFavoriteMarkets(userId: number): Promise<FavoriteMarket[]>;
  removeFavoriteMarket(id: number): Promise<void>;
}

import { users, apiKeys, favoriteMarkets, userProfiles } from "../shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, isNull } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile || undefined;
  }
  
  // API Key methods
  async storeApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        ...insertApiKey,
        isActive: true,
        failCount: 0
      })
      .returning();
    return apiKey;
  }
  
  async updateApiKeyStatus(id: number, success: boolean): Promise<ApiKey | undefined> {
    const now = new Date();
    
    // Prepare update values based on success
    const updateValues: any = {
      lastAttempt: now
    };
    
    if (success) {
      // If successful, reset fail count and update last success
      updateValues.failCount = 0;
      updateValues.lastSuccess = now;
    } else {
      // If failed, increment fail count
      const [key] = await db.select({ failCount: apiKeys.failCount })
        .from(apiKeys)
        .where(eq(apiKeys.id, id));
        
      updateValues.failCount = ((key?.failCount || 0) + 1);
    }
    
    // Update the key in the database
    const [updatedKey] = await db
      .update(apiKeys)
      .set(updateValues)
      .where(eq(apiKeys.id, id))
      .returning();
      
    return updatedKey || undefined;
  }
  
  async getActiveApiKeys(userId: number): Promise<ApiKey[]> {
    // Get active API keys and sort by multiple fields for proper key rotation:
    // 1. priority (higher first)
    // 2. fail count (less failures first)
    // 3. last success (more recent first)
    // 4. creation date (newer first)
    // Get active API keys with proper sorting for rotation
    const keys = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, userId),
        eq(apiKeys.isActive, true)
      ));
      
    // Manual sorting to handle null values correctly
    return keys.sort((a, b) => {
      // First by priority (higher first)
      if ((a.priority || 0) !== (b.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      
      // Then by fail count (less failures first)
      if ((a.failCount || 0) !== (b.failCount || 0)) {
        return (a.failCount || 0) - (b.failCount || 0);
      }
      
      // Then by last success (more recent first)
      if (a.lastSuccess && b.lastSuccess) {
        return b.lastSuccess.getTime() - a.lastSuccess.getTime();
      } else if (a.lastSuccess) {
        return -1;
      } else if (b.lastSuccess) {
        return 1;
      }
      
      // Finally by creation date (newer first)
      if (a.createdAt && b.createdAt) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else if (a.createdAt) {
        return -1;
      } else if (b.createdAt) {
        return 1;
      }
      
      return 0;
    });
  }
  
  async getApiKeys(userId: number): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
  }
  
  async getApiKeyById(id: number): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id));
    return apiKey || undefined;
  }
  
  async deleteApiKey(id: number): Promise<void> {
    await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id));
  }
  
  // Favorite markets methods
  async addFavoriteMarket(insertFavorite: InsertFavoriteMarket): Promise<FavoriteMarket> {
    const [favorite] = await db
      .insert(favoriteMarkets)
      .values(insertFavorite)
      .returning();
    return favorite;
  }
  
  async getFavoriteMarkets(userId: number): Promise<FavoriteMarket[]> {
    return await db
      .select()
      .from(favoriteMarkets)
      .where(eq(favoriteMarkets.userId, userId));
  }
  
  async removeFavoriteMarket(id: number): Promise<void> {
    await db
      .delete(favoriteMarkets)
      .where(eq(favoriteMarkets.id, id));
  }
}

export const storage = new DatabaseStorage();
