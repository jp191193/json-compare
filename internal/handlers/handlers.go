// Package handlers wires HTTP requests to the diff engine and share store.
package handlers

import (
	"github.com/jayponkia/json-compare-api/internal/config"
	"github.com/jayponkia/json-compare-api/internal/store"
)

// Handlers holds the dependencies shared across route handlers.
type Handlers struct {
	Store *store.Store
	Cfg   config.Config
}

func New(s *store.Store, cfg config.Config) *Handlers {
	return &Handlers{Store: s, Cfg: cfg}
}
