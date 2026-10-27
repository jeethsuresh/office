package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestPWAAssetsRevalidateAndDeclareTypes(t *testing.T) {
	root := t.TempDir()
	for name, content := range map[string]string{"index.html": "<!doctype html>", "sw.js": "/* worker */", "manifest.webmanifest": `{ "name": "Office" }`} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	s := &Server{WebDir: root}
	for _, path := range []string{"/sw.js", "/manifest.webmanifest", "/"} {
		response := httptest.NewRecorder()
		s.static(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-cache" {
			t.Fatalf("%s: %d %v", path, response.Code, response.Header())
		}
		if path == "/manifest.webmanifest" && response.Header().Get("Content-Type") != "application/manifest+json" {
			t.Fatal("manifest must have its PWA MIME type")
		}
		if path == "/sw.js" && response.Header().Get("Service-Worker-Allowed") != "/" {
			t.Fatal("worker must control the root scope")
		}
	}
}
