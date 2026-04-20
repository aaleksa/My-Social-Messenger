package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"social-network/pkg/models"

	"github.com/gofrs/uuid"
)

type ProfileHandler struct {
	DB *sqlite.DB
}

func NewProfileHandler(db *sqlite.DB) *ProfileHandler {
	return &ProfileHandler{DB: db}
}

func (h *ProfileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	targetID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusBadRequest)
		return
	}

	viewerID := middleware.GetUserID(r)

	var user models.User
	err = h.DB.QueryRow(
		`SELECT id, email, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at
		 FROM users WHERE id = ?`, targetID,
	).Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.DateOfBirth,
		&user.Avatar, &user.Nickname, &user.AboutMe, &user.IsPublic, &user.CreatedAt)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	// Check visibility
	if !user.IsPublic && viewerID != targetID {
		isFollowing := false
		h.DB.QueryRow(
			`SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`,
			viewerID, targetID,
		).Scan(&isFollowing)

		if !isFollowing {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":         user.ID,
				"first_name": user.FirstName,
				"last_name":  user.LastName,
				"avatar":     user.Avatar,
				"is_public":  user.IsPublic,
				"restricted": true,
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *ProfileHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, email, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at
		 FROM users WHERE id = ?`, userID,
	).Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.DateOfBirth,
		&user.Avatar, &user.Nickname, &user.AboutMe, &user.IsPublic, &user.CreatedAt)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *ProfileHandler) UpdatePrivacy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := middleware.GetUserID(r)

	var req struct {
		IsPublic bool `json:"is_public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(`UPDATE users SET is_public = ? WHERE id = ?`, req.IsPublic, userID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// GET /api/users — list all users with follow status for current user
func (h *ProfileHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar, u.is_public,
		        COALESCE(f1.status, '') as follow_status,
		        COALESCE(f2.status, '') as following_me_status
		 FROM users u
		 LEFT JOIN followers f1 ON f1.follower_id = ? AND f1.following_id = u.id
		 LEFT JOIN followers f2 ON f2.follower_id = u.id AND f2.following_id = ?
		 WHERE u.id != ?
		 ORDER BY u.first_name, u.last_name`,
		userID, userID, userID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserItem struct {
		ID               int64  `json:"id"`
		FirstName        string `json:"first_name"`
		LastName         string `json:"last_name"`
		Avatar           string `json:"avatar"`
		IsPublic         bool   `json:"is_public"`
		FollowStatus     string `json:"follow_status"`
		FollowingMeStatus string `json:"following_me_status"`
	}

	var users []UserItem
	for rows.Next() {
		var u UserItem
		rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar, &u.IsPublic, &u.FollowStatus, &u.FollowingMeStatus)
		users = append(users, u)
	}
	if users == nil {
		users = []UserItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// PUT /api/profile  (multipart/form-data: first_name, last_name, nickname, about_me, privacy, avatar)
func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	const maxSize = 10 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		// fallback: try JSON
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	firstName := r.FormValue("first_name")
	lastName := r.FormValue("last_name")
	nickname := r.FormValue("nickname")
	aboutMe := r.FormValue("about_me")
	privacy := r.FormValue("privacy")
	isPublic := privacy != "private"

	// Handle optional avatar upload
	avatarFilename := ""
	file, header, err := r.FormFile("avatar")
	if err == nil {
		defer file.Close()
		ext := filepath.Ext(header.Filename)
		id, _ := uuid.NewV4()
		avatarFilename = id.String() + strings.ToLower(ext)
		if err := os.MkdirAll(uploadsDir, 0755); err == nil {
			if dst, err := os.Create(filepath.Join(uploadsDir, avatarFilename)); err == nil {
				defer dst.Close()
				io.Copy(dst, file)
			}
		}
	}

	if avatarFilename != "" {
		h.DB.Exec(
			`UPDATE users SET first_name=?, last_name=?, nickname=?, about_me=?, is_public=?, avatar=? WHERE id=?`,
			firstName, lastName, nickname, aboutMe, isPublic, avatarFilename, userID,
		)
	} else {
		h.DB.Exec(
			`UPDATE users SET first_name=?, last_name=?, nickname=?, about_me=?, is_public=? WHERE id=?`,
			firstName, lastName, nickname, aboutMe, isPublic, userID,
		)
	}

	var user models.User
	h.DB.QueryRow(
		`SELECT id, email, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at FROM users WHERE id=?`, userID,
	).Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.DateOfBirth,
		&user.Avatar, &user.Nickname, &user.AboutMe, &user.IsPublic, &user.CreatedAt)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
