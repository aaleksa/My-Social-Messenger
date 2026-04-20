package models

import "time"

type Follower struct {
	FollowerID  int64     `json:"follower_id"`
	FollowingID int64     `json:"following_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}
