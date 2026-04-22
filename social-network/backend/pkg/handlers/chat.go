package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
	ws "social-network/pkg/websocket"
)

type ChatHandler struct {
	DB  *sqlite.DB
	Hub *ws.Hub
}

func NewChatHandler(db *sqlite.DB, hub *ws.Hub) *ChatHandler {
	return &ChatHandler{DB: db, Hub: hub}
}

// GET /api/messages?recipient_id=X
func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	recipientID, _ := strconv.ParseInt(r.URL.Query().Get("recipient_id"), 10, 64)
	rows, err := h.DB.Query(
		`SELECT id, sender_id, recipient_id, content, image_url, created_at FROM messages
		 WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
		 ORDER BY created_at ASC`, senderID, recipientID, recipientID, senderID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var messages []models.Message
	for rows.Next() {
		var m models.Message
		rows.Scan(&m.ID, &m.SenderID, &m.RecipientID, &m.Content, &m.ImageURL, &m.CreatedAt)
		messages = append(messages, m)
	}
	if messages == nil {
		messages = []models.Message{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// POST /api/messages  body: {"recipient_id":2,"content":"hi"}
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	var req struct {
		RecipientID int64  `json:"recipient_id"`
		Content     string `json:"content"`
		ImageURL    string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Content == "" && req.ImageURL == "") {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	// At least one must follow the other
	var cnt int
	h.DB.QueryRow(
		`SELECT COUNT(*) FROM followers
		 WHERE ((follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?))
		   AND status = 'accepted'`,
		senderID, req.RecipientID, req.RecipientID, senderID,
	).Scan(&cnt)
	if cnt == 0 {
		http.Error(w, "forbidden: no follow relationship", http.StatusForbidden)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO messages (sender_id, recipient_id, content, image_url) VALUES (?, ?, ?, ?)`,
		senderID, req.RecipientID, req.Content, req.ImageURL,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()

	// Real-time push via WebSocket
	if h.Hub != nil {
		h.Hub.SendToUser(req.RecipientID, ws.WSMessage{
			Type:        "chat_message",
			SenderID:    senderID,
			RecipientID: req.RecipientID,
			Content:     req.Content,
			CreatedAt:   time.Now(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

// POST /api/messages/group  body: {"group_id":1,"content":"hi"}
func (h *ChatHandler) SendGroupMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	var req struct {
		GroupID  int64  `json:"group_id"`
		Content  string `json:"content"`
		ImageURL string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Content == "" && req.ImageURL == "") {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	var cnt int
	h.DB.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'accepted'`,
		req.GroupID, senderID,
	).Scan(&cnt)
	if cnt == 0 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO group_messages (group_id, sender_id, content, image_url) VALUES (?, ?, ?, ?)`,
		req.GroupID, senderID, req.Content, req.ImageURL,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()

	// Broadcast to all group members via WebSocket (including sender for multi-device support)
	if h.Hub != nil {
		memberRows, _ := h.DB.Query(
			`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted'`,
			req.GroupID,
		)
		var memberIDs []int64
		for memberRows.Next() {
			var uid int64
			memberRows.Scan(&uid)
			memberIDs = append(memberIDs, uid)
		}
		memberRows.Close()
		if len(memberIDs) > 0 {
			h.Hub.BroadcastToUsers(memberIDs, ws.WSMessage{
				Type:      "group_message",
				SenderID:  senderID,
				GroupID:   req.GroupID,
				Content:   req.Content,
				CreatedAt: time.Now(),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

// GET /api/messages/group?group_id=1
func (h *ChatHandler) GetGroupMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("group_id"), 10, 64)
	var cnt int
	h.DB.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'accepted'`,
		groupID, userID,
	).Scan(&cnt)
	if cnt == 0 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	rows, err := h.DB.Query(
		`SELECT id, group_id, sender_id, content, image_url, created_at FROM group_messages WHERE group_id = ? ORDER BY created_at ASC`,
		groupID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var messages []models.GroupMessage
	for rows.Next() {
		var m models.GroupMessage
		rows.Scan(&m.ID, &m.GroupID, &m.SenderID, &m.Content, &m.ImageURL, &m.CreatedAt)
		messages = append(messages, m)
	}
	if messages == nil {
		messages = []models.GroupMessage{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
