package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"strconv"
	"time"
)

type PinHandler struct {
	DB *sqlite.DB
}

func NewPinHandler(db *sqlite.DB) *PinHandler {
	return &PinHandler{DB: db}
}

// POST /api/messages/pin {message_id, group_id (optional)}
func (h *PinHandler) PinMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		MessageID int64  `json:"message_id"`
		GroupID   *int64 `json:"group_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`INSERT INTO pins (user_id, message_id, group_id, created_at) VALUES (?, ?, ?, ?)`, userID, req.MessageID, req.GroupID, time.Now().Format(time.RFC3339))
	if err != nil {
		http.Error(w, "failed to pin message", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/messages/pin?message_id=X&group_id=Y
func (h *PinHandler) UnpinMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	msgID, _ := strconv.ParseInt(r.URL.Query().Get("message_id"), 10, 64)
	groupIDStr := r.URL.Query().Get("group_id")
	var err error
	if groupIDStr != "" {
		_, err = h.DB.Exec(`DELETE FROM pins WHERE user_id = ? AND message_id = ? AND group_id = ?`, userID, msgID, groupIDStr)
	} else {
		_, err = h.DB.Exec(`DELETE FROM pins WHERE user_id = ? AND message_id = ? AND group_id IS NULL`, userID, msgID)
	}
	if err != nil {
		http.Error(w, "failed to unpin message", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/messages/pin?group_id=X or /api/messages/pin?recipient_id=Y
func (h *PinHandler) ListPinnedMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupIDStr := r.URL.Query().Get("group_id")
	recipientIDStr := r.URL.Query().Get("recipient_id")
	var rows *sql.Rows
	var err error
	if groupIDStr != "" {
		groupID, _ := strconv.ParseInt(groupIDStr, 10, 64)
		rows, err = h.DB.Query(`SELECT message_id FROM pins WHERE user_id = ? AND group_id = ?`, userID, groupID)
	} else if recipientIDStr != "" {
		// recipientID is not used, just check param present
		rows, err = h.DB.Query(`SELECT message_id FROM pins WHERE user_id = ? AND group_id IS NULL`, userID)
	} else {
		http.Error(w, "missing group_id or recipient_id", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, "failed to list pins", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		rows.Scan(&id)
		ids = append(ids, id)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ids)
}
