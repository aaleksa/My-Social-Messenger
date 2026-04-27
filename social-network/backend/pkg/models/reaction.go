package models

type MessageReaction struct {
	ID        int64  `json:"id"`
	MessageID int64  `json:"message_id"`
	UserID    int64  `json:"user_id"`
	Emoji     string `json:"emoji"`
	CreatedAt string `json:"created_at"`
}

type GroupMessageReaction struct {
	ID             int64  `json:"id"`
	GroupMessageID int64  `json:"group_message_id"`
	UserID         int64  `json:"user_id"`
	Emoji          string `json:"emoji"`
	CreatedAt      string `json:"created_at"`
}
