-- Add deleted and viewed fields to messages and group_messages (edited_at already exists)
ALTER TABLE messages ADD COLUMN deleted BOOLEAN DEFAULT 0;
ALTER TABLE messages ADD COLUMN viewed BOOLEAN DEFAULT 0;

ALTER TABLE group_messages ADD COLUMN deleted BOOLEAN DEFAULT 0;
ALTER TABLE group_messages ADD COLUMN viewed BOOLEAN DEFAULT 0;
