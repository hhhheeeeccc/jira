package store

import (
        "crypto/rand"
        "database/sql"
        "fmt"
        "time"

        _ "github.com/mattn/go-sqlite3"
)

// Store wraps the SQLite database connection.
type Store struct {
        db *sql.DB
}

// newID generates a random UUID v4 string.
func newID() string {
        b := make([]byte, 16)
        if _, err := rand.Read(b); err != nil {
                // crypto/rand should never fail on modern Linux, but if it does
                // fall back to a time-based ID to avoid crashing the plugin.
                fmt.Printf("jira plugin: ERROR: crypto/rand failed: %v\n", err)
                ts := time.Now().UnixNano()
                b = []byte(fmt.Sprintf("%016x%08x", ts, ts&0xFFFFFFFF))
        }
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

// DB returns the underlying *sql.DB (needed for ad-hoc queries like countTasksByColumn).
func (s *Store) DB() *sql.DB {
        return s.db
}

// migrate creates the required tables if they do not already exist.
// Uses SQLite PRAGMA user_version to skip already-applied migrations.
func (s *Store) migrate() error {
        schemaQueries := []string{
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
                        FOREIGN KEY (project_id)  REFERENCES projects(id)            ON DELETE CASCADE
                )`,
                `CREATE TABLE IF NOT EXISTS project_columns (
                        id          TEXT PRIMARY KEY,
                        project_id  TEXT NOT NULL,
                        title       TEXT NOT NULL,
                        color       TEXT,
                        sort_order  INTEGER NOT NULL DEFAULT 0,
                        created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
                        updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
                        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )`,
        }

        for _, q := range schemaQueries {
                if _, err := s.db.Exec(q); err != nil {
                        return fmt.Errorf("schema creation error: %w", err)
                }
        }

        // Check current migration version.
        var version int
        s.db.QueryRow("PRAGMA user_version").Scan(&version)

        // Migration v1: Migrate legacy status values to column-prefixed format.
        if version < 1 {
                v1Queries := []string{
                        `UPDATE tasks SET status = project_id || '-backlog' WHERE status = 'backlog'`,
                        `UPDATE tasks SET status = project_id || '-todo' WHERE status = 'todo'`,
                        `UPDATE tasks SET status = project_id || '-in_progress' WHERE status = 'in_progress'`,
                        `UPDATE tasks SET status = project_id || '-completed' WHERE status = 'done'`,
                }
                for _, q := range v1Queries {
                        if _, err := s.db.Exec(q); err != nil {
                                fmt.Printf("jira plugin: warning: v1 migration error: %v\n", err)
                        }
                }
                // Mark v1 as applied.
                s.db.Exec("PRAGMA user_version = 1")
        }

        // One-time migration: create default columns for projects that have none.
        rows, err := s.db.Query(`
                SELECT p.id
                FROM projects p
                LEFT JOIN project_columns pc ON p.id = pc.project_id
                WHERE pc.id IS NULL
        `)
        if err != nil {
                // Log but don't fail — this is a best-effort migration.
                fmt.Printf("jira plugin: warning: migration query failed: %v\n", err)
        } else {
                defer rows.Close()
                var projectIDs []string
                for rows.Next() {
                        var pid string
                        if err := rows.Scan(&pid); err == nil {
                                projectIDs = append(projectIDs, pid)
                        }
                }
                if err := rows.Err(); err != nil {
                        fmt.Printf("jira plugin: warning: migration row iteration failed: %v\n", err)
                } else {
                        for _, pid := range projectIDs {
                                defaultCols := []struct{ id, title, color string }{
                                        {pid + "-backlog", "الخلفية", "#64748b"},
                                        {pid + "-todo", "قيد التنفيذ", "#3b82f6"},
                                        {pid + "-in_progress", "جاري العمل", "#f59e0b"},
                                        {pid + "-completed", "مكتمل", "#10b981"},
                                }
                                for i, c := range defaultCols {
                                        if _, execErr := s.db.Exec(`
                                                INSERT OR IGNORE INTO project_columns (id, project_id, title, color, sort_order)
                                                VALUES (?, ?, ?, ?, ?)
                                        `, c.id, pid, c.title, c.color, i); execErr != nil {
                                                fmt.Printf("jira plugin: warning: failed to create default column for %s: %v\n", pid, execErr)
                                        }
                                }
                        }
                }
        }

        return nil
}