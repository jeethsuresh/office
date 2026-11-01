package server

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"office/backend/internal/gravitas"
	"strings"
)

type federatedSessionKey struct{}

func (s *Server) federationError(w http.ResponseWriter, err error) {
	if errors.Is(err, gravitas.ErrUnavailable) {
		fail(w, 503, gravitas.ErrUnavailable)
		return
	}
	s.Federation.ClearSession(w)
	fail(w, 401, errors.New("Sign in with Gravitas"))
}

func (s *Server) validateLiveSession(ctx context.Context) error {
	if s.Federation == nil {
		return nil
	}
	bound, ok := ctx.Value(federatedSessionKey{}).(gravitas.AppSession)
	if !ok {
		return gravitas.ErrLoginRequired
	}
	return s.Federation.Revalidate(ctx, bound)
}

// The hosted app uses IAM; the local desktop server keeps its loopback mode.
func (s *Server) federated(next http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/gravitas/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		respond(w, 200, map[string]any{"enabled": s.Federation != nil, "autoSignIn": s.Federation != nil && gravitas.HasSharedSignInHint(r), "defaultDomain": defaultDomain(s.Federation)})
	})
	if s.Federation != nil {
		c := s.Federation
		mux.HandleFunc("GET /auth/gravitas/start", func(w http.ResponseWriter, r *http.Request) {
			if err := c.Start(w, r, false); err != nil {
				if errors.Is(err, gravitas.ErrInvalidUsername) {
					fail(w, 400, err)
					return
				}
				fail(w, 503, errors.New("Gravitas sign-in is temporarily unavailable; please try again"))
			}
		})
		mux.HandleFunc("GET /auth/gravitas/register", func(w http.ResponseWriter, r *http.Request) {
			if err := c.Start(w, r, true); err != nil {
				if errors.Is(err, gravitas.ErrInvalidUsername) {
					fail(w, 400, err)
					return
				}
				fail(w, 503, errors.New("Gravitas sign-in is temporarily unavailable; please try again"))
			}
		})
		mux.HandleFunc("GET /auth/gravitas/callback", func(w http.ResponseWriter, r *http.Request) {
			identity, back, err := c.Callback(w, r)
			if err != nil {
				if errors.Is(err, gravitas.ErrLoginRequired) {
					http.Redirect(w, r, "/login?auto=off&next="+url.QueryEscape(gravitas.SafeNext(back)), http.StatusSeeOther)
					return
				}
				if errors.Is(err, gravitas.ErrConsentRequired) {
					http.Redirect(w, r, "/auth/gravitas/start?next="+url.QueryEscape(gravitas.SafeNext(back)), http.StatusSeeOther)
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
				s.federationError(w, err)
				return
			}
			if identity.Picture != "" {
				identity.Picture = "/auth/gravitas/picture"
			}
			respond(w, 200, map[string]any{"user": identity})
		})
		mux.HandleFunc("GET /auth/gravitas/picture", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			identity, err := c.Session(r)
			if err != nil {
				s.federationError(w, err)
				return
			}
			data, kind, err := c.Picture(r.Context(), identity)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", kind)
			w.Header().Set("X-Content-Type-Options", "nosniff")
			_, _ = w.Write(data)
		})
		mux.HandleFunc("POST /auth/gravitas/logout", func(w http.ResponseWriter, r *http.Request) {
			if !c.ValidMutation(r) {
				fail(w, 403, errors.New("request verification required"))
				return
			}
			if s.Push != nil {
				if cookie, err := r.Cookie(gravitas.SessionCookie); err == nil {
					_ = s.Push.Revoke(cookie.Value)
				}
			}
			c.ClearSession(w)
			respond(w, 200, map[string]bool{"ok": true})
		})
	}
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Federation != nil && strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/health" && r.URL.Path != "/api/readyz" && r.URL.Path != "/api/session-readyz" {
			w.Header().Set("Cache-Control", "no-store")
			bound, err := s.Federation.AppSession(r, gravitas.SessionCookie)
			if err != nil {
				s.federationError(w, err)
				return
			}
			ctx, cancel := context.WithDeadline(r.Context(), bound.ExpiresAt)
			defer cancel()
			ctx = context.WithValue(ctx, federatedSessionKey{}, bound)
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

func defaultDomain(c *gravitas.Client) string {
	if c == nil {
		return ""
	}
	return c.DefaultDomain()
}
