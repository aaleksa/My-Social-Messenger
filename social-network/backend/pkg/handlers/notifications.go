package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
)

type NotificationHandler struct {
	DB *sqlite.DB
}

func NewNotificationHandler(db *sqlite.DB) *NotificationHandler {
	return &NotificationHandler{DB: db}
}

func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.DB.Query(
		`SELECT n.id, n.user_id, n.actor_id, n.type, n.reference_id, n.is_read, n.created_at,
		        COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.avatar, ''),
		        COALESCE(g.title, '')
		 FROM notifications n
		 LEFT JOIN users u ON u.id = n.actor_id
		 LEFT JOIN groups g ON g.id = n.reference_id
		   AND n.type IN ('group_invite','group_join_request','group_join_accepted','group_event')
		 WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`, userID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type NotifResponse struct {
		ID          int64  `json:"id"`
		UserID      int64  `json:"user_id"`
		ActorID     *int64 `json:"actor_id,omitempty"`
		Type        string `json:"type"`
		ReferenceID *int64 `json:"reference_id,omitempty"`
		IsRead      bool   `json:"is_read"`
		CreatedAt   string `json:"created_at"`
		ActorFirst  string `json:"actor_first_name"`
		ActorLast   string `json:"actor_last_name"`
		ActorAvatar string `json:"actor_avatar"`
		GroupTitle  string `json:"group_title,omitempty"`
	}

	var notifications []NotifResponse
	for rows.Next() {
		var n NotifResponse
		var createdAt interface{}
		rows.Scan(&n.ID, &n.UserID, &n.ActorID, &n.Type, &n.ReferenceID, &n.IsRead, &createdAt,
			&n.ActorFirst, &n.ActorLast, &n.ActorAvatar, &n.GroupTitle)
		switch v := createdAt.(type) {
		case string:
			n.CreatedAt = v
		case []byte:
			n.CreatedAt = string(v)
		case time.Time:
			n.CreatedAt = v.UTC().Format(time.RFC3339)
		default:
			n.CreatedAt = ""
		}
		notifications = append(notifications, n)
	}
	if notifications == nil {
		notifications = []NotifResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		ID  *int64 `json:"id"`
		All bool   `json:"all"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.All {
		h.DB.Exec(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, userID)
	} else if req.ID != nil {
		h.DB.Exec(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, *req.ID, userID)
	}
	w.WriteHeader(http.StatusOK)
}
