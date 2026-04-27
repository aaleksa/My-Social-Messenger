-- Add quoted_text to messages and group_messages
ALTER TABLE messages ADD COLUMN quoted_text TEXT;
ALTER TABLE group_messages ADD COLUMN quoted_text TEXT;