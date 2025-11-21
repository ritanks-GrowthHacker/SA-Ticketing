-- Drop the profile_picture_url index as it causes issues with base64 image storage
-- The index row size exceeds btree maximum when storing base64 encoded images
-- This index is not critical for performance as profile pictures are queried by user_id

DROP INDEX IF EXISTS idx_users_profile_picture;

-- Note: If you want to keep an index for performance, consider using a hash index instead:
-- CREATE INDEX IF NOT EXISTS idx_users_profile_picture_hash ON users USING hash(profile_picture_url) WHERE profile_picture_url IS NOT NULL;
-- However, hash indexes don't support all query types, so it's better to just remove it.
