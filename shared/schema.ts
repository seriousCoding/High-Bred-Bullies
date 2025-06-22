import { pgTable, text, serial, integer, boolean, jsonb, timestamp, numeric, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core authentication and user management
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  email: text("email").unique(),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password_hash: true,
  email: true,
});

// User profiles for detailed information
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  profilePicture: text("profile_picture"),
  bio: text("bio"),
  isBreeder: boolean("is_breeder").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Breeder-specific information
export const breeders = pgTable("breeders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  businessName: text("business_name").notNull(),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  address: text("address"),
  deliveryAreas: jsonb("delivery_areas").$type<string[]>(),
  deliveryFee: integer("delivery_fee"), // in cents
  specialties: jsonb("specialties").$type<string[]>(),
  experience: text("experience"),
  certifications: jsonb("certifications").$type<string[]>(),
  socialMedia: jsonb("social_media").$type<Record<string, string>>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pet owners information
export const petOwners = pgTable("pet_owners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  preferences: jsonb("preferences").$type<Record<string, any>>(),
  previousDogs: jsonb("previous_dogs").$type<any[]>(),
  livingSituation: text("living_situation"),
  experience: text("experience"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Litter management
export const litters = pgTable("litters", {
  id: serial("id").primaryKey(),
  breederId: integer("breeder_id").notNull(),
  damName: text("dam_name").notNull(),
  sireName: text("sire_name").notNull(),
  damPedigree: text("dam_pedigree"),
  sirePedigree: text("sire_pedigree"),
  breed: text("breed").notNull(),
  birthDate: timestamp("birth_date"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  totalPuppies: integer("total_puppies").default(0),
  availablePuppies: integer("available_puppies").default(0),
  malePrice: integer("male_price"), // in cents
  femalePrice: integer("female_price"), // in cents
  description: text("description"),
  images: jsonb("images").$type<string[]>(),
  healthCertificates: jsonb("health_certificates").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual puppies
export const puppies = pgTable("puppies", {
  id: serial("id").primaryKey(),
  litterId: integer("litter_id").notNull(),
  name: text("name"),
  gender: text("gender").notNull(), // 'male' or 'female'
  color: text("color"),
  markings: text("markings"),
  weight: numeric("weight"), // in pounds
  personalityTraits: jsonb("personality_traits").$type<string[]>(),
  healthStatus: text("health_status").default("healthy"),
  vaccinationStatus: jsonb("vaccination_status").$type<Record<string, any>>(),
  images: jsonb("images").$type<string[]>(),
  price: integer("price"), // in cents
  isAvailable: boolean("is_available").default(true),
  isReserved: boolean("is_reserved").default(false),
  reservedBy: integer("reserved_by"),
  reservedAt: timestamp("reserved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders and payments
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  breederId: integer("breeder_id").notNull(),
  status: text("status").default("pending"), // pending, paid, completed, cancelled
  totalAmount: integer("total_amount").notNull(), // in cents
  deliveryMethod: text("delivery_method"), // pickup, delivery, shipping
  deliveryAddress: text("delivery_address"),
  deliveryDate: timestamp("delivery_date"),
  pickupLocation: text("pickup_location"),
  specialInstructions: text("special_instructions"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items (puppies in orders)
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  puppyId: integer("puppy_id").notNull(),
  price: integer("price").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog posts for content
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"),
  category: text("category"),
  tags: jsonb("tags").$type<string[]>(),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Social posts for community features
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  images: jsonb("images").$type<string[]>(),
  postType: text("post_type").default("general"), // general, puppy_update, breeding_news
  relatedPuppyId: integer("related_puppy_id"),
  relatedLitterId: integer("related_litter_id"),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Social interactions
export const socialPostLikes = pgTable("social_post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialPostComments = pgTable("social_post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  parentCommentId: integer("parent_comment_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User follows for social features
export const userFollows = pgTable("user_follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followingId: integer("following_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inquiries and communications
export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  breederId: integer("breeder_id"),
  puppyId: integer("puppy_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").default("new"), // new, responded, closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications
export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type"), // order_update, puppy_available, blog_post, etc.
  relatedId: integer("related_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pickup reminders and scheduling
export const pickupReminders = pgTable("pickup_reminders", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  reminderDate: timestamp("reminder_date").notNull(),
  reminderType: text("reminder_type"), // email, sms, both
  isSent: boolean("is_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Site configuration
export const siteConfig = pgTable("site_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Keys Storage (keeping existing)
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  isActive: boolean("is_active").default(true),
  label: text("label"),
  priority: integer("priority").default(0),
  failCount: integer("fail_count").default(0),
  lastAttempt: timestamp("last_attempt"),
  lastSuccess: timestamp("last_success"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Favorites for quick access (keeping existing)
export const favoriteMarkets = pgTable("favorite_markets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: text("product_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBreederSchema = createInsertSchema(breeders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPetOwnerSchema = createInsertSchema(petOwners).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLitterSchema = createInsertSchema(litters).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPuppySchema = createInsertSchema(puppies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInquirySchema = createInsertSchema(inquiries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true });
export const insertFavoriteMarketSchema = createInsertSchema(favoriteMarkets).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type Breeder = typeof breeders.$inferSelect;
export type InsertBreeder = z.infer<typeof insertBreederSchema>;

export type PetOwner = typeof petOwners.$inferSelect;
export type InsertPetOwner = z.infer<typeof insertPetOwnerSchema>;

export type Litter = typeof litters.$inferSelect;
export type InsertLitter = z.infer<typeof insertLitterSchema>;

export type Puppy = typeof puppies.$inferSelect;
export type InsertPuppy = z.infer<typeof insertPuppySchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type FavoriteMarket = typeof favoriteMarkets.$inferSelect;
export type InsertFavoriteMarket = z.infer<typeof insertFavoriteMarketSchema>;
