package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"office/backend/internal/gravitas"
	"office/backend/internal/push"
	"time"
)

func (s *Server) pushIdentity(r *http.Request) (string, string, time.Time) {
	if s.Federation != nil {
		bound, ok := r.Context().Value(federatedSessionKey{}).(gravitas.AppSession)
		if !ok {
			return "", "", time.Time{}
		}
		cookie, err := r.Cookie(gravitas.SessionCookie)
		if err != nil {
			return "", "", time.Time{}
		}
		return bound.Authorization.Issuer + "|" + bound.Authorization.Subject, cookie.Value, bound.ExpiresAt
	}
	cookie, err := r.Cookie("office_push_device")
	if err != nil || len(cookie.Value) != 32 {
		return "", "", time.Time{}
	}
	return "local:" + cookie.Value, cookie.Value, time.Now().Add(30 * 24 * time.Hour)
}
func (s *Server) pushRoutes(mux *http.ServeMux) {
	if s.Push == nil {
		return
	}
	s.Push.Validate = func(ctx context.Context, d push.Device) (bool, error) {
		if s.Federation == nil {
			return true, nil
		}
		bound, err := s.Federation.AuthenticatePushAuthorization(ctx, d.Binding)
		if errors.Is(err, gravitas.ErrUnavailable) {
			return false, err
		}
		return err == nil && bound.Issuer+"|"+bound.Subject == d.Owner, nil
	}
	mux.HandleFunc("GET /api/push/key", func(w http.ResponseWriter, r *http.Request) {
		owner, _, _ := s.pushIdentity(r)
		if owner == "" && s.Federation == nil {
			raw := make([]byte, 16)
			if _, err := rand.Read(raw); err != nil {
				fail(w, 500, err)
				return
			}
			value := hex.EncodeToString(raw)
			http.SetCookie(w, &http.Cookie{Name: "office_push_device", Value: value, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 30 * 86400, Secure: r.TLS != nil})
			owner = "local:" + value
		}
		w.Header().Set("Cache-Control", "no-store")
		respond(w, 200, map[string]string{"publicKey": s.Push.PublicKey(), "owner": owner})
	})
	mux.HandleFunc("POST /api/push/subscription", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Gravitas-CSRF") != "1" {
			fail(w, 403, errors.New("request verification required"))
			return
		}
		owner, binding, expires := s.pushIdentity(r)
		var subscription push.Subscription
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384)).Decode(&subscription); err != nil {
			fail(w, 400, push.ErrInvalid)
			return
		}
		sessionKey := push.SessionKey(binding)
		if s.Federation != nil {
			bound := r.Context().Value(federatedSessionKey{}).(gravitas.AppSession)
			var e error
			binding, expires, e = s.Federation.SealPushAuthorization(bound)
			if e != nil {
				fail(w, 500, e)
				return
			}
		}
		if err := s.Push.Subscribe(push.Device{Owner: owner, Binding: binding, Session: sessionKey, Expires: expires, Subscription: subscription, Topics: []string{"*"}}); err != nil {
			fail(w, 400, err)
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("DELETE /api/push/subscription", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Gravitas-CSRF") != "1" {
			fail(w, 403, errors.New("request verification required"))
			return
		}
		owner, _, _ := s.pushIdentity(r)
		var body struct {
			Endpoint string `json:"endpoint"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body); err != nil {
			fail(w, 400, push.ErrInvalid)
			return
		}
		if err := s.Push.Unsubscribe(owner, body.Endpoint); err != nil {
			fail(w, 500, err)
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	})
}
