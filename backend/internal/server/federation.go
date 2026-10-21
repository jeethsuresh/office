package server

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"office/backend/internal/gravitas"
	"strings"
)

// The hosted app uses IAM; the local desktop server keeps its loopback mode.
func (s *Server) federated(next http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/gravitas/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		respond(w, 200, map[string]bool{"enabled": s.Federation != nil})
	})
	if s.Federation != nil {
		c := s.Federation
		mux.HandleFunc("GET /auth/gravitas/start", func(w http.ResponseWriter, r *http.Request) {
			if err := c.Start(w, r, false); err != nil {
				fail(w, 503, errors.New("Gravitas sign-in is temporarily unavailable; please try again"))
			}
		})
		mux.HandleFunc("GET /auth/gravitas/register", func(w http.ResponseWriter, r *http.Request) {
			if err := c.Start(w, r, true); err != nil {
				fail(w, 503, errors.New("Gravitas sign-in is temporarily unavailable; please try again"))
			}
		})
		mux.HandleFunc("GET /auth/gravitas/callback", func(w http.ResponseWriter, r *http.Request) {
			identity, back, err := c.Callback(w, r)
			if err != nil {
				if errors.Is(err, gravitas.ErrLoginRequired) || errors.Is(err, gravitas.ErrConsentRequired) {
					http.Redirect(w, r, "/login?next="+url.QueryEscape(gravitas.SafeNext(back)), http.StatusSeeOther)
					return
				}
				fail(w, 400, errors.New("Sign-in could not be completed; start again from the Office login page"))
				return
			}
			if err = c.SetSession(w, identity); err != nil {
				fail(w, 500, errors.New("Unable to create Office session"))
				return
			}
			http.Redirect(w, r, gravitas.SafeNext(back), http.StatusSeeOther)
		})
		mux.HandleFunc("GET /auth/gravitas/session", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			identity, err := c.Session(r)
			if err != nil {
				fail(w, 401, errors.New("Sign in with Gravitas"))
				return
			}
			respond(w, 200, map[string]any{"user": identity})
		})
		mux.HandleFunc("POST /auth/gravitas/logout", func(w http.ResponseWriter, r *http.Request) {
			if !c.ValidMutation(r) {
				fail(w, 403, errors.New("request verification required"))
				return
			}
			c.ClearSession(w)
			respond(w, 200, map[string]bool{"ok": true})
		})
	}
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Federation != nil && strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/health" && r.URL.Path != "/api/readyz" {
			w.Header().Set("Cache-Control", "no-store")
			_, expires, err := s.Federation.SessionInfo(r)
			if err != nil {
				fail(w, 401, errors.New("Sign in with Gravitas"))
				return
			}
			ctx, cancel := context.WithDeadline(r.Context(), expires)
			defer cancel()
			r = r.WithContext(ctx)
			if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions && !s.Federation.ValidMutation(r) {
				fail(w, 403, errors.New("request verification required"))
				return
			}
		}
		next.ServeHTTP(w, r)
	}))
	return mux
}
