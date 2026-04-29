package models

import "time"

type Message struct {
	ID          int64     `json:"id"`
	SenderID    int64     `json:"sender_id"`
	RecipientID int64     `json:"recipient_id"`
	Content     string    `json:"content"`
	ImageURL    string    `json:"image_url,omitempty"`
	ReplyTo     *int64    `json:"reply_to,omitempty"`
	QuotedText  string    `json:"quoted_text,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	EditedAt    *time.Time `json:"edited_at,omitempty"`
	Deleted     bool      `json:"deleted"`
	Viewed      bool      `json:"viewed"`
}

type GroupMessage struct {
	ID        int64     `json:"id"`
	GroupID   int64     `json:"group_id"`
	SenderID  int64     `json:"sender_id"`
	Content   string    `json:"content"`
	ImageURL  string    `json:"image_url,omitempty"`
	ReplyTo   *int64    `json:"reply_to,omitempty"`
	QuotedText string   `json:"quoted_text,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	EditedAt  *time.Time `json:"edited_at,omitempty"`
	Deleted   bool      `json:"deleted"`
	Viewed    bool      `json:"viewed"`
}
