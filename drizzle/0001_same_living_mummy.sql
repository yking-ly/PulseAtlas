CREATE TABLE `geocode_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`place_id` text,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
