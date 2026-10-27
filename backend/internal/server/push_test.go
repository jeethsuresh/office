package server

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"office/backend/internal/push"
	"office/backend/internal/store"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type pushTransport func(*http.Request) (*http.Response, error)

func (f pushTransport) Do(r *http.Request) (*http.Response, error) { return f(r) }
func TestPushSubscriptionReceivesClosedAppCollaboratorRound(t *testing.T) {
	st, e := store.Open(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	publisher, e := push.Open(filepath.Join(t.TempDir(), "push.json"))
	if e != nil {
		t.Fatal(e)
	}
	now := time.Now()
	publisher.Now = func() time.Time { return now }
	svc := New(st, "", "")
	svc.Push = publisher
	server := httptest.NewServer(svc.Handler())
	defer server.Close()
	defer svc.Close()
	keyReq, _ := http.NewRequest("GET", server.URL+"/api/push/key", nil)
	res, e := http.DefaultClient.Do(keyReq)
	if e != nil {
		t.Fatal(e)
	}
	var config map[string]string
	_ = json.NewDecoder(res.Body).Decode(&config)
	_ = res.Body.Close()
	cookies := res.Cookies()
	if config["publicKey"] == "" || len(cookies) != 1 {
		t.Fatal("missing VAPID key or device binding")
	}
	private, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	_, _ = rand.Read(auth)
	body := `{"endpoint":"https://fcm.googleapis.com/test","keys":{"auth":"` + base64.RawURLEncoding.EncodeToString(auth) + `","p256dh":"` + base64.RawURLEncoding.EncodeToString(private.PublicKey().Bytes()) + `"}}`
	subscribe := func(csrf bool) int {
		req, _ := http.NewRequest("POST", server.URL+"/api/push/subscription", strings.NewReader(body))
		req.AddCookie(cookies[0])
		if csrf {
			req.Header.Set("X-Gravitas-CSRF", "1")
		}
		res, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		_ = res.Body.Close()
		return res.StatusCode
	}
	if subscribe(false) != 403 || subscribe(true) != 200 {
		t.Fatal("subscription did not enforce request verification")
	}
	calls := 0
	publisher.Client = pushTransport(func(*http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 201, Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	doc, _ := st.AddDocument("Together", "")
	c := dial(t, server.URL, doc.ID)
	ready(t, c)
	if e = c.WriteMessage(2, []byte{Update, 1, 2, 3, 4}); e != nil {
		t.Fatal(e)
	}
	if frame(t, c)[0] != Ack {
		t.Fatal("edit did not persist")
	}
	_ = c.Close() // no open recipient page or socket required
	now = now.Add(9 * time.Minute)
	publisher.Dispatch(context.Background(), now)
	if calls != 0 {
		t.Fatal("notified before quiet period")
	}
	now = now.Add(time.Minute)
	publisher.Dispatch(context.Background(), now)
	if calls != 1 {
		t.Fatal("closed-app collaborator round did not notify")
	}
	req, _ := http.NewRequest("DELETE", server.URL+"/api/push/subscription", strings.NewReader(`{"endpoint":"https://fcm.googleapis.com/test"}`))
	req.AddCookie(cookies[0])
	req.Header.Set("X-Gravitas-CSRF", "1")
	res, e = http.DefaultClient.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	_ = res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal("unsubscribe failed")
	}
	svc.notifyActivity(httptest.NewRequest("POST", "/", nil), doc.ID)
	now = now.Add(10 * time.Minute)
	publisher.Dispatch(context.Background(), now)
	if calls != 1 {
		t.Fatal("unsubscribed device was notified")
	}
}
