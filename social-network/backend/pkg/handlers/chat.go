package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
	"strconv"
	"time"

	ws "social-network/pkg/websocket"
)

type ChatHandler struct {
	DB  *sqlite.DB
	Hub *ws.Hub
}

// ...existing methods...

// GET /api/messages/search?recipient_id=X&query=Y
func (h *ChatHandler) SearchMessages(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	recipientIDStr := r.URL.Query().Get("recipient_id")
	groupIDStr := r.URL.Query().Get("group_id")
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "query required", http.StatusBadRequest)
		return
	}
	var rows *sql.Rows
	var err error
	if groupIDStr != "" {
		groupID, _ := strconv.ParseInt(groupIDStr, 10, 64)
		rows, err = h.DB.Query(
			`SELECT id, group_id, sender_id, content, image_url, created_at FROM group_messages WHERE group_id = ? AND content LIKE ? ORDER BY created_at ASC`,
			groupID, "%"+query+"%",
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
		return
	}
	recipientID, _ := strconv.ParseInt(recipientIDStr, 10, 64)
	rows, err = h.DB.Query(
		`SELECT id, sender_id, recipient_id, content, image_url, created_at FROM messages
		WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
		AND content LIKE ? ORDER BY created_at ASC`,
		senderID, recipientID, recipientID, senderID, "%"+query+"%",
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

func NewChatHandler(db *sqlite.DB, hub *ws.Hub) *ChatHandler {
	return &ChatHandler{DB: db, Hub: hub}
}

// POST /api/messages/react  body: {message_id, emoji}
func (h *ChatHandler) ReactMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		MessageID int64  `json:"message_id"`
		Emoji     string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Emoji == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`, req.MessageID, userID, req.Emoji)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/messages/react  body: {message_id, emoji}
func (h *ChatHandler) UnreactMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		MessageID int64  `json:"message_id"`
		Emoji     string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Emoji == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`DELETE FROM message_reactions WHERE message_id=? AND user_id=? AND emoji=?`, req.MessageID, userID, req.Emoji)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/messages/group/react  body: {group_message_id, emoji}
func (h *ChatHandler) ReactGroupMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		GroupMessageID int64  `json:"group_message_id"`
		Emoji          string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Emoji == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`INSERT OR IGNORE INTO group_message_reactions (group_message_id, user_id, emoji) VALUES (?, ?, ?)`, req.GroupMessageID, userID, req.Emoji)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/messages/group/react  body: {group_message_id, emoji}
func (h *ChatHandler) UnreactGroupMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		GroupMessageID int64  `json:"group_message_id"`
		Emoji          string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Emoji == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	_, err := h.DB.Exec(`DELETE FROM group_message_reactions WHERE group_message_id=? AND user_id=? AND emoji=?`, req.GroupMessageID, userID, req.Emoji)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/messages/reactions?message_id=X
func (h *ChatHandler) GetMessageReactions(w http.ResponseWriter, r *http.Request) {
	messageID, _ := strconv.ParseInt(r.URL.Query().Get("message_id"), 10, 64)
	rows, err := h.DB.Query(`SELECT user_id, emoji FROM message_reactions WHERE message_id=?`, messageID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type Reaction struct {
		UserID int64  `json:"user_id"`
		Emoji  string `json:"emoji"`
	}
	var reactions []Reaction
	for rows.Next() {
		var r Reaction
		rows.Scan(&r.UserID, &r.Emoji)
		reactions = append(reactions, r)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reactions)
}

// GET /api/messages/group/reactions?group_message_id=X
func (h *ChatHandler) GetGroupMessageReactions(w http.ResponseWriter, r *http.Request) {
	groupMessageID, _ := strconv.ParseInt(r.URL.Query().Get("group_message_id"), 10, 64)
	rows, err := h.DB.Query(`SELECT user_id, emoji FROM group_message_reactions WHERE group_message_id=?`, groupMessageID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type Reaction struct {
		UserID int64  `json:"user_id"`
		Emoji  string `json:"emoji"`
	}
	var reactions []Reaction
	for rows.Next() {
		var r Reaction
		rows.Scan(&r.UserID, &r.Emoji)
		reactions = append(reactions, r)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reactions)
}

// PUT /api/messages/:id  body: {content, image_url}
func (h *ChatHandler) EditMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	idStr := r.URL.Query().Get("id")
	msgID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	// Forbid editing deleted messages and check time limit
	var deleted bool
	var createdAt time.Time
	err = h.DB.QueryRow(`SELECT deleted, created_at FROM messages WHERE id=? AND sender_id=?`, msgID, senderID).Scan(&deleted, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	} else if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if deleted {
		http.Error(w, "message deleted", http.StatusForbidden)
		return
	}
	// 10-minute edit window
	if time.Since(createdAt) > 10*time.Minute {
		http.Error(w, "edit time expired", http.StatusForbidden)
		return
	}
	var req struct {
		Content  string `json:"content"`
		ImageURL string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Content == "" && req.ImageURL == "") {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	res, err := h.DB.Exec(`UPDATE messages SET content=?, image_url=?, edited_at=CURRENT_TIMESTAMP WHERE id=? AND sender_id=?`, req.Content, req.ImageURL, msgID, senderID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/messages/:id
func (h *ChatHandler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	idStr := r.URL.Query().Get("id")
	msgID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	// Перевірити статус viewed
	var viewed, deleted bool
	err = h.DB.QueryRow(`SELECT viewed, deleted FROM messages WHERE id=? AND sender_id=?`, msgID, senderID).Scan(&viewed, &deleted)
	if err == sql.ErrNoRows {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	} else if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if deleted {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// Додаємо підтримку повного видалення через query-параметр
	fullDelete := r.URL.Query().Get("full_delete") == "true"
	if !viewed || fullDelete {
		// Повністю видалити
		_, err = h.DB.Exec(`DELETE FROM messages WHERE id=? AND sender_id=?`, msgID, senderID)
	} else {
		// Позначити як видалене, очистити контент
		_, err = h.DB.Exec(`UPDATE messages SET deleted=1, content='Повідомлення видалене', image_url='', edited_at=CURRENT_TIMESTAMP WHERE id=? AND sender_id=?`, msgID, senderID)
	}
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PUT /api/messages/group/:id  body: {content, image_url}
func (h *ChatHandler) EditGroupMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	idStr := r.URL.Query().Get("id")
	msgID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	// Forbid editing deleted messages and check time limit
	var deleted bool
	var createdAt time.Time
	err = h.DB.QueryRow(`SELECT deleted, created_at FROM group_messages WHERE id=? AND sender_id=?`, msgID, senderID).Scan(&deleted, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	} else if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if deleted {
		http.Error(w, "message deleted", http.StatusForbidden)
		return
	}
	// 10-minute edit window
	if time.Since(createdAt) > 10*time.Minute {
		http.Error(w, "edit time expired", http.StatusForbidden)
		return
	}
	var req struct {
		Content  string `json:"content"`
		ImageURL string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Content == "" && req.ImageURL == "") {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	res, err := h.DB.Exec(`UPDATE group_messages SET content=?, image_url=?, edited_at=CURRENT_TIMESTAMP WHERE id=? AND sender_id=?`, req.Content, req.ImageURL, msgID, senderID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/messages/group/:id
func (h *ChatHandler) DeleteGroupMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	idStr := r.URL.Query().Get("id")
	msgID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var viewed, deleted bool
	err = h.DB.QueryRow(`SELECT viewed, deleted FROM group_messages WHERE id=? AND sender_id=?`, msgID, senderID).Scan(&viewed, &deleted)
	if err == sql.ErrNoRows {
		http.Error(w, "not found or forbidden", http.StatusForbidden)
		return
	} else if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if deleted {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// Додаємо підтримку повного видалення через query-параметр
	fullDelete := r.URL.Query().Get("full_delete") == "true"
	if !viewed || fullDelete {
		_, err = h.DB.Exec(`DELETE FROM group_messages WHERE id=? AND sender_id=?`, msgID, senderID)
	} else {
		_, err = h.DB.Exec(`UPDATE group_messages SET deleted=1, content='Повідомлення видалене', image_url='', edited_at=CURRENT_TIMESTAMP WHERE id=? AND sender_id=?`, msgID, senderID)
	}
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/messages?recipient_id=X
func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	recipientID, _ := strconv.ParseInt(r.URL.Query().Get("recipient_id"), 10, 64)
	rows, err := h.DB.Query(
		`SELECT id, sender_id, recipient_id, content, image_url, created_at, deleted, edited_at, viewed FROM messages
			WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
			ORDER BY created_at ASC`, senderID, recipientID, recipientID, senderID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var messages []models.Message
	type messageWithEdited struct {
		models.Message
		IsEdited bool `json:"is_edited"`
	}
	for rows.Next() {
		var m models.Message
		var deleted bool
		var editedAt sql.NullTime
		var viewed bool
		rows.Scan(&m.ID, &m.SenderID, &m.RecipientID, &m.Content, &m.ImageURL, &m.CreatedAt, &deleted, &editedAt, &viewed)
		m.Deleted = deleted
		m.Viewed = viewed
		isEdited := false
		if editedAt.Valid {
			m.EditedAt = &editedAt.Time
			isEdited = true
		}
		if deleted {
			m.Content = "Повідомлення видалене"
			m.ImageURL = ""
		}
		messages = append(messages, m)
	}
	// Формуємо новий масив з міткою is_edited
	var out []messageWithEdited
	for _, m := range messages {
		out = append(out, messageWithEdited{Message: m, IsEdited: m.EditedAt != nil})
	}
	if out == nil {
		out = []messageWithEdited{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// POST /api/messages  body: {"recipient_id":2,"content":"hi"}
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	senderID := middleware.GetUserID(r)
	var req struct {
		RecipientID int64  `json:"recipient_id"`
		Content     string `json:"content"`
		ImageURL    string `json:"image_url"`
		ReplyTo     *int64 `json:"reply_to"`
		QuotedText  string `json:"quoted_text"`
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
		`INSERT INTO messages (sender_id, recipient_id, content, image_url, reply_to, quoted_text) VALUES (?, ?, ?, ?, ?, ?)`,
		senderID, req.RecipientID, req.Content, req.ImageURL, req.ReplyTo, req.QuotedText,
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
			QuotedText:  req.QuotedText,
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
		GroupID    int64  `json:"group_id"`
		Content    string `json:"content"`
		ImageURL   string `json:"image_url"`
		ReplyTo    *int64 `json:"reply_to"`
		QuotedText string `json:"quoted_text"`
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
		`INSERT INTO group_messages (group_id, sender_id, content, image_url, reply_to, quoted_text) VALUES (?, ?, ?, ?, ?, ?)`,
		req.GroupID, senderID, req.Content, req.ImageURL, req.ReplyTo, req.QuotedText,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()

	// Broadcast to all OTHER group members via WebSocket (sender sees own msg via optimistic/poll)
	if h.Hub != nil {
		memberRows, _ := h.DB.Query(
			`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted' AND user_id != ?`,
			req.GroupID, senderID,
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
				Type:       "group_message",
				SenderID:   senderID,
				GroupID:    req.GroupID,
				Content:    req.Content,
				QuotedText: req.QuotedText,
				CreatedAt:  time.Now(),
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
		`SELECT id, group_id, sender_id, content, image_url, created_at, deleted, edited_at, viewed FROM group_messages WHERE group_id = ? ORDER BY created_at ASC`,
		groupID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var messages []models.GroupMessage
	type groupMessageWithEdited struct {
		models.GroupMessage
		IsEdited bool `json:"is_edited"`
	}
	for rows.Next() {
		var m models.GroupMessage
		var deleted bool
		var editedAt sql.NullTime
		var viewed bool
		rows.Scan(&m.ID, &m.GroupID, &m.SenderID, &m.Content, &m.ImageURL, &m.CreatedAt, &deleted, &editedAt, &viewed)
		m.Deleted = deleted
		m.Viewed = viewed
		isEdited := false
		if editedAt.Valid {
			m.EditedAt = &editedAt.Time
			isEdited = true
		}
		if deleted {
			m.Content = "Повідомлення видалене"
			m.ImageURL = ""
		}
		messages = append(messages, m)
	}
	// Формуємо новий масив з міткою is_edited
	var out []groupMessageWithEdited
	for _, m := range messages {
		out = append(out, groupMessageWithEdited{GroupMessage: m, IsEdited: m.EditedAt != nil})
	}
	if out == nil {
		out = []groupMessageWithEdited{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
