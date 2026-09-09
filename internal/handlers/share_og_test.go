package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/jayponkia/json-compare-api/internal/config"
	"github.com/jayponkia/json-compare-api/internal/diff"
)

func TestSharePreviewTitle(t *testing.T) {
	got := sharePreviewTitle(diff.Stats{Changed: 3, Added: 1, Removed: 2})
	want := "JSON diff — 3 changed, 1 added, 2 removed"
	if got != want {
		t.Fatalf("title: got %q, want %q", got, want)
	}
	if sharePreviewTitle(diff.Stats{}) != "JSON diff — no differences" {
		t.Fatalf("empty stats title: %q", sharePreviewTitle(diff.Stats{}))
	}
}

func TestSharePreviewDescriptionOmitsPayloads(t *testing.T) {
	desc := sharePreviewDescription(diff.Stats{Changed: 1, Added: 1})
	if !strings.Contains(desc, "1 changed") || !strings.Contains(desc, "1 added") {
		t.Fatalf("expected stats in description, got %q", desc)
	}
	if strings.Contains(strings.ToLower(desc), "{") || strings.Contains(desc, "[") {
		t.Fatalf("description must not look like JSON: %q", desc)
	}
}

func TestWriteShareOG_NoJSONInHTML(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/share/abcdefghij", nil)

	secretLeft := `{"password":"hunter2","token":"s3cret"}`
	page := foundShareOG(diff.Stats{Changed: 3, Added: 1}, "https://example.com/share/abcdefghij")
	writeShareOG(c, http.StatusOK, page)

	body := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if !strings.Contains(body, "JSON diff — 3 changed, 1 added") {
		t.Fatalf("missing stats title in HTML:\n%s", body)
	}
	if !strings.Contains(body, `property="og:title"`) || !strings.Contains(body, `property="og:url"`) {
		t.Fatalf("missing OG tags:\n%s", body)
	}
	if !strings.Contains(body, "https://example.com/share/abcdefghij") {
		t.Fatalf("missing og:url:\n%s", body)
	}
	if strings.Contains(body, secretLeft) || strings.Contains(body, "hunter2") || strings.Contains(body, "s3cret") {
		t.Fatalf("payload leaked into OG HTML:\n%s", body)
	}
	if rec.Header().Get("X-Robots-Tag") != "noindex, nofollow" {
		t.Fatalf("expected noindex robots tag, got %q", rec.Header().Get("X-Robots-Tag"))
	}
}

func TestShareOG_PublicBaseHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := New(nil, config.Config{})

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, "/share/nope", nil)
	req.Header.Set("X-Public-Base-URL", "https://json-compare.example")
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "nope"}}

	h.ShareOG(c)

	body := rec.Body.String()
	if !strings.Contains(body, `content="https://json-compare.example/share/nope"`) {
		t.Fatalf("expected public og:url, got:\n%s", body)
	}
}

func TestShareOG_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := New(nil, config.Config{PublicBaseURL: "https://json-compare.example"})

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/share/not-valid!", nil)
	c.Params = gin.Params{{Key: "id", Value: "not-valid!"}}

	h.ShareOG(c)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "JSON share not found") {
		t.Fatalf("expected not-found title, got:\n%s", body)
	}
	if strings.Contains(body, "{") && strings.Contains(body, `"left"`) {
		t.Fatalf("must not dump JSON on missing share:\n%s", body)
	}
}
