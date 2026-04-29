package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gofrs/uuid"
	"golang.org/x/crypto/bcrypt"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/models"
)

type AuthHandler struct {
	DB *sqlite.DB
}

func NewAuthHandler(db *sqlite.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		DateOfBirth string `json:"date_of_birth"`
		Avatar      string `json:"avatar"`
		Nickname    string `json:"nickname"`
		AboutMe     string `json:"about_me"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.DateOfBirth == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO users (email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Email, string(hash), req.FirstName, req.LastName, req.DateOfBirth, req.Avatar, req.Nickname, req.AboutMe,
	)
	if err != nil {
		http.Error(w, "email already in use", http.StatusConflict)
		return
	}

	userID, _ := result.LastInsertId()
	session, err := h.createSession(userID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	       http.SetCookie(w, &http.Cookie{
		       Name:     "session_id",
		       Value:    session.ID,
		       Expires:  session.ExpiresAt,
		       HttpOnly: true,
		       Path:     "/",
		       SameSite: http.SameSiteLaxMode,
		       Secure:   false,
	       })

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"user_id": userID, "session_id": session.ID})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, password FROM users WHERE email = ?`, req.Email,
	).Scan(&user.ID, &user.Password)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	session, err := h.createSession(user.ID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	       http.SetCookie(w, &http.Cookie{
		       Name:     "session_id",
		       Value:    session.ID,
		       Expires:  session.ExpiresAt,
		       HttpOnly: true,
		       Path:     "/",
		       SameSite: http.SameSiteLaxMode,
		       Secure:   false,
	       })

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"user_id": user.ID, "session_id": session.ID})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Header.Get("X-Session-ID")
	if sessionID == "" {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "not logged in", http.StatusUnauthorized)
			return
		}
		sessionID = cookie.Value
	}

	h.DB.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)

	       http.SetCookie(w, &http.Cookie{
		       Name:     "session_id",
		       Value:    "",
		       Expires:  time.Unix(0, 0),
		       HttpOnly: true,
		       Path:     "/",
		       SameSite: http.SameSiteLaxMode,
		       Secure:   false,
	       })

	w.WriteHeader(http.StatusOK)
}

func (h *AuthHandler) createSession(userID int64) (*models.Session, error) {
	id, err := uuid.NewV4()
	if err != nil {
		return nil, err
	}

	session := &models.Session{
		ID:        id.String(),
		UserID:    userID,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	_, err = h.DB.Exec(
		`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
		session.ID, session.UserID, session.ExpiresAt,
	)
	return session, err
}
