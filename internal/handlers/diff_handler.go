package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/jayponkia/json-compare-api/internal/diff"
)

type diffRequest struct {
	Left  json.RawMessage `json:"left" binding:"required"`
	Right json.RawMessage `json:"right" binding:"required"`
}

// Diff handles POST /api/v1/diff — stateless comparison, no persistence.
func (h *Handlers) Diff(c *gin.Context) {
	var req diffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
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

	c.JSON(http.StatusOK, result)
}
