package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofrs/uuid"

	"social-network/pkg/middleware"
)


const maxUploadSize = 20 << 20 // 20MB
const uploadsDir = "./uploads"

var allowedFileTypes = map[string]string{
       ".jpg":  "image/jpeg",
       ".jpeg": "image/jpeg",
       ".png":  "image/png",
       ".gif":  "image/gif",
       ".webp": "image/webp",
       ".pdf":  "application/pdf",
       ".doc":  "application/msword",
       ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
       ".mp4":  "video/mp4",
       ".mov":  "video/quicktime",
       ".avi":  "video/x-msvideo",
       ".mp3":  "audio/mpeg",
       ".wav":  "audio/wav",
       ".ogg":  "audio/ogg",
       ".webm": "audio/webm",
}



func UploadFile(w http.ResponseWriter, r *http.Request) {
       _ = middleware.GetUserID(r)
       r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
       if err := r.ParseMultipartForm(maxUploadSize); err != nil {
              http.Error(w, "file too large", http.StatusBadRequest)
              return
       }
       file, header, err := r.FormFile("file")
       if err != nil {
              http.Error(w, "invalid file", http.StatusBadRequest)
              return
       }
       defer file.Close()
       ext := strings.ToLower(filepath.Ext(header.Filename))
       mimeType, ok := allowedFileTypes[ext]
       if !ok {
              http.Error(w, "unsupported file type", http.StatusBadRequest)
              return
       }
       // Optionally, check Content-Type header from client (not trusted, but can be used for extra check)
       // Limit file size (already limited by MaxBytesReader, but double-check)
       if header.Size > maxUploadSize {
              http.Error(w, "file too large", http.StatusBadRequest)
              return
       }
       id, _ := uuid.NewV4()
       filename := fmt.Sprintf("%s%s", id.String(), ext)
       if err := os.MkdirAll(uploadsDir, 0755); err != nil {
              http.Error(w, "internal server error", http.StatusInternalServerError)
              return
       }
       dst, err := os.Create(filepath.Join(uploadsDir, filename))
       if err != nil {
              http.Error(w, "internal server error", http.StatusInternalServerError)
              return
       }
       defer dst.Close()
       if _, err := io.Copy(dst, file); err != nil {
              http.Error(w, "internal server error", http.StatusInternalServerError)
              return
       }
       w.Header().Set("Content-Type", "application/json")
       // Return url, type, original name
       fmt.Fprintf(w, `{"url":"/uploads/%s","type":"%s","name":%q}`, filename, mimeType, header.Filename)
}
