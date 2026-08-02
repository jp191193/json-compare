package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/jayponkia/json-compare-api/internal/diff"
	"github.com/jayponkia/json-compare-api/internal/store"
)

type createShareRequest struct {
	Left     json.RawMessage `json:"left" binding:"required"`
	Right    json.RawMessage `json:"right" binding:"required"`
	TTLHours *int            `json:"ttl_hours,omitempty"`
}

// CreateShare handles POST /api/v1/shares — computes the diff once and
// persists {left, right, delta} in Redis under a short ID with a TTL.
func (h *Handlers) CreateShare(c *gin.Context) {
	var req createShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	ttl := h.Cfg.ShareTTL
	if req.TTLHours != nil {
		if *req.TTLHours <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ttl_hours must be a positive integer"})
			return
		}
		requested := time.Duration(*req.TTLHours) * time.Hour
		if requested > h.Cfg.MaxShareTTL {
			requested = h.Cfg.MaxShareTTL
		}
		ttl = requested
	}

	result, err := diff.Compare(req.Left, req.Right)
	if err != nil {
		var parseErr *diff.ParseError
		if errors.As(err, &parseErr) {
			c.JSON(http.StatusBadRequest, gin.H{"error": parseErr.Error(), "side": parseErr.Side})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute diff"})
		return
	}

	record, err := h.Store.Save(c.Request.Context(), req.Left, req.Right, *result, ttl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save share"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        record.ID,
		"url":       fmt.Sprintf("/api/v1/shares/%s", record.ID),
		"expiresAt": record.ExpiresAt,
	})
}

// GetShare handles GET /api/v1/shares/:id.
func (h *Handlers) GetShare(c *gin.Context) {
	id := c.Param("id")

	record, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "share not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch share"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// ExportShare handles GET /api/v1/shares/:id/export?format=json|text and
// streams the diff back as a downloadable file.
func (h *Handlers) ExportShare(c *gin.Context) {
	id := c.Param("id")
	format := c.DefaultQuery("format", "json")

	record, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "share not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch share"})
		return
	}

	switch format {
	case "json":
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=diff-%s.json", id))
		c.JSON(http.StatusOK, record.Delta)
	case "text":
		ascii, err := diff.Ascii(record.Left, record.Right)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render text diff"})
			return
		}
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=diff-%s.txt", id))
		c.String(http.StatusOK, ascii)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "format must be 'json' or 'text'"})
	}
}
