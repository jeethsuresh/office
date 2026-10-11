package server

import (
	"bytes"
	"encoding/json"
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
	"office/backend/internal/store"
	"strings"
	"testing"
	"time"
)

func setup(t *testing.T) (*Server, *httptest.Server, *store.Store) {
	t.Helper()
	st, e := store.Open(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	svc := New(st, "", "")
	httpServer := httptest.NewServer(svc.Handler())
	t.Cleanup(func() { svc.Close(); httpServer.Close() })
	return svc, httpServer, st
}
func dial(t *testing.T, url, id string) *websocket.Conn {
	t.Helper()
	c, _, e := websocket.DefaultDialer.Dial(strings.Replace(url, "http", "ws", 1)+"/api/documents/"+id+"/ws", nil)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}
func frame(t *testing.T, c *websocket.Conn) []byte {
	t.Helper()
	_ = c.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, b, e := c.ReadMessage()
	if e != nil {
		t.Fatal(e)
	}
	return b
}
func ready(t *testing.T, c *websocket.Conn) {
	t.Helper()
	for {
		b := frame(t, c)
		if b[0] == Ready {
			return
		}
	}
}
func TestWebSocketBroadcastRoomIsolationAndDurableAck(t *testing.T) {
	_, server, st := setup(t)
	doc, _ := st.AddDocument("Together", "")
	other, _ := st.AddDocument("Separate", "")
	a := dial(t, server.URL, doc.ID)
	ready(t, a)
	b := dial(t, server.URL, doc.ID)
	ready(t, b)
	if f := frame(t, a); f[0] != AwarenessRequest {
		t.Fatal("presence refresh missing")
	}
	isolated := dial(t, server.URL, other.ID)
	ready(t, isolated)
	update := []byte{Update, 9, 8, 7}
	if e := a.WriteMessage(websocket.BinaryMessage, update); e != nil {
		t.Fatal(e)
	}
	if f := frame(t, a); f[0] != Ack {
		t.Fatal("ack missing")
	}
	if f := frame(t, b); !bytes.Equal(f, update) {
		t.Fatal("peer did not receive update")
	}
	stored, e := st.ReadJournal(doc.ID)
	if e != nil || len(stored) != 1 || !bytes.Equal(stored[0], update[1:]) {
		t.Fatal("ack arrived before persistence")
	}
	isolatedUpdates, _ := st.ReadJournal(other.ID)
	if len(isolatedUpdates) != 0 {
		t.Fatal("room data leaked")
	}
	c := dial(t, server.URL, doc.ID)
	if f := frame(t, c); !bytes.Equal(f, update) {
		t.Fatal("new peer did not hydrate")
	}
	ready(t, c)
}
func TestHydrationHandlesMoreThanSendBuffer(t *testing.T) {
	_, server, st := setup(t)
	doc, _ := st.AddDocument("Long journal", "")
	for i := 0; i < 600; i++ {
		if e := st.Append(doc.ID, []byte{byte(i % 255), 1}); e != nil {
			t.Fatal(e)
		}
	}
	c := dial(t, server.URL, doc.ID)
	count := 0
	for {
		f := frame(t, c)
		if f[0] == Ready {
			break
		}
		if f[0] == Update {
			count++
		}
	}
	if count != 600 {
		t.Fatalf("hydrated %d records", count)
	}
}
func TestOriginAndValidation(t *testing.T) {
	_, server, _ := setup(t)
	req, _ := http.NewRequest("POST", server.URL+"/api/documents", strings.NewReader(`{"name":"injected"}`))
	req.Header.Set("Origin", "https://evil.example")
	res, e := http.DefaultClient.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	_ = res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal("cross-origin mutation allowed")
	}
	for _, body := range []string{`{"name":" "}`, `{"name":"Hello","extra":true}`, `{"name":"Hello"}{}`} {
		res, e = http.Post(server.URL+"/api/documents", "application/json", strings.NewReader(body))
		if e != nil {
			t.Fatal(e)
		}
		_ = res.Body.Close()
		if res.StatusCode != 400 {
			t.Fatalf("invalid payload accepted %s", body)
		}
	}
	res, e = http.Get(server.URL + "/api/workspace")
	if e != nil {
		t.Fatal(e)
	}
	defer res.Body.Close()
	var ws store.Workspace
	if e = json.NewDecoder(res.Body).Decode(&ws); e != nil || len(ws.Documents) != 1 {
		t.Fatal("workspace response invalid")
	}
}
