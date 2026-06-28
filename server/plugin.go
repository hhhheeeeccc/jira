package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/hhhheeeeccc/jira/server/store"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

const (
	pluginID = "com.mattermost.plugin.jira"
)

// Plugin is the core implementation registered with Mattermost.
type Plugin struct {
	plugin.MattermostPlugin
	store     *store.Store
	version   string
	buildDate string
	commit    string
}

// SetVersion stores the build-time version variable.
func (p *Plugin) SetVersion(v string) { p.version = v }

// SetBuildDate stores the build-time date variable.
func (p *Plugin) SetBuildDate(d string) { p.buildDate = d }

// SetCommit stores the build-time commit variable.
func (p *Plugin) SetCommit(c string) { p.commit = c }

// NewPlugin creates a new, initialised Plugin instance.
func NewPlugin() *Plugin {
	return &Plugin{}
}

// OnActivate is called by Mattermost when the plugin is activated.
func (p *Plugin) OnActivate() error {
	p.API.LogInfo("Jira Project Management plugin activating", "version", p.version)

	pluginPath, err := p.API.GetBundlePath()
	if err != nil {
		return fmt.Errorf("failed to get plugin path: %w", err)
	}
	if pluginPath == "" {
		return fmt.Errorf("plugin path is empty")
	}

	s, err := store.NewStore(pluginPath)
	if err != nil {
		p.API.LogError("Failed to initialise store", "error", err.Error())
		return fmt.Errorf("init store: %w", err)
	}
	p.store = s

	p.API.LogInfo("Jira Project Management plugin activated successfully")
	return nil
}

// OnDeactivate is called when the plugin is deactivated.
func (p *Plugin) OnDeactivate() error {
	if p.store != nil {
		if err := p.store.Close(); err != nil {
			return err
		}
	}
	return nil
}

// ServeHTTP routes all HTTP requests for this plugin.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Every API call requires an authenticated Mattermost user.
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized access")
		return
	}

	path := r.URL.Path

	// Strip the plugin prefix so we can match the remainder.
	prefix := "/plugins/" + pluginID
	if !strings.HasPrefix(path, prefix) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	path = strings.TrimPrefix(path, prefix)

	// ---------- Projects ----------
	switch {
	case match(path, "/api/v1/projects") && r.Method == http.MethodGet:
		p.handleListProjects(w, r)
		return
	case match(path, "/api/v1/projects") && r.Method == http.MethodPost:
		p.handleCreateProject(w, r, userID)
		return
	}

	// /api/v1/projects/{id} ...
	if rest, id, ok := extractID(path, "/api/v1/projects/"); ok {
		switch {
		case rest == "" && r.Method == http.MethodGet:
			p.handleGetProject(w, r, id)
			return
		case rest == "" && r.Method == http.MethodDelete:
			p.handleDeleteProject(w, r, id)
			return
		case rest == "/members" && r.Method == http.MethodPost:
			p.handleAddMembers(w, r, id)
			return
		case rest == "/members" && r.Method == http.MethodGet:
			p.handleGetMembers(w, r, id)
			return
		}

		// /api/v1/projects/{id}/members/{userId}
		if memberRest, memberUserID, ok := extractID(rest, "/members/"); ok && memberRest == "" {
			if r.Method == http.MethodDelete {
				p.handleRemoveMember(w, r, id, memberUserID)
				return
			}
		}

		// /api/v1/projects/{id}/tasks
		switch {
		case rest == "/tasks" && r.Method == http.MethodGet:
			p.handleListTasks(w, r, id)
			return
		case rest == "/tasks" && r.Method == http.MethodPost:
			p.handleCreateTask(w, r, id, userID)
			return
		}
	}

	// /api/v1/tasks/{id}
	if rest, taskID, ok := extractID(path, "/api/v1/tasks/"); ok && rest == "" {
		if r.Method == http.MethodPatch {
			p.handleUpdateTask(w, r, taskID)
			return
		}
		if r.Method == http.MethodDelete {
			p.handleDeleteTask(w, r, taskID)
			return
		}
	}

	// /api/v1/users
	if path == "/api/v1/users" && r.Method == http.MethodGet {
		p.handleGetUsers(w, r)
		return
	}

	writeError(w, http.StatusNotFound, "route not found")
}

// ========================================================================
// Project handlers
// ========================================================================

func (p *Plugin) handleListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := p.store.ListProjects()
	if err != nil {
		p.API.LogError("Failed to list projects", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (p *Plugin) handleCreateProject(w http.ResponseWriter, r *http.Request, userID string) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeError(w, http.StatusBadRequest, "project name is required")
		return
	}

	proj, err := p.store.CreateProject(strings.TrimSpace(body.Name), body.Description, userID)
	if err != nil {
		p.API.LogError("Failed to create project", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	writeJSON(w, http.StatusCreated, proj)
}

func (p *Plugin) handleGetProject(w http.ResponseWriter, r *http.Request, id string) {
	proj, err := p.store.GetProject(id)
	if err != nil {
		p.API.LogError("Failed to get project", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to get project")
		return
	}
	if proj == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	// Also fetch tasks and members.
	tasks, err := p.store.GetTasksByProject(id)
	if err != nil {
		p.API.LogError("Failed to get tasks", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to get tasks")
		return
	}

	members, err := p.store.GetProjectMembers(id)
	if err != nil {
		p.API.LogError("Failed to get members", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to get members")
		return
	}

	// Enrich members with Mattermost user info.
	for _, m := range members {
		user, appErr := p.API.GetUser(m.UserID)
		if appErr == nil && user != nil {
			m.Username = user.Username
			m.DisplayName = user.GetDisplayName(model.ShowNicknameFullName)
		}
	}

	// Convert tasks to JSON-friendly form.
	taskJSONs := make([]store.TaskJSON, len(tasks))
	for i, t := range tasks {
		taskJSONs[i] = t.ToJSON()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"project": proj,
		"tasks":   taskJSONs,
		"members": members,
	})
}

func (p *Plugin) handleDeleteProject(w http.ResponseWriter, r *http.Request, id string) {
	if err := p.store.DeleteProject(id); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		p.API.LogError("Failed to delete project", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ========================================================================
// Member handlers
// ========================================================================

func (p *Plugin) handleGetMembers(w http.ResponseWriter, r *http.Request, projectID string) {
	members, err := p.store.GetProjectMembers(projectID)
	if err != nil {
		p.API.LogError("Failed to get members", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to get members")
		return
	}

	for _, m := range members {
		user, appErr := p.API.GetUser(m.UserID)
		if appErr == nil && user != nil {
			m.Username = user.Username
			m.DisplayName = user.GetDisplayName(model.ShowNicknameFullName)
		}
	}

	writeJSON(w, http.StatusOK, members)
}

func (p *Plugin) handleAddMembers(w http.ResponseWriter, r *http.Request, projectID string) {
	var body struct {
		MemberIDs []string `json:"member_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.MemberIDs) == 0 {
		writeError(w, http.StatusBadRequest, "memberIds is required and must not be empty")
		return
	}

	if err := p.store.AddProjectMembers(projectID, body.MemberIDs); err != nil {
		p.API.LogError("Failed to add members", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to add members")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "added"})
}

func (p *Plugin) handleRemoveMember(w http.ResponseWriter, r *http.Request, projectID, userID string) {
	if err := p.store.RemoveProjectMember(projectID, userID); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "membership not found")
			return
		}
		p.API.LogError("Failed to remove member", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ========================================================================
// Task handlers
// ========================================================================

func (p *Plugin) handleListTasks(w http.ResponseWriter, r *http.Request, projectID string) {
	tasks, err := p.store.GetTasksByProject(projectID)
	if err != nil {
		p.API.LogError("Failed to list tasks", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	result := make([]store.TaskJSON, len(tasks))
	for i, t := range tasks {
		result[i] = t.ToJSON()
	}
	writeJSON(w, http.StatusOK, result)
}

func (p *Plugin) handleCreateTask(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
	var body struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		DueDate     string `json:"due_date"`
		DueTime     string `json:"due_time"`
		Priority    string `json:"priority"`
		AssigneeID  string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	// Default priority.
	priority := body.Priority
	if priority == "" {
		priority = "medium"
	}

	// Determine initial status based on assignee.
	status := "backlog"
	assigneeID := body.AssigneeID
	if assigneeID != "" {
		status = "todo"
	}

	task, err := p.store.CreateTask(
		projectID,
		strings.TrimSpace(body.Title),
		body.Description,
		body.DueDate,
		body.DueTime,
		priority,
		status,
		assigneeID,
	)
	if err != nil {
		p.API.LogError("Failed to create task", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	writeJSON(w, http.StatusCreated, task.ToJSON())
}

func (p *Plugin) handleUpdateTask(w http.ResponseWriter, r *http.Request, taskID string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Translate JSON keys to column names.
	updates := make(map[string]interface{})
	keyMap := map[string]string{
		"title":       "title",
		"description": "description",
		"due_date":    "due_date",
		"due_time":    "due_time",
		"priority":    "priority",
		"status":      "status",
		"sort_order":  "sort_order",
		"assignee_id": "assignee_id",
	}

	for jsonKey, col := range keyMap {
		if v, ok := body[jsonKey]; ok {
			// Convert sort_order to int.
			if jsonKey == "sort_order" {
				switch val := v.(type) {
				case float64:
					updates[col] = int(val)
				case string:
					if i, e := strconv.Atoi(val); e == nil {
						updates[col] = i
					}
				default:
					updates[col] = v
				}
			} else {
				updates[col] = v
			}
		}
	}

	if err := p.store.UpdateTask(taskID, updates); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		p.API.LogError("Failed to update task", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (p *Plugin) handleDeleteTask(w http.ResponseWriter, r *http.Request, taskID string) {
	if err := p.store.DeleteTask(taskID); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		p.API.LogError("Failed to delete task", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ========================================================================
// User handler
// ========================================================================

func (p *Plugin) handleGetUsers(w http.ResponseWriter, r *http.Request) {
	// Paginate through all users.
	var users []*model.User
	page := 0
	perPage := 200

	for {
		batch, appErr := p.API.GetUsers(&model.UserGetOptions{
			Page:    page,
			PerPage: perPage,
		})
		if appErr != nil {
			p.API.LogError("Failed to get users", "error", appErr.Error())
			writeError(w, http.StatusInternalServerError, "failed to get users")
			return
		}
		users = append(users, batch...)
		if len(batch) < perPage {
			break
		}
		page++
	}

	// Return a lighter payload.
	type userView struct {
		ID          string `json:"id"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
	}

	result := make([]userView, len(users))
	for i, u := range users {
		result[i] = userView{
			ID:          u.Id,
			Username:    u.Username,
			DisplayName: u.GetDisplayName(model.ShowNicknameFullName),
			Email:       u.Email,
		}
	}
	writeJSON(w, http.StatusOK, result)
}

// ========================================================================
// Helpers
// ========================================================================

// writeJSON marshals data as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, code int, data interface{}) {
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		io.WriteString(w, `{"error":"failed to encode response"}`)
	}
}

// writeError writes a JSON error payload.
func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// match checks if path equals the given pattern exactly.
func match(path, pattern string) bool {
	return path == pattern
}

// extractID tries to split path as prefix+"/"+id+remainder.
// It returns (remainder, id, true) on success.
func extractID(path, prefix string) (rest string, id string, ok bool) {
	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}
	remaining := path[len(prefix):]
	// The ID is everything up to the next "/" (or end of string).
	if idx := strings.Index(remaining, "/"); idx >= 0 {
		return remaining[idx:], remaining[:idx], true
	}
	return "", remaining, true
}