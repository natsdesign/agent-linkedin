-- Add avatar_url to creator_profile for storing the user's own LinkedIn avatar
ALTER TABLE creator_profile
  ADD COLUMN IF NOT EXISTS avatar_url text;
