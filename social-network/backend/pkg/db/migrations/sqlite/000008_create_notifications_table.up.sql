CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,        -- recipient
    actor_id INTEGER,                -- who triggered
    type TEXT NOT NULL,              -- 'follow_request', 'group_invite', 'group_join_request', 'group_event'
    reference_id INTEGER,            -- id of related entity (group, event, follower record)
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
