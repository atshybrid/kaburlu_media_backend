-- Safe DDL to create Prompt table if it does not exist
CREATE TABLE IF NOT EXISTS "Prompt" (
  id text PRIMARY KEY,
  key text UNIQUE NOT NULL,
  content text NOT NULL,
  description text,
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdAt" timestamp with time zone NOT NULL DEFAULT now()
);
