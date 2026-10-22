package server

import (
	"context"
	"github.com/gorilla/websocket"
	"net"
	"net/http"
	"net/http/httptest"
	"office/backend/internal/store"
	"strings"
	"testing"
	"time"
)

func TestFederatedGuardCoversAPIAndWebSocket(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(st, "", "")
	defer svc.Close()
	c, identity, _ := officeBoundFixture(t)
	svc.Federation = c
	handler := svc.Handler()
	for _, path := range []string{"/api/workspace", "/api/documents/unknown/ws"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 401 {
			t.Fatalf("%s bypassed auth: %d", path, w.Code)
		}
	}
	saved := httptest.NewRecorder()
	if err = c.SetSession(saved, identity); err != nil {
		t.Fatal(err)
	}
	cookie := saved.Result().Cookies()[0]
	req := httptest.NewRequest("GET", "/api/workspace", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatal("valid session refused")
	}
	req = httptest.NewRequest("POST", "/api/documents", strings.NewReader(`{"name":"Auth test"}`))
	req.AddCookie(cookie)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatal("mutation missed CSRF protection")
	}
	req = httptest.NewRequest("POST", "/auth/gravitas/logout", nil)
	req.AddCookie(cookie)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatal("logout missed CSRF protection")
	}
	req = httptest.NewRequest("POST", "/auth/gravitas/logout", nil)
	req.AddCookie(cookie)
	req.Header.Set("X-Gravitas-CSRF", "1")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 200 || w.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("logout did not clear session")
	}
	doc, err := st.AddDocument("Socket test", "")
	if err != nil {
		t.Fatal(err)
	}
	hs := httptest.NewServer(handler)
	defer hs.Close()
	conn, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(hs.URL, "http")+"/api/documents/"+doc.ID+"/ws", http.Header{"Cookie": {cookie.String()}})
	if err != nil {
		t.Fatalf("authenticated socket failed: %v %v", err, resp)
	}
	defer conn.Close()
	if _, _, err = conn.ReadMessage(); err != nil {
		t.Fatal(err)
	}
}
func TestFederationReadinessFailsClosedInLocalMode(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(st, "", "")
	defer svc.Close()
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/readyz", nil))
	if w.Code != 503 {
		t.Fatal("non-federated server passed hosted readiness")
	}
}

func TestWebSocketClosesAtAuthenticationDeadline(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(st, "", "")
	defer svc.Close()
	doc, err := st.AddDocument("Expiry test", "")
	if err != nil {
		t.Fatal(err)
	}
	hs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		svc.Handler().ServeHTTP(w, r.WithContext(ctx))
	}))
	defer hs.Close()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(hs.URL, "http")+"/api/documents/"+doc.ID+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if _, _, err = conn.ReadMessage(); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = conn.ReadMessage()
	if err == nil {
		t.Fatal("socket stayed open past session deadline")
	}
	if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
		t.Fatal("server failed to enforce the authentication deadline")
	}
}
