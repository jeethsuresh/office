package gravitas

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Picture proxies only the identity host's opaque picture link, using the
// application's authenticated session. The browser does not contact IAM.
func (c *Client) Picture(ctx context.Context, identity Identity) ([]byte, string, error) {
	selected, err := c.ForIssuer(identity.Issuer)
	if err != nil {
		return nil, "", ErrLoginRequired
	}
	picture, err := url.Parse(identity.Picture)
	issuer, _ := url.Parse(identity.Issuer)
	if err != nil || picture.Scheme != "https" || picture.Host != issuer.Host || picture.User != nil || picture.RawQuery != "" || picture.Fragment != "" || !strings.HasPrefix(picture.Path, "/profile/pictures/") {
		return nil, "", errors.New("no profile picture")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, picture.String(), nil)
	if err != nil {
		return nil, "", err
	}
	response, err := selected.HTTP.Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	kind := strings.Split(response.Header.Get("Content-Type"), ";")[0]
	if response.StatusCode != http.StatusOK || (kind != "image/png" && kind != "image/jpeg" && kind != "image/webp") {
		return nil, "", errors.New("invalid profile picture")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 256*1024+1))
	if err != nil || len(data) > 256*1024 {
		return nil, "", errors.New("invalid profile picture")
	}
	return data, kind, nil
}
