package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/jayponkia/json-compare-api/internal/config"
	"github.com/jayponkia/json-compare-api/internal/handlers"
	"github.com/jayponkia/json-compare-api/internal/middleware"
	"github.com/jayponkia/json-compare-api/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("failed to initialize redis store: %v", err)
	}
	defer st.Close()

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := st.Ping(pingCtx); err != nil {
		log.Fatalf("failed to connect to redis at startup: %v", err)
	}

	h := handlers.New(st, cfg)

	router := gin.Default()
	router.Use(middleware.CORS(cfg.AllowedOrigin))
	router.Use(middleware.BodyLimit(cfg.MaxBodyBytes))

	router.GET("/healthz", h.Health)
	// Crawler/unfurl HTML for /share/:id. Not rate-limited: Slack/Twitter
	// fetch these URLs, and the page never includes JSON payloads.
	router.GET("/share/:id", h.ShareOG)

	v1 := router.Group("/api/v1")
	v1.Use(middleware.RateLimit(cfg.RateLimitRPS, cfg.RateLimitBurst))
	{
		v1.POST("/diff", h.Diff)
		v1.POST("/shares", h.CreateShare)
		v1.GET("/shares/:id", h.GetShare)
		v1.GET("/shares/:id/export", h.ExportShare)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("json-compare-api listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}
	log.Println("server stopped")
}
