package websocket

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type WSMessage struct {
	Type        string          `json:"type"`
	SenderID    int64           `json:"sender_id,omitempty"`
	RecipientID int64           `json:"recipient_id,omitempty"`
	GroupID     int64           `json:"group_id,omitempty"`
	Content     string          `json:"content"`
	ClientType  string          `json:"client_type,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	Payload     json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	hub        *Hub
	conn       *websocket.Conn
	send       chan []byte
	userID     int64
	clientType string // "electron" or "web"
}

type Hub struct {
	clients    map[int64]*Client
	broadcast  chan WSMessage
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	db         *sql.DB
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:    make(map[int64]*Client),
		broadcast:  make(chan WSMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		db:         db,
	}
}

// OnlineUserIDs returns the set of currently connected user IDs.
func (h *Hub) OnlineUserIDs() map[int64]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make(map[int64]bool, len(h.clients))
	for uid := range h.clients {
		out[uid] = true
	}
	return out
}

// OnlineUserDetails returns userID → clientType map.
func (h *Hub) OnlineUserDetails() map[int64]string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make(map[int64]string, len(h.clients))
	for uid, c := range h.clients {
		out[uid] = c.clientType
	}
	return out
}

// followerIDs queries mutual/one-way followers of a user from DB.
func (h *Hub) followerIDs(userID int64) []int64 {
	if h.db == nil {
		return nil
	}
	rows, err := h.db.Query(
		`SELECT follower_id FROM followers WHERE following_id = ? AND status = 'accepted'`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		rows.Scan(&id)
		ids = append(ids, id)
	}
	return ids
}

func (h *Hub) broadcastPresence(userID int64, online bool) {
	followers := h.followerIDs(userID)
	if len(followers) == 0 {
		return
	}
	msgType := "presence_offline"
	if online {
		msgType = "presence_online"
	}
	clientType := ""
	if online {
		h.mu.RLock()
		if c, ok := h.clients[userID]; ok {
			clientType = c.clientType
		}
		h.mu.RUnlock()
	}
	msg := WSMessage{Type: msgType, SenderID: userID, ClientType: clientType, CreatedAt: time.Now()}
	h.BroadcastToUsers(followers, msg)
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.userID] = client
			h.mu.Unlock()
			go h.broadcastPresence(client.userID, true)
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.userID]; ok {
				delete(h.clients, client.userID)
				close(client.send)
			}
			h.mu.Unlock()
			go h.broadcastPresence(client.userID, false)
		case msg := <-h.broadcast:
			data, _ := json.Marshal(msg)
			h.mu.RLock()
			if msg.RecipientID != 0 {
				if client, ok := h.clients[msg.RecipientID]; ok {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(h.clients, client.userID)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) SendToUser(userID int64, msg WSMessage) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if ok {
		data, _ := json.Marshal(msg)
		select {
		case client.send <- data:
		default:
		}
	}
}

func (h *Hub) BroadcastToUsers(userIDs []int64, msg WSMessage) {
	data, _ := json.Marshal(msg)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, uid := range userIDs {
		if client, ok := h.clients[uid]; ok {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512 * 1024)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}
		msg.SenderID = c.userID
		msg.CreatedAt = time.Now()
		c.hub.broadcast <- msg
	}
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID int64) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}
	clientType := r.URL.Query().Get("client")
	if clientType == "" {
		clientType = "web"
	}
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256), userID: userID, clientType: clientType}
	hub.register <- client
	go client.writePump()
	go client.readPump()
}
