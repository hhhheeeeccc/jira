package store

import (
	"crypto/rand"
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// Store wraps the SQLite database connection.
type Store struct {
	db *sql.DB
}

// newID generates a random UUID v4 string.
func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 2
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// NewStore opens (or creates) the SQLite database at the given plugin path
// and runs any pending migrations.
func NewStore(pluginPath string) (*Store, error) {
	dbPath := pluginPath + "/jira.db"

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// SQLite only supports one writer at a time.
	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return s, nil
}

// Close releases the database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// migrate creates the required tables if they do not already exist.
func (s *Store) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS projects (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			description TEXT,
			creator_id  TEXT,
			created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
			updated_at  DATETIME NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS project_members (
			id         TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			user_id    TEXT NOT NULL,
			role       TEXT NOT NULL DEFAULT 'member',
			joined_at  DATETIME NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
			UNIQUE(project_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id          TEXT PRIMARY KEY,
			title       TEXT NOT NULL,
			description TEXT,
			due_date    TEXT,
			due_time    TEXT,
			priority    TEXT NOT NULL DEFAULT 'medium',
			status      TEXT NOT NULL DEFAULT 'backlog',
			sort_order  INTEGER NOT NULL DEFAULT 0,
			project_id  TEXT NOT NULL,
			assignee_id TEXT,
			created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
			updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (project_id)  REFERENCES projects(id)            ON DELETE CASCADE,
			FOREIGN KEY (assignee_id) REFERENCES project_members(user_id) ON DELETE SET NULL
		)`,
	}

	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migration error: %w", err)
		}
	}

	return nil
}