// Package store persists shareable diff records in Redis with a TTL.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/jayponkia/json-compare-api/internal/diff"
	"github.com/jayponkia/json-compare-api/pkg/idgen"
)

// ErrNotFound is returned when a share ID doesn't exist or has expired.
var ErrNotFound = errors.New("share not found")

const keyPrefix = "share:"

const maxIDCollisionRetries = 5

type Store struct {
	client *redis.Client
}

func New(redisURL string) (*Store, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing redis url: %w", err)
	}
	return &Store{client: redis.NewClient(opts)}, nil
}

// Ping checks connectivity to Redis, used by the health check endpoint.
func (s *Store) Ping(ctx context.Context) error {
	return s.client.Ping(ctx).Err()
}

// Close releases the underlying Redis connection pool.
func (s *Store) Close() error {
	return s.client.Close()
}

// Save computes a new short ID, persists the record with the given TTL, and
// returns the stored record. IDs collisions (extremely unlikely at 10 chars
// base62) are retried with a fresh ID.
func (s *Store) Save(ctx context.Context, left, right json.RawMessage, delta diff.Result, ttl time.Duration) (*ShareRecord, error) {
	now := time.Now().UTC()
	record := ShareRecord{
		Left:      left,
		Right:     right,
		Delta:     delta,
		CreatedAt: now,
		ExpiresAt: now.Add(ttl),
	}

	for attempt := 0; attempt < maxIDCollisionRetries; attempt++ {
		id, err := idgen.New()
		if err != nil {
			return nil, fmt.Errorf("generating id: %w", err)
		}
		record.ID = id

		data, err := json.Marshal(record)
		if err != nil {
			return nil, fmt.Errorf("marshaling share record: %w", err)
		}

		ok, err := s.client.SetNX(ctx, keyPrefix+id, data, ttl).Result()
		if err != nil {
			return nil, fmt.Errorf("saving share record: %w", err)
		}
		if ok {
			return &record, nil
		}
		// ID collision — extremely rare, retry with a new ID.
	}

	return nil, errors.New("failed to allocate a unique share id after several attempts")
}

// Get fetches a share record by ID. Returns ErrNotFound if missing or expired.
func (s *Store) Get(ctx context.Context, id string) (*ShareRecord, error) {
	data, err := s.client.Get(ctx, keyPrefix+id).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("fetching share record: %w", err)
	}

	var record ShareRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("unmarshaling share record: %w", err)
	}
	return &record, nil
}
