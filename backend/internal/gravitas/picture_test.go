package gravitas

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNameOnlyIdentityAndPictureSession(t *testing.T) {
	c, auth, cookie := authorizedFixture(t)
	if auth.Name != "Alice Example" || auth.Username != "" || auth.UserID != "" {
		t.Fatal("name-only identity was not retained")
	}
	req := httptest.NewRequest("GET", c.AppURL+"/", nil)
	req.AddCookie(cookie)
	identity, err := c.Session(req)
	if err != nil || identity.Picture == "" {
		t.Fatalf("profile session: %v", err)
	}
	data, mime, err := c.Picture(req.Context(), identity)
	if err != nil || mime != "image/png" || len(data) != 8 {
		t.Fatalf("picture: %s %v", mime, err)
	}
	if len(cookie.Value) > 3800 {
		t.Fatal("picture inflated session cookie")
	}
}

func TestPictureRejectsOtherOriginsAndInvalidImageResponses(t *testing.T) {
	c, _ := fixture(t)
	for _, picture := range []string{"https://tracker.example/profile/pictures/id", c.Issuer + "/oauth/token", "data:image/svg+xml,active", c.Issuer + "/profile/pictures/id?secret=1"} {
		if _, _, err := c.Picture(context.Background(), Identity{Issuer: c.Issuer, Picture: picture}); err == nil {
			t.Fatalf("accepted %s", picture)
		}
	}
	for _, kind := range []string{"html", "oversized", "redirect"} {
		t.Run(kind, func(t *testing.T) {
			iam := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if kind == "redirect" {
					http.Redirect(w, r, "https://tracker.example", 302)
					return
				}
				if kind == "html" {
					w.Header().Set("Content-Type", "text/html")
					_, _ = w.Write([]byte("<script>"))
					return
				}
				w.Header().Set("Content-Type", "image/png")
				_, _ = w.Write([]byte(strings.Repeat("x", 256*1024+1)))
			}))
			defer iam.Close()
			c.Issuer = iam.URL
			c.HTTP.Transport = iam.Client().Transport
			if _, _, err := c.Picture(context.Background(), Identity{Issuer: iam.URL, Picture: iam.URL + "/profile/pictures/id"}); err == nil {
				t.Fatal("invalid image response accepted")
			}
		})
	}
}
