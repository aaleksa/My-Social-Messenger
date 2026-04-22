package handlers

import (
	"encoding/json"
	"net/http"
	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"strconv"
	"time"

	ws "social-network/pkg/websocket"
)

type FollowerHandler struct {
	DB  *sqlite.DB
	Hub *ws.Hub
}

func NewFollowerHandler(db *sqlite.DB, hub *ws.Hub) *FollowerHandler {
	return &FollowerHandler{DB: db, Hub: hub}
}

func (h *FollowerHandler) pushNotif(userID int64) {
	if h.Hub == nil {
		return
	}
	h.Hub.SendToUser(userID, ws.WSMessage{
		Type:      "notification",
		Content:   "new",
		CreatedAt: time.Now(),
	})
}

// POST /api/follow  body: {"following_id": 2}
func (h *FollowerHandler) Follow(w http.ResponseWriter, r *http.Request) {
	followerID := middleware.GetUserID(r)

	var req struct {
		FollowingID int64 `json:"following_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.FollowingID == 0 {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var isPublic bool
	h.DB.QueryRow(`SELECT is_public FROM users WHERE id = ?`, req.FollowingID).Scan(&isPublic)

	status := "pending"
	if isPublic {
		status = "accepted"
	}

	_, err := h.DB.Exec(
		`INSERT OR IGNORE INTO followers (follower_id, following_id, status) VALUES (?, ?, ?)`,
		followerID, req.FollowingID, status,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if !isPublic {
		// Notify the target user of the follow request
		h.DB.Exec(
			`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'follow_request', ?)`,
			req.FollowingID, followerID, followerID,
		)
		h.pushNotif(req.FollowingID)
	} else {
		// Public profile: notify that someone followed them
		h.DB.Exec(
			`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'follow', ?)`,
			req.FollowingID, followerID, followerID,
		)
		h.pushNotif(req.FollowingID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": status})
}

// POST /api/follow/respond  body: {"follower_id": 1, "accept": true}
func (h *FollowerHandler) RespondToFollow(w http.ResponseWriter, r *http.Request) {
	followingID := middleware.GetUserID(r)

	var req struct {
		FollowerID int64 `json:"follower_id"`
		Accept     bool  `json:"accept"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Accept {
		h.DB.Exec(
			`UPDATE followers SET status = 'accepted' WHERE follower_id = ? AND following_id = ?`,
			req.FollowerID, followingID,
		)
		// Notify the follower that their request was accepted
		h.DB.Exec(
			`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'follow_accept', ?)`,
			req.FollowerID, followingID, followingID,
		)
		h.pushNotif(req.FollowerID)
	} else {
		h.DB.Exec(
			`DELETE FROM followers WHERE follower_id = ? AND following_id = ?`,
			req.FollowerID, followingID,
		)
	}

	w.WriteHeader(http.StatusOK)
}

// DELETE /api/follow?following_id=2
func (h *FollowerHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
	followerID := middleware.GetUserID(r)
	followingID, _ := strconv.ParseInt(r.URL.Query().Get("following_id"), 10, 64)
	h.DB.Exec(
		`DELETE FROM followers WHERE follower_id = ? AND following_id = ?`,
		followerID, followingID,
	)
	w.WriteHeader(http.StatusOK)
}

// GET /api/follow?user_id=1
func (h *FollowerHandler) ListFollowers(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)

	rows, err := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar
		 FROM followers f JOIN users u ON u.id = f.follower_id
		 WHERE f.following_id = ? AND f.status = 'accepted'`, userID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserMin struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Avatar    string `json:"avatar"`
	}

	var users []UserMin
	for rows.Next() {
		var u UserMin
		rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar)
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GET /api/follow/following?user_id=1  — list users that user_id is following
func (h *FollowerHandler) ListFollowing(w http.ResponseWriter, r *http.Request) {
	userID, _ := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)

	rows, err := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar
		 FROM followers f JOIN users u ON u.id = f.following_id
		 WHERE f.follower_id = ? AND f.status = 'accepted'`, userID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserMin struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Avatar    string `json:"avatar"`
	}

	var users []UserMin
	for rows.Next() {
		var u UserMin
		rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar)
		users = append(users, u)
	}
	if users == nil {
		users = []UserMin{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GET /api/follow/requests  — list pending follow requests sent TO the current user
func (h *FollowerHandler) PendingRequests(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar
		 FROM followers f JOIN users u ON u.id = f.follower_id
		 WHERE f.following_id = ? AND f.status = 'pending'`, userID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserMin struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Avatar    string `json:"avatar"`
	}

	var users []UserMin
	for rows.Next() {
		var u UserMin
		rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar)
		users = append(users, u)
	}
	if users == nil {
		users = []UserMin{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
