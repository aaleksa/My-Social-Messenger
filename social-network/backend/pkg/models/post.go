package models

import "time"

type Post struct {
	ID              int64     `json:"id"`
	UserID          int64     `json:"user_id"`
	GroupID         *int64    `json:"group_id,omitempty"`
	Content         string    `json:"content"`
	Image           string    `json:"image,omitempty"`
	Privacy         string    `json:"privacy"`
	CreatedAt       time.Time `json:"created_at"`
	AllowedUsers    []int64   `json:"allowed_users,omitempty"`
	Likes           int64     `json:"likes"`
	Liked           bool      `json:"liked"`
	AuthorFirstName string    `json:"author_first_name"`
	AuthorLastName  string    `json:"author_last_name"`
	AuthorAvatar    string    `json:"author_avatar,omitempty"`
}

type Comment struct {
        ID              int64     `json:"id"`
        PostID          int64     `json:"post_id"`
        UserID          int64     `json:"user_id"`
        Content         string    `json:"content"`
        Image           string    `json:"image,omitempty"`
        CreatedAt       time.Time `json:"created_at"`
        AuthorFirstName string    `json:"author_first_name"`
        AuthorLastName  string    `json:"author_last_name"`
        AuthorAvatar    string    `json:"author_avatar,omitempty"`
        AuthorNickname  string    `json:"author_nickname,omitempty"`}