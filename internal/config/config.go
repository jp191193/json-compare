package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all runtime configuration, sourced from environment variables.
type Config struct {
	Port          string
	RedisURL      string
	ShareTTL      time.Duration
	MaxShareTTL   time.Duration
	MaxBodyBytes  int64
	AllowedOrigin string
}

func Load() Config {
	return Config{
		Port:          getEnv("PORT", "8080"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379/0"),
		ShareTTL:      getEnvHours("SHARE_TTL_HOURS", 168),     // 7 days
		MaxShareTTL:   getEnvHours("MAX_SHARE_TTL_HOURS", 720), // 30 days
		MaxBodyBytes:  getEnvInt64("MAX_BODY_BYTES", 2<<20),    // 2MB
		AllowedOrigin: getEnv("ALLOWED_ORIGIN", "*"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvHours(key string, fallbackHours int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return time.Duration(n) * time.Hour
		}
	}
	return time.Duration(fallbackHours) * time.Hour
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
