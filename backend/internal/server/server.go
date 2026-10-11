package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"io"
	"log"
	"net/http"
	"net/url"
	"office/backend/internal/store"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	Update byte = iota
	Awareness
	Ready
	Ack
	AwarenessRequest
)

type Server struct {
	Store         *store.Store
	WebDir        string
	AllowedOrigin string
	mu            sync.Mutex
	rooms         map[string]*room
}
type room struct {
	mu      sync.Mutex
	updates [][]byte
	clients map[*client]bool
	refs    int
}
type client struct {
	conn *websocket.Conn
	send chan []byte
	done chan struct{}
	once sync.Once
}

func (c *client) close() { c.once.Do(func() { close(c.done); _ = c.conn.Close() }) }
func (c *client) enqueue(frame []byte) bool {
	select {
	case <-c.done:
		return false
	case c.send <- frame:
		return true
	default:
		c.close()
		return false
	}
}

// Replay uses backpressure rather than dropping a client with a long journal.
func (c *client) enqueueReplay(frame []byte) bool {
	select {
	case <-c.done:
		return false
	case c.send <- frame:
		return true
	case <-time.After(15 * time.Second):
		c.close()
		return false
	}
}

func New(s *store.Store, web, origin string) *Server {
	return &Server{Store: s, WebDir: web, AllowedOrigin: origin, rooms: map[string]*room{}}
}
func (s *Server) originOK(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && (u.Host == r.Host || origin == s.AllowedOrigin)
}
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/workspace", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, s.Store.List()) })
	mux.HandleFunc("POST /api/folders", s.addFolder)
	mux.HandleFunc("PATCH /api/folders/{id}", s.updateFolder)
	mux.HandleFunc("DELETE /api/folders/{id}", s.deleteFolder)
	mux.HandleFunc("POST /api/documents", s.addDocument)
	mux.HandleFunc("PATCH /api/documents/{id}", s.updateDocument)
	mux.HandleFunc("DELETE /api/documents/{id}", s.deleteDocument)
	mux.HandleFunc("GET /api/documents/{id}/ws", s.websocket)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, errors.New("endpoint not found")) })
	mux.HandleFunc("/", s.static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		if !s.originOK(r) {
			fail(w, 403, errors.New("origin is not allowed"))
			return
		}
		if r.Header.Get("Origin") == s.AllowedOrigin && s.AllowedOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", s.AllowedOrigin)
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func respond(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, code int, err error) {
	respond(w, code, map[string]string{"error": err.Error()})
}
func result(w http.ResponseWriter, v any, err error) {
	if err != nil {
		code := 400
		if errors.Is(err, store.ErrNotFound) {
			code = 404
		}
		fail(w, code, err)
		return
	}
	respond(w, 200, v)
}

type mutation struct {
	Name     *string `json:"name"`
	FolderID *string `json:"folderId"`
	ParentID *string `json:"parentId"`
}

func decode(w http.ResponseWriter, r *http.Request) (mutation, bool) {
	var m mutation
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if err := d.Decode(&m); err != nil {
		fail(w, 400, errors.New("invalid request"))
		return m, false
	}
	if d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, errors.New("expected one JSON object"))
		return m, false
	}
	if m.Name != nil {
		n := strings.TrimSpace(*m.Name)
		if n == "" || len(n) > 240 {
			fail(w, 400, errors.New("name must be between 1 and 240 bytes"))
			return m, false
		}
		m.Name = &n
	}
	return m, true
}
func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
func (s *Server) addFolder(w http.ResponseWriter, r *http.Request) {
	m, ok := decode(w, r)
	if !ok {
		return
	}
	if m.Name == nil {
		fail(w, 400, errors.New("name is required"))
		return
	}
	v, e := s.Store.AddFolder(*m.Name, str(m.ParentID))
	result(w, v, e)
}
func (s *Server) addDocument(w http.ResponseWriter, r *http.Request) {
	m, ok := decode(w, r)
	if !ok {
		return
	}
	if m.Name == nil {
		fail(w, 400, errors.New("name is required"))
		return
	}
	v, e := s.Store.AddDocument(*m.Name, str(m.FolderID))
	result(w, v, e)
}
func (s *Server) updateFolder(w http.ResponseWriter, r *http.Request) {
	m, ok := decode(w, r)
	if !ok {
		return
	}
	v, e := s.Store.UpdateFolder(r.PathValue("id"), m.Name, m.ParentID)
	result(w, v, e)
}
func (s *Server) updateDocument(w http.ResponseWriter, r *http.Request) {
	m, ok := decode(w, r)
	if !ok {
		return
	}
	v, e := s.Store.UpdateDocument(r.PathValue("id"), m.Name, m.FolderID)
	result(w, v, e)
}
func (s *Server) deleteFolder(w http.ResponseWriter, r *http.Request) {
	e := s.Store.DeleteFolder(r.PathValue("id"))
	result(w, map[string]bool{"deleted": e == nil}, e)
}
func (s *Server) deleteDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mu.Lock()
	defer s.mu.Unlock()
	room := s.rooms[id]
	if room != nil {
		room.mu.Lock()
		defer room.mu.Unlock()
	}
	e := s.Store.DeleteDocument(id)
	if e == nil && room != nil {
		for c := range room.clients {
			c.close()
		}
		delete(s.rooms, id)
	}
	result(w, map[string]bool{"deleted": e == nil}, e)
}
func (s *Server) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		w.WriteHeader(405)
		return
	}
	if s.WebDir == "" {
		http.Error(w, "Office backend is running. Start the Vite UI or supply -web.", 404)
		return
	}
	clean := filepath.Clean("/" + r.URL.Path)
	p := filepath.Join(s.WebDir, clean)
	if st, e := os.Stat(p); e != nil || st.IsDir() {
		if filepath.Ext(clean) != "" {
			http.NotFound(w, r)
			return
		}
		p = filepath.Join(s.WebDir, "index.html")
	}
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
	http.ServeFile(w, r, p)
}
func (s *Server) getRoom(id string) (*room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.Store.HasDocument(id) {
		return nil, store.ErrNotFound
	}
	if r := s.rooms[id]; r != nil {
		r.refs++
		return r, nil
	}
	updates, e := s.Store.ReadJournal(id)
	if e != nil {
		return nil, e
	}
	r := &room{updates: updates, clients: map[*client]bool{}, refs: 1}
	s.rooms[id] = r
	return r, nil
}
func (s *Server) websocket(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !store.ValidID(id) {
		fail(w, 404, store.ErrNotFound)
		return
	}
	room, e := s.getRoom(id)
	if e != nil {
		result(w, nil, e)
		return
	}
	defer func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		room.refs--
		if room.refs == 0 && s.rooms[id] == room {
			delete(s.rooms, id)
		}
	}()
	up := websocket.Upgrader{CheckOrigin: s.originOK}
	conn, e := up.Upgrade(w, r, nil)
	if e != nil {
		return
	}
	c := &client{conn: conn, send: make(chan []byte, 256), done: make(chan struct{})}
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		defer c.close()
		for {
			select {
			case b := <-c.send:
				_ = conn.SetWriteDeadline(time.Now().Add(15 * time.Second))
				if conn.WriteMessage(websocket.BinaryMessage, b) != nil {
					return
				}
			case <-ticker.C:
				_ = conn.SetWriteDeadline(time.Now().Add(15 * time.Second))
				if conn.WriteMessage(websocket.PingMessage, nil) != nil {
					return
				}
			case <-c.done:
				return
			}
		}
	}()
	// Replay and registration share the room lock; live updates cannot overtake hydration.
	room.mu.Lock()
	for _, u := range room.updates {
		if !c.enqueueReplay(append([]byte{Update}, u...)) {
			break
		}
	}
	room.clients[c] = true
	c.enqueueReplay([]byte{Ready})
	for other := range room.clients {
		if other != c {
			other.enqueue([]byte{AwarenessRequest})
		}
	}
	room.mu.Unlock()
	defer func() {
		c.close()
		room.mu.Lock()
		delete(room.clients, c)
		room.mu.Unlock()
	}()
	conn.SetReadLimit(16 << 20)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	for {
		kind, b, e := conn.ReadMessage()
		if e != nil {
			return
		}
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		if kind != websocket.BinaryMessage || len(b) < 2 {
			continue
		}
		if b[0] != Update && b[0] != Awareness {
			continue
		}
		room.mu.Lock()
		if b[0] == Update {
			if e = s.Store.Append(id, b[1:]); e != nil {
				log.Printf("persist %s: %v", id, e)
				room.mu.Unlock()
				c.close()
				return
			}
			room.updates = append(room.updates, append([]byte{}, b[1:]...))
			c.enqueue([]byte{Ack})
		}
		for other := range room.clients {
			if other != c {
				other.enqueue(b)
			}
		}
		room.mu.Unlock()
	}
}
func (s *Server) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.rooms {
		r.mu.Lock()
		for c := range r.clients {
			c.close()
		}
		r.mu.Unlock()
	}
}
func (s *Server) String() string { return fmt.Sprintf("Office server (%s)", s.WebDir) }
