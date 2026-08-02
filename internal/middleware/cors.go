package middleware

import "github.com/gin-gonic/gin"

// CORS restricts cross-origin requests to allowedOrigin. Pass "*" (the
// MVP-era default) to allow any origin — fine for local/weekend use, but
// should be set to the real frontend origin before a public deployment.
func CORS(allowedOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
