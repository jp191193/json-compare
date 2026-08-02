package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health handles GET /healthz — pings Redis and reports 200/503.
func (h *Handlers) Health(c *gin.Context) {
	if err := h.Store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
