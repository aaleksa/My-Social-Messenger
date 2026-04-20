package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
)

type PostHandler struct {
	DB *sqlite.DB
}

func NewPostHandler(db *sqlite.DB) *PostHandler {
	ph := &PostHandler{DB: db}
	// ensure post_likes table exists
	db.Exec(`CREATE TABLE IF NOT EXISTS post_likes (
		post_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (post_id, user_id)
	)`)
	return ph
}

// POST /api/posts
func (h *PostHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		GroupID      *int64  `json:"group_id"`
		Content      string  `json:"content"`
		Image        string  `json:"image"`
		Privacy      string  `json:"privacy"`
		AllowedUsers []int64 `json:"allowed_users"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Privacy == "" {
		req.Privacy = "public"
	}

	result, err := h.DB.Exec(
		`INSERT INTO posts (user_id, group_id, content, image, privacy) VALUES (?, ?, ?, ?, ?)`,
		userID, req.GroupID, req.Content, req.Image, req.Privacy,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	postID, _ := result.LastInsertId()

	if req.Privacy == "private" && len(req.AllowedUsers) > 0 {
		for _, uid := range req.AllowedUsers {
			h.DB.Exec(`INSERT OR IGNORE INTO post_allowed_users (post_id, user_id) VALUES (?, ?)`, postID, uid)
		}
	}

	// Return full post object
	var p models.Post
	h.DB.QueryRow(
		`SELECT p.id, p.user_id, p.group_id, p.content, p.image, p.privacy, p.created_at,
		        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,'')
		 FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`, postID,
	).Scan(&p.ID, &p.UserID, &p.GroupID, &p.Content, &p.Image, &p.Privacy, &p.CreatedAt,
		&p.AuthorFirstName, &p.AuthorLastName, &p.AuthorAvatar)
	p.Likes = 0
	p.Liked = false

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

// GET /api/posts?user_id=1 or /api/posts?group_id=1
func (h *PostHandler) ListPosts(w http.ResponseWriter, r *http.Request) {
	viewerID := middleware.GetUserID(r)
	userIDParam := r.URL.Query().Get("user_id")
	groupIDParam := r.URL.Query().Get("group_id")

	var rows interface {
		Next() bool
		Scan(...interface{}) error
		Close() error
	}
	var err error

	if groupIDParam != "" {
		groupID, _ := strconv.ParseInt(groupIDParam, 10, 64)
		rows, err = h.DB.Query(
			`SELECT p.id, p.user_id, p.group_id, p.content, p.image, p.privacy, p.created_at,
			        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,'')
			 FROM posts p
			 LEFT JOIN users u ON u.id = p.user_id
			 INNER JOIN group_members gm ON gm.group_id = p.group_id AND gm.user_id = ? AND gm.status = 'accepted'
			 WHERE p.group_id = ? ORDER BY p.created_at DESC`, viewerID, groupID,
		)
	} else if userIDParam != "" {
		targetID, _ := strconv.ParseInt(userIDParam, 10, 64)
		rows, err = h.DB.Query(
			`SELECT p.id, p.user_id, p.group_id, p.content, p.image, p.privacy, p.created_at,
			        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,'')
			 FROM posts p
			 LEFT JOIN users u ON u.id = p.user_id
			 WHERE p.user_id = ? AND p.group_id IS NULL
			 AND (p.privacy = 'public'
			   OR (p.privacy = 'almost_private' AND (? = p.user_id OR EXISTS(
			       SELECT 1 FROM followers WHERE follower_id = ? AND following_id = p.user_id AND status = 'accepted')))
			   OR (p.privacy = 'private' AND (? = p.user_id OR EXISTS(
			       SELECT 1 FROM post_allowed_users WHERE post_id = p.id AND user_id = ?))))
			 ORDER BY p.created_at DESC`, targetID, viewerID, viewerID, viewerID, viewerID,
		)
	} else {
		// Feed: posts from followed users + own posts
		limitParam := r.URL.Query().Get("limit")
		offsetParam := r.URL.Query().Get("offset")
		limit := int64(20)
		offset := int64(0)
		if limitParam != "" { limit, _ = strconv.ParseInt(limitParam, 10, 64) }
		if offsetParam != "" { offset, _ = strconv.ParseInt(offsetParam, 10, 64) }
		rows, err = h.DB.Query(
			`SELECT p.id, p.user_id, p.group_id, p.content, p.image, p.privacy, p.created_at,
			        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,'')
			 FROM posts p
			 LEFT JOIN users u ON u.id = p.user_id
			 WHERE p.group_id IS NULL
			 AND (p.user_id = ?
			   OR (p.privacy = 'public')
			   OR (p.privacy = 'almost_private' AND EXISTS(
			         SELECT 1 FROM followers WHERE follower_id = ? AND following_id = p.user_id AND status = 'accepted'))
			   OR (p.privacy = 'private' AND EXISTS(
			         SELECT 1 FROM post_allowed_users WHERE post_id = p.id AND user_id = ?)))
			 ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, viewerID, viewerID, viewerID, limit, offset,
		)
	}

	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.UserID, &p.GroupID, &p.Content, &p.Image, &p.Privacy, &p.CreatedAt,
			&p.AuthorFirstName, &p.AuthorLastName, &p.AuthorAvatar)
		// likes count
		h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ?`, p.ID).Scan(&p.Likes)
		// did viewer like it?
		var likedInt int
		h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND user_id = ?`, p.ID, viewerID).Scan(&likedInt)
		p.Liked = likedInt > 0
		posts = append(posts, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// POST /api/posts/comment
func (h *PostHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		PostID  int64  `json:"post_id"`
		Content string `json:"content"`
		Image   string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PostID == 0 || (req.Content == "" && req.Image == "") {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO comments (post_id, user_id, content, image) VALUES (?, ?, ?, ?)`,
		req.PostID, userID, req.Content, req.Image,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	commentID, _ := result.LastInsertId()

	// Return full comment object with author info
	var c models.Comment
	h.DB.QueryRow(
		`SELECT c.id, c.post_id, c.user_id, c.content, c.image, c.created_at,
		        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,''), COALESCE(u.nickname,'')
		 FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`, commentID,
	).Scan(&c.ID, &c.PostID, &c.UserID, &c.Content, &c.Image, &c.CreatedAt,
		&c.AuthorFirstName, &c.AuthorLastName, &c.AuthorAvatar, &c.AuthorNickname)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// GET /api/posts/comments?post_id=1
func (h *PostHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	postID, _ := strconv.ParseInt(r.URL.Query().Get("post_id"), 10, 64)

	rows, err := h.DB.Query(
		`SELECT c.id, c.post_id, c.user_id, c.content, c.image, c.created_at,
		        COALESCE(u.first_name,''), COALESCE(u.last_name,''), COALESCE(u.avatar,''), COALESCE(u.nickname,'')
		 FROM comments c LEFT JOIN users u ON u.id = c.user_id
		 WHERE c.post_id = ? ORDER BY c.created_at ASC`, postID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var c models.Comment
		rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Content, &c.Image, &c.CreatedAt,
			&c.AuthorFirstName, &c.AuthorLastName, &c.AuthorAvatar, &c.AuthorNickname)
		comments = append(comments, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

// DELETE /api/posts?id=:id
func (h *PostHandler) DeletePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	postID, err := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if err != nil || postID == 0 {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	// Only owner can delete
	var ownerID int64
	row := h.DB.QueryRow(`SELECT user_id FROM posts WHERE id = ?`, postID)
	if err := row.Scan(&ownerID); err != nil || ownerID != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM post_likes WHERE post_id = ?`, postID)
	h.DB.Exec(`DELETE FROM post_allowed_users WHERE post_id = ?`, postID)
	h.DB.Exec(`DELETE FROM comments WHERE post_id = ?`, postID)
	_, err = h.DB.Exec(`DELETE FROM posts WHERE id = ?`, postID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// POST /api/posts/like  body: {post_id: N}
// Returns {liked: bool, likes: N}
func (h *PostHandler) ToggleLike(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		PostID int64 `json:"post_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PostID == 0 {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	// Check if already liked
	var exists int
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND user_id = ?`, req.PostID, userID).Scan(&exists)

	var liked bool
	if exists > 0 {
		h.DB.Exec(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, req.PostID, userID)
		liked = false
	} else {
		h.DB.Exec(`INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`, req.PostID, userID)
		liked = true
	}

	var count int64
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ?`, req.PostID).Scan(&count)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"liked": liked, "likes": count})
}
