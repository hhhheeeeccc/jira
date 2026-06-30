package store

import (
        "database/sql"
        "fmt"
        "time"
)

type Column struct {
        ID        string    `json:"id"`
        ProjectID string    `json:"project_id"`
        Title     string    `json:"title"`
        Color     string    `json:"color"`
        SortOrder int       `json:"sort_order"`
        CreatedAt time.Time `json:"created_at"`
        UpdatedAt time.Time `json:"updated_at"`
}

// CreateColumn creates a new column
func (s *Store) CreateColumn(col *Column) error {
        if col.ID == "" {
                col.ID = newID()
        }
        
        // Default to last order if not specified
        if col.SortOrder == 0 {
                var maxOrder sql.NullInt64
                err := s.db.QueryRow("SELECT MAX(sort_order) FROM project_columns WHERE project_id = ?", col.ProjectID).Scan(&maxOrder)
                if err == nil && maxOrder.Valid {
                        col.SortOrder = int(maxOrder.Int64) + 1
                }
        }

        query := `
                INSERT INTO project_columns (id, project_id, title, color, sort_order)
                VALUES (?, ?, ?, ?, ?)
        `
        _, err := s.db.Exec(query, col.ID, col.ProjectID, col.Title, col.Color, col.SortOrder)
        if err != nil {
                return fmt.Errorf("failed to create column: %w", err)
        }

        return nil
}

// GetProjectColumns retrieves all columns for a project, ordered by sort_order
func (s *Store) GetProjectColumns(projectID string) ([]*Column, error) {
        query := `
                SELECT id, project_id, title, color, sort_order, created_at, updated_at
                FROM project_columns
                WHERE project_id = ?
                ORDER BY sort_order ASC
        `
        rows, err := s.db.Query(query, projectID)
        if err != nil {
                return nil, fmt.Errorf("failed to query columns: %w", err)
        }
        defer rows.Close()

        var columns []*Column
        for rows.Next() {
                var col Column
                if err := rows.Scan(
                        &col.ID,
                        &col.ProjectID,
                        &col.Title,
                        &col.Color,
                        &col.SortOrder,
                        &col.CreatedAt,
                        &col.UpdatedAt,
                ); err != nil {
                        return nil, fmt.Errorf("failed to scan column: %w", err)
                }
                columns = append(columns, &col)
        }

        if err := rows.Err(); err != nil {
                return nil, fmt.Errorf("failed iterating column rows: %w", err)
        }

        return columns, nil
}

// UpdateColumn updates an existing column.
// Returns sql.ErrNoRows if the column does not exist.
func (s *Store) UpdateColumn(id string, title, color string, sortOrder *int) error {
        var query string
        var args []interface{}

        if sortOrder != nil {
                query = `UPDATE project_columns SET title = ?, color = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`
                args = []interface{}{title, color, *sortOrder, id}
        } else {
                query = `UPDATE project_columns SET title = ?, color = ?, updated_at = datetime('now') WHERE id = ?`
                args = []interface{}{title, color, id}
        }

        res, err := s.db.Exec(query, args...)
        if err != nil {
                return fmt.Errorf("failed to update column: %w", err)
        }
        n, _ := res.RowsAffected()
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}

// DeleteColumn deletes a column.
// Returns sql.ErrNoRows if the column does not exist.
// Note: UI should handle warning about orphaned tasks or we should move them.
func (s *Store) DeleteColumn(id string) error {
        query := `DELETE FROM project_columns WHERE id = ?`
        res, err := s.db.Exec(query, id)
        if err != nil {
                return fmt.Errorf("failed to delete column: %w", err)
        }
        n, _ := res.RowsAffected()
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}
