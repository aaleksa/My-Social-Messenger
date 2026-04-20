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

const maxUploadSize = 10 << 20
const uploadsDir = "./uploads"

var allowedTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
}

func UploadImage(w http.ResponseWriter, r *http.Request) {
	_ = middleware.GetUserID(r)
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "file too large", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "invalid file", http.StatusBadRequest)
		return
	}
	defer file.Close()
	buf := make([]byte, 512)
	if _, err := file.Read(buf); err != nil {
		http.Error(w, "cannot read file", http.StatusInternalServerError)
		return
	}
	contentType := http.DetectContentType(buf)
	if !allowedTypes[contentType] {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}
	file.Seek(0, io.SeekStart)
	ext := strings.ToLower(filepath.Ext(header.Filename))
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
	fmt.Fprintf(w, `{"url":"/uploads/%s"}`, filename)
}
