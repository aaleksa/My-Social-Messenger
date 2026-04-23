package handlers

import (
	"encoding/json"
	"net/http"
	"social-network/pkg/db/sqlite"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
	"strconv"
	"time"

	ws "social-network/pkg/websocket"
)

type GroupHandler struct {
	DB  *sqlite.DB
	Hub *ws.Hub
}

func NewGroupHandler(db *sqlite.DB, hub *ws.Hub) *GroupHandler {
	return &GroupHandler{DB: db, Hub: hub}
}

func (h *GroupHandler) pushNotif(userID int64) {
	if h.Hub == nil {
		return
	}
	h.Hub.SendToUser(userID, ws.WSMessage{
		Type:      "notification",
		Content:   "new",
		CreatedAt: time.Now(),
	})
}

// POST /api/groups
func (h *GroupHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO groups (creator_id, title, description) VALUES (?, ?, ?)`,
		userID, req.Title, req.Description,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	groupID, _ := result.LastInsertId()
	// Creator is automatically a member
	h.DB.Exec(
		`INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`,
		groupID, userID,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int64{"group_id": groupID})
}

// GET /api/groups
func (h *GroupHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.DB.Query(`
                SELECT g.id, g.creator_id, g.title, g.description, g.created_at,
                       COALESCE((SELECT status FROM group_members WHERE group_id = g.id AND user_id = ?), ''),
                       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'accepted')
                FROM groups g ORDER BY g.created_at DESC`, userID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type GroupRow struct {
		ID          int64     `json:"id"`
		CreatorID   int64     `json:"creator_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		CreatedAt   time.Time `json:"created_at"`
		MyStatus    string    `json:"my_status"`
		MemberCount int       `json:"member_count"`
	}
	var groups []GroupRow
	for rows.Next() {
		var g GroupRow
		rows.Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.CreatedAt, &g.MyStatus, &g.MemberCount)
		groups = append(groups, g)
	}
	if groups == nil {
		groups = []GroupRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// GET /api/groups/detail?id=1
func (h *GroupHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	userID := middleware.GetUserID(r)

	type GroupDetail struct {
		ID          int64     `json:"id"`
		CreatorID   int64     `json:"creator_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		CreatedAt   time.Time `json:"created_at"`
		MyStatus    string    `json:"my_status"`
		MemberCount int       `json:"member_count"`
	}
	var g GroupDetail
	err := h.DB.QueryRow(`
                SELECT g.id, g.creator_id, g.title, g.description, g.created_at,
                       COALESCE((SELECT status FROM group_members WHERE group_id = g.id AND user_id = ?), ''),
                       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'accepted')
                FROM groups g WHERE g.id = ?`, userID, groupID).
		Scan(&g.ID, &g.CreatorID, &g.Title, &g.Description, &g.CreatedAt, &g.MyStatus, &g.MemberCount)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// GET /api/groups/members?group_id=1
func (h *GroupHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("group_id"), 10, 64)

	rows, err := h.DB.Query(`
                SELECT gm.user_id, gm.status, COALESCE(gm.invited_by, 0), gm.joined_at,
                       COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.avatar, '')
                FROM group_members gm
                LEFT JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ? ORDER BY gm.joined_at`, groupID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type MemberRow struct {
		UserID    int64     `json:"user_id"`
		Status    string    `json:"status"`
		InvitedBy int64     `json:"invited_by"`
		JoinedAt  time.Time `json:"joined_at"`
		FirstName string    `json:"first_name"`
		LastName  string    `json:"last_name"`
		Avatar    string    `json:"avatar"`
	}
	var members []MemberRow
	for rows.Next() {
		var m MemberRow
		rows.Scan(&m.UserID, &m.Status, &m.InvitedBy, &m.JoinedAt, &m.FirstName, &m.LastName, &m.Avatar)
		members = append(members, m)
	}
	if members == nil {
		members = []MemberRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// POST /api/groups/invite  body: {"group_id":1,"user_id":2}
func (h *GroupHandler) InviteMember(w http.ResponseWriter, r *http.Request) {
	inviterID := middleware.GetUserID(r)

	var req struct {
		GroupID int64 `json:"group_id"`
		UserID  int64 `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Only the group creator can invite
	var creatorID int64
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, req.GroupID).Scan(&creatorID)
	if inviterID != creatorID {
		http.Error(w, "only the group creator can invite members", http.StatusForbidden)
		return
	}

	_, err := h.DB.Exec(
		`INSERT OR IGNORE INTO group_members (group_id, user_id, status, invited_by) VALUES (?, ?, 'invited', ?)`,
		req.GroupID, req.UserID, inviterID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	h.DB.Exec(
		`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'group_invite', ?)`,
		req.UserID, inviterID, req.GroupID,
	)

	w.WriteHeader(http.StatusOK)
}

// POST /api/groups/join  body: {"group_id":1}
func (h *GroupHandler) RequestJoin(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		GroupID int64 `json:"group_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	h.DB.Exec(
		`INSERT OR IGNORE INTO group_members (group_id, user_id, status) VALUES (?, ?, 'pending')`,
		req.GroupID, userID,
	)

	// Notify group creator
	var creatorID int64
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, req.GroupID).Scan(&creatorID)
	h.DB.Exec(
		`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'group_join_request', ?)`,
		creatorID, userID, req.GroupID,
	)
	h.pushNotif(creatorID)

	w.WriteHeader(http.StatusOK)
}

// POST /api/groups/respond  body: {"group_id":1,"user_id":2,"accept":true}
func (h *GroupHandler) RespondToMembership(w http.ResponseWriter, r *http.Request) {
	responderID := middleware.GetUserID(r)

	var req struct {
		GroupID int64 `json:"group_id"`
		UserID  int64 `json:"user_id"`
		Accept  bool  `json:"accept"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validate responder is creator (for join requests) or the invited user
	var creatorID int64
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, req.GroupID).Scan(&creatorID)

	if responderID != creatorID && responderID != req.UserID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if req.Accept {
		h.DB.Exec(
			`UPDATE group_members SET status = 'accepted' WHERE group_id = ? AND user_id = ?`,
			req.GroupID, req.UserID,
		)
		// Notify user that they were accepted into the group
		h.DB.Exec(
			`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'group_join_accepted', ?)`,
			req.UserID, responderID, req.GroupID,
		)
		h.pushNotif(req.UserID)
	} else {
		h.DB.Exec(
			`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
			req.GroupID, req.UserID,
		)
	}

	w.WriteHeader(http.StatusOK)
}

// POST /api/groups/events
func (h *GroupHandler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		GroupID     int64  `json:"group_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		EventTime   string `json:"event_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO group_events (group_id, creator_id, title, description, event_time) VALUES (?, ?, ?, ?, ?)`,
		req.GroupID, userID, req.Title, req.Description, req.EventTime,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	eventID, _ := result.LastInsertId()

	// Notify all group members + push WS
	rows, _ := h.DB.Query(
		`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted' AND user_id != ?`,
		req.GroupID, userID,
	)
	defer rows.Close()
	for rows.Next() {
		var memberID int64
		rows.Scan(&memberID)
		h.DB.Exec(
			`INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'group_event', ?)`,
			memberID, userID, eventID,
		)
		h.pushNotif(memberID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int64{"event_id": eventID})
}

// POST /api/groups/events/respond  body: {"event_id":1,"response":"going|not_going|"}
// Sending response="" removes the user's RSVP (toggle off)
func (h *GroupHandler) RespondToEvent(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		EventID  int64  `json:"event_id"`
		Response string `json:"response"` // going | not_going | "" (remove)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Response == "" {
		// Toggle off — remove the response
		h.DB.Exec(`DELETE FROM event_responses WHERE event_id = ? AND user_id = ?`, req.EventID, userID)
	} else {
		h.DB.Exec(
			`INSERT OR REPLACE INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)`,
			req.EventID, userID, req.Response,
		)
	}

	w.WriteHeader(http.StatusOK)
}

// DELETE /api/groups/events?id=1  — only event creator or group creator
func (h *GroupHandler) DeleteEvent(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	eventID, _ := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if eventID == 0 {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	// Allow only the event creator or group creator
	var creatorID, groupID int64
	if err := h.DB.QueryRow(`SELECT creator_id, group_id FROM group_events WHERE id = ?`, eventID).Scan(&creatorID, &groupID); err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	var groupCreatorID int64
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&groupCreatorID)
	if userID != creatorID && userID != groupCreatorID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM group_events WHERE id = ?`, eventID)
	w.WriteHeader(http.StatusOK)
}

// PUT /api/groups/events  body: {"id":1,"title":"...","description":"...","event_time":"..."}
// Only event creator or group creator
func (h *GroupHandler) UpdateEvent(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		EventTime   string `json:"event_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == 0 || req.Title == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var creatorID, groupID int64
	if err := h.DB.QueryRow(`SELECT creator_id, group_id FROM group_events WHERE id = ?`, req.ID).Scan(&creatorID, &groupID); err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	var groupCreatorID int64
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&groupCreatorID)
	if userID != creatorID && userID != groupCreatorID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(
		`UPDATE group_events SET title = ?, description = ?, event_time = ? WHERE id = ?`,
		req.Title, req.Description, req.EventTime, req.ID,
	)
	w.WriteHeader(http.StatusOK)
}

// GET /api/groups/events?group_id=1
func (h *GroupHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("group_id"), 10, 64)
	viewerID := middleware.GetUserID(r)

	rows, err := h.DB.Query(
		`SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description, ge.event_time, ge.created_at,
		        COALESCE(er.response, '') AS user_response,
		        (SELECT COUNT(*) FROM event_responses WHERE event_id = ge.id AND response = 'going') AS going_count,
		        (SELECT COUNT(*) FROM event_responses WHERE event_id = ge.id AND response = 'not_going') AS not_going_count
		 FROM group_events ge
		 LEFT JOIN event_responses er ON er.event_id = ge.id AND er.user_id = ?
		 WHERE ge.group_id = ? ORDER BY ge.event_time ASC`,
		viewerID, groupID,
	)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []models.GroupEvent
	for rows.Next() {
		var e models.GroupEvent
		rows.Scan(&e.ID, &e.GroupID, &e.CreatorID, &e.Title, &e.Description, &e.EventTime, &e.CreatedAt, &e.UserResponse, &e.GoingCount, &e.NotGoingCount)
		events = append(events, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
