package models

import "time"

type Notification struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	ActorID     *int64    `json:"actor_id,omitempty"`
	Type        string    `json:"type"` // follow_request, group_invite, group_join_request, group_event
	ReferenceID *int64    `json:"reference_id,omitempty"`
	IsRead      bool      `json:"is_read"`
	CreatedAt   time.Time `json:"created_at"`
}
