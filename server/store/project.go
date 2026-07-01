package store

import (
        "database/sql"
        "fmt"
        "time"
)

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

// Project represents a project in the system.
type Project struct {
        ID          string    `json:"id"`
        Name        string    `json:"name"`
        Description string    `json:"description,omitempty"`
        CreatorID   string    `json:"creator_id"`
        CreatedAt   time.Time `json:"created_at"`
        UpdatedAt   time.Time `json:"updated_at"`
}

// ProjectMember represents a user that belongs to a project.
type ProjectMember struct {
        ID          string    `json:"id"`
        ProjectID   string    `json:"project_id"`
        UserID      string    `json:"user_id"`
        Role        string    `json:"role"`
        JoinedAt    time.Time `json:"joined_at"`
        Username    string    `json:"username"`
        DisplayName string    `json:"display_name"`
}

// ProjectWithCounts is a project together with aggregated task/member counts.
type ProjectWithCounts struct {
        *Project
        TaskCount   int `json:"task_count"`
        MemberCount int `json:"member_count"`
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

// CreateProject inserts a new project and returns it.
func (s *Store) CreateProject(name, description, creatorID string) (*Project, error) {
        id := newID()
        now := time.Now().UTC()

        tx, err := s.db.Begin()
        if err != nil {
                return nil, fmt.Errorf("begin tx: %w", err)
        }
        defer tx.Rollback()

        _, err = tx.Exec(
                `INSERT INTO projects (id, name, description, creator_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                id, name, description, creatorID, now.Format(time.RFC3339), now.Format(time.RFC3339),
        )
        if err != nil {
                return nil, fmt.Errorf("insert project: %w", err)
        }

        // Add creator as the first member (admin/owner)
        memberID := newID()
        _, err = tx.Exec(
                `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
                 VALUES (?, ?, ?, 'admin', ?)`,
                memberID, id, creatorID, now.Format(time.RFC3339),
        )
        if err != nil {
                return nil, fmt.Errorf("insert project member: %w", err)
        }

        // Add default columns
        columns := []struct{ id, title, color string }{
                {id + "-backlog", "الخلفية", "#64748b"},
                {id + "-todo", "قيد التنفيذ", "#3b82f6"},
                {id + "-in_progress", "جاري العمل", "#f59e0b"},
                {id + "-completed", "مكتمل", "#10b981"},
        }
        for i, c := range columns {
                _, err = tx.Exec(`
                        INSERT INTO project_columns (id, project_id, title, color, sort_order)
                        VALUES (?, ?, ?, ?, ?)
                `, c.id, id, c.title, c.color, i)
                if err != nil {
                        return nil, fmt.Errorf("insert default column: %w", err)
                }
        }

        if err := tx.Commit(); err != nil {
                return nil, fmt.Errorf("commit tx: %w", err)
        }

        return &Project{
                ID:          id,
                Name:        name,
                Description: description,
                CreatorID:   creatorID,
                CreatedAt:   now,
                UpdatedAt:   now,
        }, nil
}

// GetProject fetches a single project by its ID.
func (s *Store) GetProject(id string) (*Project, error) {
        p := &Project{}

        var createdAt, updatedAt string
        err := s.db.QueryRow(
                `SELECT id, name, description, creator_id, created_at, updated_at
                 FROM projects WHERE id = ?`, id,
        ).Scan(&p.ID, &p.Name, &p.Description, &p.CreatorID, &createdAt, &updatedAt)
        if err == sql.ErrNoRows {
                return nil, sql.ErrNoRows
        }
        if err != nil {
                return nil, fmt.Errorf("get project: %w", err)
        }

        if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
                p.CreatedAt = parsed
        } else if createdAt != "" {
                fmt.Printf("[store] warn: failed to parse project created_at %q: %v\n", createdAt, err)
        }
        if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
                p.UpdatedAt = parsed
        } else if updatedAt != "" {
                fmt.Printf("[store] warn: failed to parse project updated_at %q: %v\n", updatedAt, err)
        }
        return p, nil
}

// ListProjects returns all projects with task_count and member_count.
func (s *Store) ListProjects(userID string) ([]*ProjectWithCounts, error) {
        rows, err := s.db.Query(`
                SELECT p.id, p.name, p.description, p.creator_id, p.created_at, p.updated_at,
                       COALESCE(t.cnt, 0) AS task_count,
                       COALESCE(m.cnt, 0) AS member_count
                FROM projects p
                INNER JOIN project_members my_mem ON my_mem.project_id = p.id AND my_mem.user_id = ?
                LEFT JOIN (SELECT project_id, COUNT(*) AS cnt FROM tasks GROUP BY project_id) t ON t.project_id = p.id
                LEFT JOIN (SELECT project_id, COUNT(*) AS cnt FROM project_members GROUP BY project_id) m ON m.project_id = p.id
                ORDER BY p.updated_at DESC`, userID)
        if err != nil {
                return nil, fmt.Errorf("list projects: %w", err)
        }
        defer rows.Close()

        var result []*ProjectWithCounts
        for rows.Next() {
                pw := &ProjectWithCounts{Project: &Project{}}
                var createdAt, updatedAt string

                if err := rows.Scan(
                        &pw.ID, &pw.Name, &pw.Description, &pw.CreatorID,
                        &createdAt, &updatedAt, &pw.TaskCount, &pw.MemberCount,
                ); err != nil {
                        return nil, fmt.Errorf("scan project row: %w", err)
                }
                if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
                        pw.CreatedAt = parsed
                } else if createdAt != "" {
                        fmt.Printf("[store] warn: failed to parse project created_at %q: %v\n", createdAt, err)
                }
                if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
                        pw.UpdatedAt = parsed
                } else if updatedAt != "" {
                        fmt.Printf("[store] warn: failed to parse project updated_at %q: %v\n", updatedAt, err)
                }
                result = append(result, pw)
        }
        return result, rows.Err()
}

// DeleteProject removes a project and all of its associated data (CASCADE).
func (s *Store) DeleteProject(id string) error {
        res, err := s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
        if err != nil {
                return fmt.Errorf("delete project: %w", err)
        }
        n, err := res.RowsAffected()
        if err != nil {
                return fmt.Errorf("rows affected: %w", err)
        }
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}

// ---------------------------------------------------------------------------
// Project members
// ---------------------------------------------------------------------------

// GetProjectMembers returns every member of a project.
func (s *Store) GetProjectMembers(projectID string) ([]*ProjectMember, error) {
        rows, err := s.db.Query(`
                SELECT id, project_id, user_id, role, joined_at
                FROM project_members
                WHERE project_id = ?
                ORDER BY joined_at ASC`, projectID)
        if err != nil {
                return nil, fmt.Errorf("get project members: %w", err)
        }
        defer rows.Close()

        var members []*ProjectMember
        for rows.Next() {
                m := &ProjectMember{}
                var joinedAt string
                if err := rows.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.Role, &joinedAt); err != nil {
                        return nil, fmt.Errorf("scan member row: %w", err)
                }
                if parsed, err := time.Parse(time.RFC3339, joinedAt); err == nil {
                        m.JoinedAt = parsed
                } else if joinedAt != "" {
                        fmt.Printf("[store] warn: failed to parse member joined_at %q: %v\n", joinedAt, err)
                }
                members = append(members, m)
        }
        return members, rows.Err()
}

// AddProjectMembers inserts new members into a project.
// Already-existing memberships are silently ignored (ON CONFLICT IGNORE).
func (s *Store) AddProjectMembers(projectID string, userIDs []string) error {
        if len(userIDs) == 0 {
                return nil
        }

        tx, err := s.db.Begin()
        if err != nil {
                return fmt.Errorf("begin tx: %w", err)
        }
        defer tx.Rollback()

        now := time.Now().UTC().Format(time.RFC3339)
        stmt, err := tx.Prepare(
                `INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, joined_at)
                 VALUES (?, ?, ?, 'member', ?)`)
        if err != nil {
                return fmt.Errorf("prepare insert member: %w", err)
        }
        defer stmt.Close()

        for _, uid := range userIDs {
                id := newID()
                if _, err := stmt.Exec(id, projectID, uid, now); err != nil {
                        return fmt.Errorf("insert member %s: %w", uid, err)
                }
        }

        return tx.Commit()
}

// RemoveProjectMember removes a single user from a project.
func (s *Store) RemoveProjectMember(projectID, userID string) error {
        res, err := s.db.Exec(
                `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
                projectID, userID,
        )
        if err != nil {
                return fmt.Errorf("remove member: %w", err)
        }
        n, err := res.RowsAffected()
        if err != nil {
                return fmt.Errorf("rows affected: %w", err)
        }
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}