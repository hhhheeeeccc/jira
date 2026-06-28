package store

import (
        "database/sql"
        "fmt"
        "time"
)

// Task represents a task inside a project.
type Task struct {
        ID          string
        Title       string
        Description string
        DueDate     string
        DueTime     string
        Priority    string
        Status      string
        SortOrder   int
        ProjectID   string
        AssigneeID  sql.NullString
        CreatedAt   time.Time
        UpdatedAt   time.Time
}

// TaskJSON is a JSON-friendly representation where AssigneeID is a plain string.
type TaskJSON struct {
        ID          string `json:"id"`
        Title       string `json:"title"`
        Description string `json:"description"`
        DueDate     string `json:"due_date"`
        DueTime     string `json:"due_time"`
        Priority    string `json:"priority"`
        Status      string `json:"status"`
        SortOrder   int    `json:"sort_order"`
        ProjectID   string `json:"project_id"`
        AssigneeID  string `json:"assignee_id"`
        CreatedAt   string `json:"created_at"`
        UpdatedAt   string `json:"updated_at"`
}

// ToJSON converts a Task (with sql.NullString) to a TaskJSON suitable for marshalling.
func (t *Task) ToJSON() TaskJSON {
        assignee := ""
        if t.AssigneeID.Valid {
                assignee = t.AssigneeID.String
        }
        return TaskJSON{
                ID:          t.ID,
                Title:       t.Title,
                Description: t.Description,
                DueDate:     t.DueDate,
                DueTime:     t.DueTime,
                Priority:    t.Priority,
                Status:      t.Status,
                SortOrder:   t.SortOrder,
                ProjectID:   t.ProjectID,
                AssigneeID:  assignee,
                CreatedAt:   t.CreatedAt.Format(time.RFC3339),
                UpdatedAt:   t.UpdatedAt.Format(time.RFC3339),
        }
}

// CreateTask inserts a new task. The sort_order is set to MAX(sort_order)+1 for
// tasks sharing the same (project_id, status).
func (s *Store) CreateTask(projectID, title, description, dueDate, dueTime, priority, status, assigneeID string) (*Task, error) {
        id := newID()
        now := time.Now().UTC()

        // Determine sort_order: max existing + 1 for the same project+status.
        var maxOrder sql.NullInt64
        err := s.db.QueryRow(
                `SELECT MAX(sort_order) FROM tasks WHERE project_id = ? AND status = ?`,
                projectID, status,
        ).Scan(&maxOrder)
        if err != nil && err != sql.ErrNoRows {
                return nil, fmt.Errorf("get max sort_order: %w", err)
        }
        order := 0
        if maxOrder.Valid {
                order = int(maxOrder.Int64) + 1
        }

        // Build nullable assignee_id.
        var assignee sql.NullString
        if assigneeID != "" {
                assignee = sql.NullString{String: assigneeID, Valid: true}
        }

        _, err = s.db.Exec(
                `INSERT INTO tasks
                 (id, title, description, due_date, due_time, priority, status, sort_order, project_id, assignee_id, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                id, title, description, dueDate, dueTime, priority, status, order, projectID, assignee,
                now.Format(time.RFC3339), now.Format(time.RFC3339),
        )
        if err != nil {
                return nil, fmt.Errorf("insert task: %w", err)
        }

        return &Task{
                ID:          id,
                Title:       title,
                Description: description,
                DueDate:     dueDate,
                DueTime:     dueTime,
                Priority:    priority,
                Status:      status,
                SortOrder:   order,
                ProjectID:   projectID,
                AssigneeID:  assignee,
                CreatedAt:   now,
                UpdatedAt:   now,
        }, nil
}

// GetTaskProjectID returns the project_id for a given task
func (s *Store) GetTaskProjectID(taskID string) (string, error) {
	var projectID string
	err := s.db.QueryRow(`SELECT project_id FROM tasks WHERE id = ?`, taskID).Scan(&projectID)
	if err != nil {
		return "", fmt.Errorf("get task project_id: %w", err)
	}
	return projectID, nil
}

// GetTasksByProject returns every task for a project, ordered by sort_order.
func (s *Store) GetTasksByProject(projectID string) ([]*Task, error) {
        rows, err := s.db.Query(
                `SELECT id, title, description, due_date, due_time, priority, status,
                        sort_order, project_id, assignee_id, created_at, updated_at
                 FROM tasks WHERE project_id = ? ORDER BY sort_order ASC`,
                projectID,
        )
        if err != nil {
                return nil, fmt.Errorf("get tasks by project: %w", err)
        }
        defer rows.Close()

        var tasks []*Task
        for rows.Next() {
                t, err := scanTask(rows)
                if err != nil {
                        return nil, err
                }
                tasks = append(tasks, t)
        }
        return tasks, rows.Err()
}

// UpdateTask applies partial updates to a task identified by id.
// The updates map keys correspond to column names (snake_case).
// When status is changed to "backlog", assignee_id is also set to NULL.
func (s *Store) UpdateTask(id string, updates map[string]interface{}) error {
        if len(updates) == 0 {
                return nil
        }

        // If status is being set to backlog, force-assignee to NULL.
        if statusVal, ok := updates["status"]; ok {
                if s, ok := statusVal.(string); ok && s == "backlog" {
                        updates["assignee_id"] = nil
                }
        }

        // Always update updated_at.
        updates["updated_at"] = time.Now().UTC().Format(time.RFC3339)

        // Build SET clause dynamically.
        setParts := make([]string, 0, len(updates))
        args := make([]interface{}, 0, len(updates)+1)
        for col, val := range updates {
                setParts = append(setParts, col+" = ?")
                args = append(args, val)
        }
        args = append(args, id)

        query := "UPDATE tasks SET " + join(setParts, ", ") + " WHERE id = ?"
        res, err := s.db.Exec(query, args...)
        if err != nil {
                return fmt.Errorf("update task: %w", err)
        }
        n, _ := res.RowsAffected()
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}

// DeleteTask removes a task by its ID.
func (s *Store) DeleteTask(id string) error {
        res, err := s.db.Exec(`DELETE FROM tasks WHERE id = ?`, id)
        if err != nil {
                return fmt.Errorf("delete task: %w", err)
        }
        n, _ := res.RowsAffected()
        if n == 0 {
                return sql.ErrNoRows
        }
        return nil
}

// ----------- helpers -----------

func scanTask(rows *sql.Rows) (*Task, error) {
        t := &Task{}
        var createdAt, updatedAt string
        err := rows.Scan(
                &t.ID, &t.Title, &t.Description, &t.DueDate, &t.DueTime,
                &t.Priority, &t.Status, &t.SortOrder, &t.ProjectID,
                &t.AssigneeID, &createdAt, &updatedAt,
        )
        if err != nil {
                return nil, fmt.Errorf("scan task row: %w", err)
        }
        t.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
        t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
        return t, nil
}

func join(parts []string, sep string) string {
        result := ""
        for i, p := range parts {
                if i > 0 {
                        result += sep
                }
                result += p
        }
        return result
}
