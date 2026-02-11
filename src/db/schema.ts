import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`);

const uuidText = (name: string) => text(name).notNull().primaryKey();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("customer"),
  createdAt: timestamp("created_at"),
});

export const characters = sqliteTable("characters", {
  id: uuidText("id"),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  gender: text("gender").notNull(),
  sourceImageUrl: text("source_image_url"),
  stylePreset: text("style_preset"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const characterProfiles = sqliteTable("character_profiles", {
  id: uuidText("id"),
  characterId: text("character_id")
    .notNull()
    .unique()
    .references(() => characters.id),
  approxAge: text("approx_age"),
  hairColor: text("hair_color"),
  hairLength: text("hair_length"),
  hairTexture: text("hair_texture"),
  hairStyle: text("hair_style"),
  faceShape: text("face_shape"),
  eyeColor: text("eye_color"),
  eyeShape: text("eye_shape"),
  skinTone: text("skin_tone"),
  clothing: text("clothing"),
  distinctiveFeatures: text("distinctive_features"),
  colorPalette: text("color_palette", { mode: "json" }),
  personalityTraits: text("personality_traits", { mode: "json" }),
  doNotChange: text("do_not_change", { mode: "json" }),
  rawVisionDescription: text("raw_vision_description"),
});

export const characterImages = sqliteTable("character_images", {
  id: uuidText("id"),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id),
  imageUrl: text("image_url").notNull(),
  isSelected: integer("is_selected", { mode: "boolean" }).default(false),
  promptArtifactId: text("prompt_artifact_id"),
  createdAt: timestamp("created_at"),
});

export const stories = sqliteTable("stories", {
  id: uuidText("id"),
  userId: text("user_id").references(() => users.id),
  characterId: text("character_id").references(() => characters.id),
  title: text("title"),
  ageRange: text("age_range"),
  theme: text("theme"),
  storyArc: text("story_arc"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const storyScenes = sqliteTable("story_scenes", {
  id: uuidText("id"),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id),
  sceneNumber: integer("scene_number").notNull(),
  spreadText: text("spread_text"),
  sceneDescription: text("scene_description"),
  layout: text("layout").default("full-spread"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const propsBibleEntries = sqliteTable("props_bible_entries", {
  id: uuidText("id"),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id),
  title: text("title").notNull(),
  category: text("category"),
  appearsInScenes: text("appears_in_scenes", { mode: "json" }),
  tags: text("tags", { mode: "json" }),
  description: text("description").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const propImages = sqliteTable("prop_images", {
  id: uuidText("id"),
  propId: text("prop_id")
    .notNull()
    .references(() => propsBibleEntries.id),
  imageUrl: text("image_url").notNull(),
  variantLabel: text("variant_label"),
  promptArtifactId: text("prompt_artifact_id"),
  createdAt: timestamp("created_at"),
});

export const storyboardPanels = sqliteTable("storyboard_panels", {
  id: uuidText("id"),
  sceneId: text("scene_id")
    .notNull()
    .references(() => storyScenes.id),
  background: text("background"),
  foreground: text("foreground"),
  environment: text("environment"),
  characterPose: text("character_pose"),
  composition: text("composition"),
  propsUsed: text("props_used", { mode: "json" }),
  imageUrl: text("image_url"),
  promptArtifactId: text("prompt_artifact_id"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at"),
});

export const finalPages = sqliteTable("final_pages", {
  id: uuidText("id"),
  sceneId: text("scene_id")
    .notNull()
    .references(() => storyScenes.id),
  imageUrl: text("image_url").notNull(),
  promptArtifactId: text("prompt_artifact_id"),
  isApproved: integer("is_approved", { mode: "boolean" }).default(false),
  version: integer("version").default(1),
  createdAt: timestamp("created_at"),
});

export const promptArtifacts = sqliteTable("prompt_artifacts", {
  id: uuidText("id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  rawPrompt: text("raw_prompt").notNull(),
  structuredFields: text("structured_fields", { mode: "json" }),
  model: text("model"),
  parameters: text("parameters", { mode: "json" }),
  status: text("status").default("pending"),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  costCents: integer("cost_cents"),
  createdAt: timestamp("created_at"),
});

export const generatedAssets = sqliteTable("generated_assets", {
  id: uuidText("id"),
  type: text("type").notNull(),
  entityId: text("entity_id"),
  storageUrl: text("storage_url").notNull(),
  mimeType: text("mime_type"),
  width: integer("width"),
  height: integer("height"),
  fileSizeBytes: integer("file_size_bytes"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: timestamp("created_at"),
});

export const orders = sqliteTable("orders", {
  id: uuidText("id"),
  userId: text("user_id").references(() => users.id),
  storyId: text("story_id").references(() => stories.id),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").default("pending"),
  amountCents: integer("amount_cents"),
  currency: text("currency").default("usd"),
  createdAt: timestamp("created_at"),
});

export const books = sqliteTable("books", {
  id: uuidText("id"),
  orderId: text("order_id").references(() => orders.id),
  pdfUrl: text("pdf_url"),
  luluPrintJobId: text("lulu_print_job_id"),
  printStatus: text("print_status"),
  trackingUrl: text("tracking_url"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const userCredits = sqliteTable("user_credits", {
  userId: text("user_id")
    .notNull()
    .primaryKey()
    .references(() => users.id),
  starterCreditsCents: integer("starter_credits_cents").notNull().default(0),
  paidCreditsCents: integer("paid_credits_cents").notNull().default(0),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const creditLedgerEntries = sqliteTable("credit_ledger_entries", {
  id: uuidText("id"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  orderId: text("order_id").references(() => orders.id),
  entryType: text("entry_type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  balanceStarterAfterCents: integer("balance_starter_after_cents"),
  balancePaidAfterCents: integer("balance_paid_after_cents"),
  idempotencyKey: text("idempotency_key").unique(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: timestamp("created_at"),
});
