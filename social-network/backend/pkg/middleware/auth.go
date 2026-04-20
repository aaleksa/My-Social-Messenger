package middleware

import (
	"context"
	"net/http"

	"social-network/pkg/db/sqlite"
)

type contextKey string

const userIDKey contextKey = "userID"

func Auth(db *sqlite.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Accept session from: 1) X-Session-ID header, 2) cookie, 3) query param (WebSocket)
			sessionID := r.Header.Get("X-Session-ID")
			if sessionID == "" {
				if cookie, err := r.Cookie("session_id"); err == nil {
					sessionID = cookie.Value
				}
			}
			if sessionID == "" {
				sessionID = r.URL.Query().Get("session_id")
			}
			if sessionID == "" {
				http.Error(w, "not authenticated", http.StatusUnauthorized)
				return
			}

			var userID int64
			err := db.QueryRow(
				`SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')`,
				sessionID,
			).Scan(&userID)
			if err != nil {
				http.Error(w, "not authenticated", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(r *http.Request) int64 {
	if id, ok := r.Context().Value(userIDKey).(int64); ok {
		return id
	}
	return 0
}

var allowedOrigins = map[string]bool{
	"http://localhost:3000": true,
	"http://localhost:8081": true,
	// Electron renderer uses file:// which browsers report as "null"
	"null": true,
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" || allowedOrigins[origin] {
			if origin == "" {
				origin = "http://localhost:3000"
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Session-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
