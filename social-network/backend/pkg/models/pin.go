package models

type Pin struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id"`
	MessageID int64  `json:"message_id"`
	GroupID   *int64 `json:"group_id,omitempty"`
	CreatedAt string `json:"created_at"`
}
