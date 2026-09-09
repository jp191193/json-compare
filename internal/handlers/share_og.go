package handlers

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/jayponkia/json-compare-api/internal/diff"
	"github.com/jayponkia/json-compare-api/internal/store"
)

// shareIDPattern matches the 10-character base62 IDs allocated by idgen.
var shareIDPattern = regexp.MustCompile(`^[a-zA-Z0-9]{10}$`)

type shareOGPage struct {
	Title       string
	Description string
	URL         string
	Heading     string
	Summary     string
	Found       bool
}

var shareOGTemplate = template.Must(template.New("shareOG").Parse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{.Title}}</title>
    <meta name="description" content="{{.Description}}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="{{.URL}}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="JSON Compare" />
    <meta property="og:url" content="{{.URL}}" />
    <meta property="og:title" content="{{.Title}}" />
    <meta property="og:description" content="{{.Description}}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="{{.Title}}" />
    <meta name="twitter:description" content="{{.Description}}" />
  </head>
  <body>
    <main>
      <h1>{{.Heading}}</h1>
      <p>{{.Summary}}</p>
      {{if .Found}}
      <p><a href="{{.URL}}">Open the side-by-side JSON diff</a></p>
      {{end}}
    </main>
  </body>
</html>
`))

// ShareOG handles GET /share/:id for crawlers and unfurlers. It returns HTML
// with a stats-based title and Open Graph tags. Payloads are never included.
func (h *Handlers) ShareOG(c *gin.Context) {
	id := c.Param("id")
	pageURL := h.sharePublicURL(c, id)

	if !shareIDPattern.MatchString(id) {
		writeShareOG(c, http.StatusNotFound, missingShareOG(pageURL))
		return
	}

	record, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeShareOG(c, http.StatusNotFound, missingShareOG(pageURL))
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch share"})
		return
	}

	writeShareOG(c, http.StatusOK, foundShareOG(record.Delta.Stats, pageURL))
}

func foundShareOG(stats diff.Stats, pageURL string) shareOGPage {
	title := sharePreviewTitle(stats)
	desc := sharePreviewDescription(stats)
	return shareOGPage{
		Title:       title,
		Description: desc,
		URL:         pageURL,
		Heading:     title,
		Summary:     desc,
		Found:       true,
	}
}

func missingShareOG(pageURL string) shareOGPage {
	const title = "JSON share not found"
	const desc = "This JSON compare share is missing or has expired. Payloads are never shown in link previews."
	return shareOGPage{
		Title:       title,
		Description: desc,
		URL:         pageURL,
		Heading:     title,
		Summary:     desc,
		Found:       false,
	}
}

func writeShareOG(c *gin.Context, status int, page shareOGPage) {
	var buf bytes.Buffer
	if err := shareOGTemplate.Execute(&buf, page); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render share page"})
		return
	}
	c.Header("X-Robots-Tag", "noindex, nofollow")
	if status == http.StatusOK {
		c.Header("Cache-Control", "public, max-age=60")
	} else {
		c.Header("Cache-Control", "no-store")
	}
	c.Data(status, "text/html; charset=utf-8", buf.Bytes())
}

func (h *Handlers) sharePublicURL(c *gin.Context, id string) string {
	base := strings.TrimRight(c.GetHeader("X-Public-Base-URL"), "/")
	if base == "" {
		base = h.Cfg.PublicBaseURL
	}
	if base == "" {
		scheme := "http"
		if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
			scheme = "https"
		}
		host := c.GetHeader("X-Forwarded-Host")
		if host == "" {
			host = c.Request.Host
		}
		base = scheme + "://" + host
	}
	return base + "/share/" + id
}

func sharePreviewTitle(stats diff.Stats) string {
	parts := statParts(stats)
	if len(parts) == 0 {
		return "JSON diff — no differences"
	}
	return "JSON diff — " + strings.Join(parts, ", ")
}

func sharePreviewDescription(stats diff.Stats) string {
	parts := statParts(stats)
	if len(parts) == 0 {
		return "A shared JSON comparison with no differences. Field values are not included in this preview."
	}
	return fmt.Sprintf(
		"A shared JSON comparison with %s. Field values are not included in this preview.",
		strings.Join(parts, ", "),
	)
}

func statParts(stats diff.Stats) []string {
	var parts []string
	if stats.Changed > 0 {
		parts = append(parts, fmt.Sprintf("%d changed", stats.Changed))
	}
	if stats.Added > 0 {
		parts = append(parts, fmt.Sprintf("%d added", stats.Added))
	}
	if stats.Removed > 0 {
		parts = append(parts, fmt.Sprintf("%d removed", stats.Removed))
	}
	if stats.Moved > 0 {
		parts = append(parts, fmt.Sprintf("%d moved", stats.Moved))
	}
	return parts
}
