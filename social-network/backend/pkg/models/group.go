package models

import "time"

type Group struct {
	ID          int64     `json:"id"`
	CreatorID   int64     `json:"creator_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type GroupMember struct {
	GroupID   int64     `json:"group_id"`
	UserID    int64     `json:"user_id"`
	Status    string    `json:"status"`
	InvitedBy *int64    `json:"invited_by,omitempty"`
	JoinedAt  time.Time `json:"joined_at"`
}

type GroupEvent struct {
	ID           int64     `json:"id"`
	GroupID      int64     `json:"group_id"`
	CreatorID    int64     `json:"creator_id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	EventTime    time.Time `json:"event_time"`
	CreatedAt    time.Time `json:"created_at"`
	UserResponse string    `json:"user_response,omitempty"` // going | not_going | ""
}

type EventResponse struct {
	EventID  int64  `json:"event_id"`
	UserID   int64  `json:"user_id"`
	Response string `json:"response"`
}
