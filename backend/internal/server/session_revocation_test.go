package server

import (
	"encoding/base64"
	"encoding/json"
	"github.com/gorilla/websocket"
	"io"
	"net/http"
	"net/http/httptest"
	"office/backend/internal/gravitas"
	"office/backend/internal/store"
	"strings"
	"sync"
	"testing"
	"time"
)

type officeAuthority struct {
	mu      sync.Mutex
	auth    map[string]gravitas.Authorization
	revoked map[string]bool
	failure int
	checks  int
}

func (a *officeAuthority) RoundTrip(r *http.Request) (*http.Response, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	code := 200
	var body any
	if r.URL.Path == "/.well-known/iam-configuration" {
		body = map[string]string{"issuer": "https://gravitas.cool", "identity_domain": "gravitas.cool", "browser_initiation_endpoint": "https://gravitas.cool/oauth/start", "token_endpoint": "https://gravitas.cool/oauth/token", "userinfo_endpoint": "https://gravitas.cool/app/v1/me", "session_check_endpoint": "https://gravitas.cool/oauth/session"}
	} else {
		a.checks++
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		auth, ok := a.auth[token]
		if a.failure != 0 {
			code = a.failure
		} else if !ok || a.revoked[token] {
			code = 401
		}
		body = map[string]any{"active": true, "iss": auth.Issuer, "sub": auth.Subject, "app_origin": "https://work.gravitas.cool", "session_id": auth.SessionID, "exp": auth.CheckExpires}
	}
	raw, _ := json.Marshal(body)
	return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(string(raw))), Header: make(http.Header)}, nil
}
func officeBoundFixture(t *testing.T) (*gravitas.Client, gravitas.Authorization, *officeAuthority) {
	t.Helper()
	c, err := gravitas.New("https://gravitas.cool", "https://work.gravitas.cool", base64.RawURLEncoding.EncodeToString(make([]byte, 32)))
	if err != nil {
		t.Fatal(err)
	}
	auth := gravitas.Authorization{Identity: gravitas.Identity{Issuer: c.Issuer, Subject: "subject", Username: "reader", Domain: "gravitas.cool", UserID: "@reader:gravitas.cool"}, CheckToken: base64.RawURLEncoding.EncodeToString(make([]byte, 32)), SessionID: "11111111-1111-4111-8111-111111111111", CheckExpires: time.Now().Add(time.Hour).Unix()}
	authority := &officeAuthority{auth: map[string]gravitas.Authorization{auth.CheckToken: auth}, revoked: map[string]bool{}}
	c.HTTP.Transport = authority
	return c, auth, authority
}
func officeCookie(t *testing.T, c *gravitas.Client, auth gravitas.Authorization) *http.Cookie {
	t.Helper()
	w := httptest.NewRecorder()
	if err := c.SetSession(w, auth); err != nil {
		t.Fatal(err)
	}
	return w.Result().Cookies()[0]
}
func TestOfficeRevokesOnlyTheCurrentFamilyAndPreservesCookieOnOutage(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := New(st, "", "")
	defer svc.Close()
	c, auth, authority := officeBoundFixture(t)
	svc.Federation = c
	handler := svc.Handler()
	cookie := officeCookie(t, c, auth)
	authB := auth
	authB.CheckToken = base64.RawURLEncoding.EncodeToString([]byte(strings.Repeat("b", 32)))
	authB.SessionID = "22222222-2222-4222-8222-222222222222"
	authority.auth[authB.CheckToken] = authB
	cookieB := officeCookie(t, c, authB)
	request := func(cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/api/workspace", nil)
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if w := request(cookie); w.Code != 200 {
		t.Fatal("valid session denied")
	}
	authority.failure = 503
	if w := request(cookie); w.Code != 503 || len(w.Result().Cookies()) != 0 {
		t.Fatal("outage logged out the session or permitted access")
	}
	authority.failure = 0
	if w := request(cookie); w.Code != 200 {
		t.Fatal("session did not recover after outage")
	}
	authority.revoked[auth.CheckToken] = true
	if w := request(cookie); w.Code != 401 || len(w.Result().Cookies()) != 1 || w.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("revoked family retained access")
	}
	if w := request(cookieB); w.Code != 200 {
		t.Fatal("independent family was revoked")
	}
	authority.failure = 503
	r := httptest.NewRequest("POST", "/auth/gravitas/logout", nil)
	r.Header.Set("X-Gravitas-CSRF", "1")
	r.AddCookie(cookieB)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 200 || w.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("local logout depends on IAM availability")
	}
}
func TestOfficeSocketRejectsPostRevocationMutationAndClosesWhenIdle(t *testing.T) {
	for _, idle := range []bool{false, true} {
		t.Run(map[bool]string{false: "mutation", true: "idle"}[idle], func(t *testing.T) {
			st, err := store.Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			svc := New(st, "", "")
			defer svc.Close()
			svc.authRecheckInterval = time.Hour
			if idle {
				svc.authRecheckInterval = 20 * time.Millisecond
			}
			c, auth, authority := officeBoundFixture(t)
			svc.Federation = c
			cookie := officeCookie(t, c, auth)
			doc, err := st.AddDocument("Owned revocation test", "")
			if err != nil {
				t.Fatal(err)
			}
			before, err := st.ReadJournal(doc.ID)
			if err != nil {
				t.Fatal(err)
			}
			server := httptest.NewServer(svc.Handler())
			defer server.Close()
			conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/api/documents/"+doc.ID+"/ws", http.Header{"Cookie": {cookie.String()}})
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			for {
				_, frame, err := conn.ReadMessage()
				if err != nil {
					t.Fatal(err)
				}
				if len(frame) > 0 && frame[0] == Ready {
					break
				}
			}
			authority.mu.Lock()
			authority.revoked[auth.CheckToken] = true
			authority.mu.Unlock()
			if !idle {
				if err = conn.WriteMessage(websocket.BinaryMessage, []byte{Update, 7, 8, 9}); err != nil {
					t.Fatal(err)
				}
			}
			_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
			for {
				_, _, err = conn.ReadMessage()
				if err != nil {
					break
				}
			}
			if !websocket.IsCloseError(err, 4401) {
				t.Fatalf("revoked socket did not close as unauthorized: %v", err)
			}
			after, err := st.ReadJournal(doc.ID)
			if err != nil {
				t.Fatal(err)
			}
			if len(after) != len(before) {
				t.Fatal("revoked socket appended a mutation")
			}
		})
	}
}
