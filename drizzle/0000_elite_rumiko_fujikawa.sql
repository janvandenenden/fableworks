CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`pdf_url` text,
	`lulu_print_job_id` text,
	`print_status` text,
	`tracking_url` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_images` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`image_url` text NOT NULL,
	`is_selected` integer DEFAULT false,
	`prompt_artifact_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`approx_age` text,
	`hair_color` text,
	`hair_length` text,
	`hair_texture` text,
	`hair_style` text,
	`face_shape` text,
	`eye_color` text,
	`eye_shape` text,
	`skin_tone` text,
	`clothing` text,
	`distinctive_features` text,
	`color_palette` text,
	`personality_traits` text,
	`do_not_change` text,
	`raw_vision_description` text,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_profiles_character_id_unique` ON `character_profiles` (`character_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`source_image_url` text,
	`style_preset` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `final_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`image_url` text NOT NULL,
	`prompt_artifact_id` text,
	`is_approved` integer DEFAULT false,
	`version` integer DEFAULT 1,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`scene_id`) REFERENCES `story_scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generated_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`entity_id` text,
	`storage_url` text NOT NULL,
	`mime_type` text,
	`width` integer,
	`height` integer,
	`file_size_bytes` integer,
	`metadata` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`story_id` text,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`payment_status` text DEFAULT 'pending',
	`amount_cents` integer,
	`currency` text DEFAULT 'usd',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`raw_prompt` text NOT NULL,
	`structured_fields` text,
	`model` text,
	`parameters` text,
	`status` text DEFAULT 'pending',
	`result_url` text,
	`error_message` text,
	`cost_cents` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `prop_images` (
	`id` text PRIMARY KEY NOT NULL,
	`prop_id` text NOT NULL,
	`image_url` text NOT NULL,
	`variant_label` text,
	`prompt_artifact_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`prop_id`) REFERENCES `props_bible_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `props_bible_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`tags` text,
	`description` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`character_id` text,
	`title` text,
	`age_range` text,
	`theme` text,
	`story_arc` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`scene_number` integer NOT NULL,
	`spread_text` text,
	`scene_description` text,
	`layout` text DEFAULT 'full-spread',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storyboard_panels` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`background` text,
	`foreground` text,
	`environment` text,
	`character_pose` text,
	`composition` text,
	`props_used` text,
	`image_url` text,
	`prompt_artifact_id` text,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`scene_id`) REFERENCES `story_scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
