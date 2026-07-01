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
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("failed to query max sort order: %w", err)
		}
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

// UpdateColumn updates an existing column
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

	_, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update column: %w", err)
	}
	return nil
}

// GetColumnByID retrieves a single column by its ID.
func (s *Store) GetColumnByID(id string) (*Column, error) {
	var c Column
	err := s.db.QueryRow(
		"SELECT id, project_id, title, color, sort_order, created_at, updated_at FROM project_columns WHERE id = ?", id,
	).Scan(&c.ID, &c.ProjectID, &c.Title, &c.Color, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// DeleteColumn deletes a column. Returns an error if any tasks reference this column's status.
func (s *Store) DeleteColumn(id string) error {
	// Check if any tasks reference this column status
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status = ?", id).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check tasks for column: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("cannot delete column: %d tasks still reference this column", count)
	}

	query := `DELETE FROM project_columns WHERE id = ?`
	res, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete column: %w", err)
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