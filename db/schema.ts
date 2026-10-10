import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: integer("locked_until"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_users_email").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_sessions_user").on(table.userId)],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    eventId: text("event_id").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_bookmarks_user_event").on(table.userId, table.eventId),
  ],
);

export const geocodeCache = sqliteTable("geocode_cache", {
  query: text("query").primaryKey(),
  displayName: text("display_name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  placeId: text("place_id"),
  verifiedAt: text("verified_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const requestLimits = sqliteTable(
  "request_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_request_limits_expiry").on(table.expiresAt)],
);
