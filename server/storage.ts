import { 
  User, InsertUser,
  Litter, InsertLitter,
  BlogPost, InsertBlogPost,
  UserProfile, InsertUserProfile
} from "../shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Profile methods
  getUserProfile(userId: number): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: number, profile: Partial<UserProfile>): Promise<UserProfile | undefined>;
  
  // Litter methods
  getLitters(): Promise<Litter[]>;
  getFeaturedLitters(): Promise<Litter[]>;
  getLitter(id: number): Promise<Litter | undefined>;
  createLitter(litter: InsertLitter, userId: number): Promise<Litter>;
  updateLitter(id: number, litter: Partial<Litter>): Promise<Litter | undefined>;
  deleteLitter(id: number): Promise<void>;
  
  // Blog methods
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost, userId: number): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<BlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<void>;
}

import { users, litters, blogPosts, userProfiles } from "../shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

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

  // Profile methods
  async getUserProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile || undefined;
  }

  async createUserProfile(insertProfile: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async updateUserProfile(userId: number, profileUpdate: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const [profile] = await db
      .update(userProfiles)
      .set(profileUpdate)
      .where(eq(userProfiles.userId, userId))
      .returning();
    return profile || undefined;
  }

  // Litter methods
  async getLitters(): Promise<Litter[]> {
    return await db.select().from(litters).orderBy(desc(litters.createdAt));
  }

  async getFeaturedLitters(): Promise<Litter[]> {
    return await db.select().from(litters).where(eq(litters.featured, true)).orderBy(desc(litters.createdAt));
  }

  async getLitter(id: number): Promise<Litter | undefined> {
    const [litter] = await db.select().from(litters).where(eq(litters.id, id));
    return litter || undefined;
  }

  async createLitter(insertLitter: InsertLitter, userId: number): Promise<Litter> {
    const [litter] = await db
      .insert(litters)
      .values({ ...insertLitter, breederId: userId })
      .returning();
    return litter;
  }

  async updateLitter(id: number, litterUpdate: Partial<Litter>): Promise<Litter | undefined> {
    const [litter] = await db
      .update(litters)
      .set(litterUpdate)
      .where(eq(litters.id, id))
      .returning();
    return litter || undefined;
  }

  async deleteLitter(id: number): Promise<void> {
    await db.delete(litters).where(eq(litters.id, id));
  }

  // Blog methods
  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPost(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post || undefined;
  }

  async createBlogPost(insertPost: InsertBlogPost, userId: number): Promise<BlogPost> {
    const [post] = await db
      .insert(blogPosts)
      .values({ ...insertPost, authorId: userId })
      .returning();
    return post;
  }

  async updateBlogPost(id: number, postUpdate: Partial<BlogPost>): Promise<BlogPost | undefined> {
    const [post] = await db
      .update(blogPosts)
      .set(postUpdate)
      .where(eq(blogPosts.id, id))
      .returning();
    return post || undefined;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }
}

export const storage = new DatabaseStorage();