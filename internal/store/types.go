package store

import (
	"encoding/json"
	"time"

	"github.com/jayponkia/json-compare-api/internal/diff"
)

// ShareRecord is what gets persisted in Redis for a shareable diff link.
type ShareRecord struct {
	ID        string          `json:"id"`
	Left      json.RawMessage `json:"left"`
	Right     json.RawMessage `json:"right"`
	Delta     diff.Result     `json:"delta"`
	CreatedAt time.Time       `json:"createdAt"`
	ExpiresAt time.Time       `json:"expiresAt"`
}
