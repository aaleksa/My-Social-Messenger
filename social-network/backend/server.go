package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/handlers"
	"social-network/pkg/middleware"
	ws "social-network/pkg/websocket"
)

const defaultPort = ":8080"

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	dbPath := getEnv("DB_PATH", "./social_network.db")
	migrationsPath := getEnv("MIGRATIONS_PATH", "pkg/db/migrations/sqlite")
	port := getEnv("PORT", defaultPort)

	db, err := sqlite.NewDB(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.RunMigrations(migrationsPath); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	hub := ws.NewHub(db.DB)
	go hub.Run()

	authMiddleware := middleware.Auth(db)

	authHandler := handlers.NewAuthHandler(db)
	profileHandler := handlers.NewProfileHandler(db)
	followerHandler := handlers.NewFollowerHandler(db, hub)
	postHandler := handlers.NewPostHandler(db)
	groupHandler := handlers.NewGroupHandler(db, hub)
	notifHandler := handlers.NewNotificationHandler(db)
	chatHandler := handlers.NewChatHandler(db, hub)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Static uploads
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Auth (public)
	mux.HandleFunc("/api/auth/register", authHandler.Register)
	mux.HandleFunc("/api/auth/login", authHandler.Login)
	mux.HandleFunc("/api/auth/logout", authHandler.Logout)

	// Protected routes
	protected := func(h http.HandlerFunc) http.Handler {
		return authMiddleware(http.HandlerFunc(h))
	}

	mux.Handle("/api/me", protected(profileHandler.GetMe))
	mux.Handle("/api/users", protected(profileHandler.ListUsers))
	mux.Handle("/api/profile", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut || r.Method == http.MethodPost {
			profileHandler.UpdateProfile(w, r)
		} else {
			profileHandler.GetProfile(w, r)
		}
	}))
	mux.Handle("/api/profile/privacy", protected(profileHandler.UpdatePrivacy))

	mux.Handle("/api/follow", protected(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			followerHandler.Follow(w, r)
		case http.MethodDelete:
			followerHandler.Unfollow(w, r)
		default:
			followerHandler.ListFollowers(w, r)
		}
	}))
	mux.Handle("/api/follow/respond", protected(followerHandler.RespondToFollow))
	mux.Handle("/api/follow/following", protected(followerHandler.ListFollowing))

	mux.Handle("/api/posts", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			postHandler.CreatePost(w, r)
		} else {
			postHandler.ListPosts(w, r)
		}
	}))
	mux.Handle("/api/posts/comment", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			postHandler.CreateComment(w, r)
		} else {
			postHandler.ListComments(w, r)
		}
	}))

	mux.Handle("/api/groups", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			groupHandler.CreateGroup(w, r)
		} else {
			groupHandler.ListGroups(w, r)
		}
	}))
	mux.Handle("/api/groups/detail", protected(groupHandler.GetGroup))
	mux.Handle("/api/groups/members", protected(groupHandler.ListMembers))
	mux.Handle("/api/groups/invite", protected(groupHandler.InviteMember))
	mux.Handle("/api/groups/join", protected(groupHandler.RequestJoin))
	mux.Handle("/api/groups/respond", protected(groupHandler.RespondToMembership))
	mux.Handle("/api/groups/events", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			groupHandler.CreateEvent(w, r)
		} else {
			groupHandler.ListEvents(w, r)
		}
	}))
	mux.Handle("/api/groups/events/respond", protected(groupHandler.RespondToEvent))

	mux.Handle("/api/notifications", protected(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			notifHandler.MarkRead(w, r)
		} else {
			notifHandler.List(w, r)
		}
	}))

	mux.Handle("/api/messages", protected(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			chatHandler.GetMessages(w, r)
		case http.MethodPost:
			chatHandler.SendMessage(w, r)
		}
	}))
	mux.Handle("/api/messages/group", protected(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			chatHandler.GetGroupMessages(w, r)
		case http.MethodPost:
			chatHandler.SendGroupMessage(w, r)
		}
	}))

	// Online users endpoint
	mux.Handle("/api/online-users", protected(func(w http.ResponseWriter, r *http.Request) {
		details := hub.OnlineUserDetails()
		type entry struct {
			ID         int64  `json:"id"`
			ClientType string `json:"client_type"`
		}
		result := make([]entry, 0, len(details))
		for uid, ct := range details {
			result = append(result, entry{ID: uid, ClientType: ct})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}))

	mux.HandleFunc("/api/upload", handlers.UploadImage)

	// WebSocket endpoint
	mux.Handle("/api/ws", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r)
		ws.ServeWS(hub, w, r, userID)
	})))

	handler := middleware.CORS(mux)

	log.Printf("Server running on %s", port)
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
