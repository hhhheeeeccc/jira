package main

import (
        "database/sql"
        "encoding/json"
        "fmt"
        "net/http"
        "regexp"
        "strconv"
        "strings"

        "github.com/hhhheeeeccc/jira/server/store"
        "github.com/mattermost/mattermost-server/v6/model"
        "github.com/mattermost/mattermost-server/v6/plugin"
)

const (
        pluginID       = "com.workspace.plugin.jira"
        botUsername     = "jira.project.bot"
        botDisplayName = "Jira Project Bot"
        botDescription = "System bot for Jira Project Management plugin notifications"

        // Maximum request body size (1 MB).
        maxRequestBodyBytes = 1 << 20

        // Allowed column names for task updates – prevents SQL injection via column names.
        allowedTaskColumns = "title|description|due_date|due_time|priority|status|sort_order|assignee_id"

        // WebSocket event name (constant to avoid typos).
        wsEventProjectUpdated = "custom_" + pluginID + "_project_updated"

        // Allowed priority values.
        allowedPriorities = "low|medium|high|critical"

        // Maximum field lengths.
        maxProjectNameLen    = 200
        maxProjectDescLen    = 2000
        maxTaskTitleLen      = 500
        maxTaskDescLen       = 5000
        maxColumnNameLen     = 100
        maxMembersPerRequest = 50
)

// Valid column name checker (compiled once).
var validTaskColumnRe = regexp.MustCompile(`^(` + allowedTaskColumns + `)$`)

// Valid color format checker (hex color).
var validColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{3,8}$`)

// Valid priority checker.
var validPriorityRe = regexp.MustCompile(`^(` + allowedPriorities + `)$`)

// Valid column ID checker (must look like UUID-suffix pattern).
var validColumnIDRe = regexp.MustCompile(`^[a-f0-9\-]+$`)

// countTasksByColumn counts tasks whose status matches the given column ID.
func countTasksByColumn(db *sql.DB, columnID string) (int, error) {
        var count int
        err := db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE status = ?`, columnID).Scan(&count)
        return count, err
}

// isValidColumnID checks that a status value corresponds to an actual column in the project.
func (p *Plugin) isValidColumnID(projectID, status string) bool {
        if !strings.HasPrefix(status, projectID+"-") {
                return false
        }
        columns, err := p.store.GetProjectColumns(projectID)
        if err != nil {
                return false
        }
        for _, c := range columns {
                if c.ID == status {
                        return true
                }
        }
        return false
}

// Plugin is the core implementation registered with Mattermost.
type Plugin struct {
        plugin.MattermostPlugin
        store     *store.Store
        botUserID string
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

// getConfigValue retrieves a plugin setting by key.
func (p *Plugin) getConfigValue(key string) (interface{}, error) {
        config := p.API.GetPluginConfig()
        if config == nil {
                return nil, nil
        }
        val, ok := config[key]
        if !ok {
                return nil, nil
        }
        return val, nil
}

// isAdminOnly returns whether the EnableAdminOnly setting is true.
func (p *Plugin) isAdminOnly() bool {
        val, err := p.getConfigValue("EnableAdminOnly")
        if err != nil || val == nil {
                return false
        }
        if b, ok := val.(bool); ok {
                return b
        }
        return false
}

// isUserSystemAdmin checks if a user has the system_admin role.
func (p *Plugin) isUserSystemAdmin(userID string) bool {
        user, err := p.API.GetUser(userID)
        if err != nil || user == nil {
                return false
        }
        return strings.Contains(user.Roles, "system_admin")
}

// ensureBot creates or finds the bot user and stores its ID.
func (p *Plugin) ensureBot() error {
        // Try to find existing bot by username
        if user, appErr := p.API.GetUserByUsername(botUsername); appErr == nil && user != nil {
                p.botUserID = user.Id
                p.API.LogInfo("Bot user found", "user_id", user.Id)
                return nil
        }

        // Create a new bot
        bot := &model.Bot{
                Username:    botUsername,
                DisplayName: botDisplayName,
                Description: botDescription,
        }
        createdBot, appErr := p.API.CreateBot(bot)
        if appErr != nil {
                p.API.LogError("Failed to create bot", "error", appErr.Error())
                return fmt.Errorf("create bot: %w", appErr)
        }

        p.botUserID = createdBot.UserId
        p.API.LogInfo("Bot user created", "user_id", createdBot.UserId)
        return nil
}

// OnActivate is called by Mattermost when the plugin is activated.
func (p *Plugin) OnActivate() error {
        p.API.LogInfo("Jira Project Management plugin activating", "version", p.version)

        config := p.API.GetConfig()
        dbDir := "."
        if config != nil && config.FileSettings.Directory != nil && *config.FileSettings.Directory != "" {
                dbDir = *config.FileSettings.Directory
        }

        s, err := store.NewStore(dbDir)
        if err != nil {
                p.API.LogError("Failed to initialise store", "error", err.Error())
                return fmt.Errorf("init store: %w", err)
        }
        p.store = s

        // Create/find bot user for notifications
        if err := p.ensureBot(); err != nil {
                p.API.LogError("Failed to ensure bot user", "error", err.Error())
                // Non-fatal: plugin can still work without bot notifications
        }

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

        // Limit request body size to prevent abuse.
        r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)

        path := r.URL.Path

        // /api/v1/me
        if match(path, "/api/v1/me") && r.Method == http.MethodGet {
                p.handleGetMe(w, r, userID)
                return
        }

        // ---------- Projects ----------
        switch {
        case match(path, "/api/v1/projects") && r.Method == http.MethodGet:
                p.handleListProjects(w, r, userID)
                return
        case match(path, "/api/v1/projects") && r.Method == http.MethodPost:
                p.handleCreateProject(w, r, userID)
                return
        }

        // /api/v1/projects/{id} ...
        if rest, id, ok := extractID(path, "/api/v1/projects/"); ok {
                switch {
                case rest == "" && r.Method == http.MethodGet:
                        p.handleGetProject(w, r, id, userID)
                        return
                case rest == "" && r.Method == http.MethodDelete:
                        p.handleDeleteProject(w, r, id, userID)
                        return
                case rest == "/members" && r.Method == http.MethodPost:
                        p.handleAddMembers(w, r, id, userID)
                        return
                case rest == "/members" && r.Method == http.MethodGet:
                        p.handleGetMembers(w, r, id, userID)
                        return
                case rest == "/columns" && r.Method == http.MethodGet:
                        p.handleGetColumns(w, r, id, userID)
                        return
                case rest == "/columns" && r.Method == http.MethodPost:
                        p.handleCreateColumn(w, r, id, userID)
                        return
                }

                // /api/v1/projects/{id}/members/{userId}
                if memberRest, memberUserID, ok := extractID(rest, "/members/"); ok && memberRest == "" {
                        if r.Method == http.MethodDelete {
                                p.handleRemoveMember(w, r, id, memberUserID, userID)
                                return
                        }
                }

                // /api/v1/projects/{id}/tasks
                switch {
                case rest == "/tasks" && r.Method == http.MethodGet:
                        p.handleListTasks(w, r, id, userID)
                        return
                case rest == "/tasks" && r.Method == http.MethodPost:
                        p.handleCreateTask(w, r, id, userID)
                        return
                }
        }

        // /api/v1/tasks/{id}
        if rest, taskID, ok := extractID(path, "/api/v1/tasks/"); ok && rest == "" {
                if r.Method == http.MethodPatch {
                        p.handleUpdateTask(w, r, taskID, userID)
                        return
                }
                if r.Method == http.MethodDelete {
                        p.handleDeleteTask(w, r, taskID, userID)
                        return
                }
        }

        // /api/v1/columns/{id}
        if rest, colID, ok := extractID(path, "/api/v1/columns/"); ok && rest == "" {
                if r.Method == http.MethodPut {
                        p.handleUpdateColumn(w, r, colID, userID)
                        return
                }
                if r.Method == http.MethodDelete {
                        p.handleDeleteColumn(w, r, colID, userID)
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

func (p *Plugin) handleListProjects(w http.ResponseWriter, r *http.Request, userID string) {
        projects, err := p.store.ListProjects(userID)
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

        // Check EnableAdminOnly setting
        if p.isAdminOnly() && !p.isUserSystemAdmin(userID) {
                writeError(w, http.StatusForbidden, "only system admins can create projects")
                return
        }
        name := strings.TrimSpace(body.Name)
        if name == "" {
                writeError(w, http.StatusBadRequest, "project name is required")
                return
        }
        if len(name) > maxProjectNameLen {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("project name must be at most %d characters", maxProjectNameLen))
                return
        }
        if len(body.Description) > maxProjectDescLen {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("description must be at most %d characters", maxProjectDescLen))
                return
        }

        proj, createErr := p.store.CreateProject(name, body.Description, userID)
        if createErr != nil {
                p.API.LogError("Failed to create project", "error", createErr.Error())
                writeError(w, http.StatusInternalServerError, "failed to create project")
                return
        }
        p.broadcastProjectUpdate(proj.ID)
        writeJSON(w, http.StatusCreated, proj)
}

func (p *Plugin) handleGetProject(w http.ResponseWriter, r *http.Request, id string, userID string) {
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(id, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

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

        writeJSON(w, http.StatusOK, proj)
}

func (p *Plugin) handleDeleteProject(w http.ResponseWriter, r *http.Request, id string, userID string) {
        // Authorization: only project admin or system admin can delete
        if !p.isUserSystemAdmin(userID) {
                if ok, err := p.store.IsProjectAdmin(id, userID); err != nil {
                        p.API.LogError("Failed to check project admin", "error", err.Error())
                        writeError(w, http.StatusInternalServerError, "failed to check permissions")
                        return
                } else if !ok {
                        writeError(w, http.StatusForbidden, "only project admins can delete projects")
                        return
                }
        }

        if err := p.store.DeleteProject(id); err != nil {
                if err == sql.ErrNoRows {
                        writeError(w, http.StatusNotFound, "project not found")
                        return
                }
                p.API.LogError("Failed to delete project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to delete project")
                return
        }
        p.broadcastProjectUpdate(id)
        writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ========================================================================
// Member handlers
// ========================================================================

func (p *Plugin) handleGetMembers(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

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
                        m.DisplayName = user.GetDisplayName(model.ShowFullName)
                }
        }

        writeJSON(w, http.StatusOK, members)
}

func (p *Plugin) handleAddMembers(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Authorization: any project member can add new members
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

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
        if len(body.MemberIDs) > maxMembersPerRequest {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("cannot add more than %d members at once", maxMembersPerRequest))
                return
        }

        if err := p.store.AddProjectMembers(projectID, body.MemberIDs); err != nil {
                p.API.LogError("Failed to add members", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to add members")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "added"})
}

func (p *Plugin) handleRemoveMember(w http.ResponseWriter, r *http.Request, projectID, targetUserID, actorUserID string) {
        // Authorization: only project admins or system admins can remove members
        if !p.isUserSystemAdmin(actorUserID) {
                if ok, err := p.store.IsProjectAdmin(projectID, actorUserID); err != nil {
                        p.API.LogError("Failed to check project admin", "error", err.Error())
                        writeError(w, http.StatusInternalServerError, "failed to check permissions")
                        return
                } else if !ok {
                        writeError(w, http.StatusForbidden, "only project admins can remove members")
                        return
                }
        }

        // Prevent removing the last admin
        members, err := p.store.GetProjectMembers(projectID)
        if err == nil {
                adminCount := 0
                for _, m := range members {
                        if m.Role == "admin" {
                                adminCount++
                        }
                }
                isTargetAdmin := false
                for _, m := range members {
                        if m.UserID == targetUserID && m.Role == "admin" {
                                isTargetAdmin = true
                                break
                        }
                }
                if isTargetAdmin && adminCount <= 1 {
                        writeError(w, http.StatusForbidden, "cannot remove the last admin of a project")
                        return
                }
        }

        if err := p.store.RemoveProjectMember(projectID, targetUserID); err != nil {
                if err == sql.ErrNoRows {
                        writeError(w, http.StatusNotFound, "membership not found")
                        return
                }
                p.API.LogError("Failed to remove member", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to remove member")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ========================================================================
// Task handlers
// ========================================================================

func (p *Plugin) handleListTasks(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

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
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        var body struct {
                Title       string `json:"title"`
                Description string `json:"description"`
                DueDate     string `json:"due_date"`
                DueTime     string `json:"due_time"`
                Priority    string `json:"priority"`
                AssigneeID  string `json:"assignee_id"`
                Status      string `json:"status"`
        }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }
        title := strings.TrimSpace(body.Title)
        if title == "" {
                writeError(w, http.StatusBadRequest, "title is required")
                return
        }
        if len(title) > maxTaskTitleLen {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("title must be at most %d characters", maxTaskTitleLen))
                return
        }
        if len(body.Description) > maxTaskDescLen {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("description must be at most %d characters", maxTaskDescLen))
                return
        }

        // Validate priority
        priority := body.Priority
        if priority == "" {
                priority = "medium"
        }
        if !validPriorityRe.MatchString(priority) {
                writeError(w, http.StatusBadRequest, "priority must be one of: low, medium, high, critical")
                return
        }

        // Validate status against actual project columns
        status := body.Status
        if status == "" {
                status = projectID + "-backlog"
        }
        if !p.isValidColumnID(projectID, status) {
                writeError(w, http.StatusBadRequest, "invalid status: must match an existing column in this project")
                return
        }

        // Validate assignee is a project member (if specified)
        assigneeID := body.AssigneeID
        if assigneeID != "" {
                if ok, err := p.store.IsProjectMember(projectID, assigneeID); err != nil {
                        p.API.LogError("Failed to check assignee membership", "error", err.Error())
                        writeError(w, http.StatusInternalServerError, "failed to verify assignee")
                        return
                } else if !ok {
                        writeError(w, http.StatusBadRequest, "assignee must be a member of this project")
                        return
                }
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

        // Send notification from bot to assignee
        if assigneeID != "" {
                projectName := projectID
                if proj, err := p.store.GetProject(projectID); err == nil && proj != nil {
                        projectName = proj.Name
                }
                go p.sendTaskNotification(assigneeID, userID, projectName, body.Title, priority)
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusCreated, task.ToJSON())
}

func (p *Plugin) handleUpdateTask(w http.ResponseWriter, r *http.Request, taskID string, userID string) {
        // Authorization: user must be a member of the task's project
        projectID, err := p.store.GetTaskProjectID(taskID)
        if err != nil {
                p.API.LogError("Failed to get task project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to verify task ownership")
                return
        }
        if projectID == "" {
                writeError(w, http.StatusNotFound, "task not found")
                return
        }
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        var body map[string]interface{}
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }

        // Translate JSON keys to column names, with whitelist validation.
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
                        // Defense-in-depth: validate column name against whitelist
                        if !validTaskColumnRe.MatchString(col) {
                                p.API.LogError("Rejected invalid column name", "column", col)
                                continue
                        }

                        // Validate priority value
                        if jsonKey == "priority" {
                                valStr, ok := v.(string)
                                if !ok || !validPriorityRe.MatchString(valStr) {
                                        writeError(w, http.StatusBadRequest, "priority must be one of: low, medium, high, critical")
                                        return
                                }
                                updates[col] = valStr
                                continue
                        }

                        // Validate status value against actual columns
                        if jsonKey == "status" {
                                valStr, ok := v.(string)
                                if !ok || !p.isValidColumnID(projectID, valStr) {
                                        writeError(w, http.StatusBadRequest, "invalid status: must match an existing column in this project")
                                        return
                                }
                                updates[col] = valStr
                                continue
                        }

                        // Validate title length
                        if jsonKey == "title" {
                                valStr, _ := v.(string)
                                if len(valStr) > maxTaskTitleLen {
                                        writeError(w, http.StatusBadRequest, fmt.Sprintf("title must be at most %d characters", maxTaskTitleLen))
                                        return
                                }
                        }

                        // Validate assignee is a project member (skip null / empty = clear assignee)
                        if jsonKey == "assignee_id" {
                                switch val := v.(type) {
                                case string:
                                        if val != "" {
                                                if ok, err := p.store.IsProjectMember(projectID, val); err != nil {
                                                        p.API.LogError("Failed to check assignee membership", "error", err.Error())
                                                        writeError(w, http.StatusInternalServerError, "failed to verify assignee")
                                                        return
                                                } else if !ok {
                                                        writeError(w, http.StatusBadRequest, "assignee must be a member of this project")
                                                        return
                                                }
                                        }
                                case nil:
                                        // null is allowed (clear assignee)
                                default:
                                        writeError(w, http.StatusBadRequest, "assignee_id must be a string or null")
                                        return
                                }
                        }

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
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (p *Plugin) handleDeleteTask(w http.ResponseWriter, r *http.Request, taskID string, userID string) {
        // Authorization: user must be a member of the task's project
        projectID, err := p.store.GetTaskProjectID(taskID)
        if err != nil {
                p.API.LogError("Failed to get task project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to verify task ownership")
                return
        }
        if projectID == "" {
                writeError(w, http.StatusNotFound, "task not found")
                return
        }
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        if err := p.store.DeleteTask(taskID); err != nil {
                if err == sql.ErrNoRows {
                        writeError(w, http.StatusNotFound, "task not found")
                        return
                }
                p.API.LogError("Failed to delete task", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to delete task")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ========================================================================
// User handler
// ========================================================================

func (p *Plugin) handleGetUsers(w http.ResponseWriter, r *http.Request) {
        // Paginate with server-side pagination support
        page := 0
        perPage := 200
        if v := r.URL.Query().Get("page"); v != "" {
                if n, err := strconv.Atoi(v); err == nil && n > 0 {
                        page = n - 1 // 0-indexed internally
                }
        }

        batch, appErr := p.API.GetUsers(&model.UserGetOptions{
                Page:    page,
                PerPage: perPage,
        })
        if appErr != nil {
                p.API.LogError("Failed to get users", "error", appErr.Error())
                writeError(w, http.StatusInternalServerError, "failed to get users")
                return
        }

        // Return a lighter payload.
        type userView struct {
                ID          string `json:"id"`
                Username    string `json:"username"`
                DisplayName string `json:"display_name"`
                Email       string `json:"email"`
        }

        result := make([]userView, len(batch))
        for i, u := range batch {
                result[i] = userView{
                        ID:          u.Id,
                        Username:    u.Username,
                        DisplayName: u.GetDisplayName(model.ShowFullName),
                        Email:       u.Email,
                }
        }
        writeJSON(w, http.StatusOK, result)
}

// ========================================================================
// Column handlers
// ========================================================================

func (p *Plugin) handleGetColumns(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        columns, err := p.store.GetProjectColumns(projectID)
        if err != nil {
                p.API.LogError("Failed to get columns", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to get columns")
                return
        }
        writeJSON(w, http.StatusOK, columns)
}

func (p *Plugin) handleCreateColumn(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Authorization: user must be a project member
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        var body struct {
                Title string `json:"title"`
                Color string `json:"color"`
        }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }
        title := strings.TrimSpace(body.Title)
        if title == "" {
                writeError(w, http.StatusBadRequest, "column title is required")
                return
        }
        if len(title) > maxColumnNameLen {
                writeError(w, http.StatusBadRequest, fmt.Sprintf("column title must be at most %d characters", maxColumnNameLen))
                return
        }
        // Sanitize color to prevent abuse
        color := body.Color
        if color == "" {
                color = "#64748b"
        }
        if !validColorRe.MatchString(color) {
                writeError(w, http.StatusBadRequest, "invalid color format")
                return
        }

        col := &store.Column{
                ProjectID: projectID,
                Title:    title,
                Color:    color,
        }
        // Force server-side ID generation (ignore any client-sent ID).
        if err := p.store.CreateColumn(col); err != nil {
                p.API.LogError("Failed to create column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to create column")
                return
        }
        // Re-fetch so timestamps are correct
        columns, err := p.store.GetProjectColumns(projectID)
        if err == nil {
                for _, c := range columns {
                        if c.ID == col.ID {
                                p.broadcastProjectUpdate(projectID)
                                writeJSON(w, http.StatusCreated, c)
                                return
                        }
                }
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusCreated, col)
}

func (p *Plugin) handleUpdateColumn(w http.ResponseWriter, r *http.Request, colID string, userID string) {
        // Authorization: user must be a member of the column's project
        projectID, err := p.store.GetColumnProjectID(colID)
        if err != nil {
                p.API.LogError("Failed to get column project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to verify column ownership")
                return
        }
        if projectID == "" {
                writeError(w, http.StatusNotFound, "column not found")
                return
        }
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        var req struct {
                Title     string `json:"title"`
                Color     string `json:"color"`
                SortOrder *int   `json:"sort_order"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }
        if strings.TrimSpace(req.Title) == "" {
                writeError(w, http.StatusBadRequest, "column title is required")
                return
        }

        if err := p.store.UpdateColumn(colID, req.Title, req.Color, req.SortOrder); err != nil {
                p.API.LogError("Failed to update column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to update column")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (p *Plugin) handleDeleteColumn(w http.ResponseWriter, r *http.Request, colID string, userID string) {
        // Authorization: user must be a member of the column's project
        projectID, err := p.store.GetColumnProjectID(colID)
        if err != nil {
                p.API.LogError("Failed to get column project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to verify column ownership")
                return
        }
        if projectID == "" {
                writeError(w, http.StatusNotFound, "column not found")
                return
        }
        if ok, err := p.store.IsProjectMember(projectID, userID); err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check membership")
                return
        } else if !ok {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        // Server-side check: refuse to delete column that still has tasks.
        taskCount, err := countTasksByColumn(p.store.DB(), colID)
        if err != nil {
                p.API.LogError("Failed to count tasks in column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check column tasks")
                return
        }
        if taskCount > 0 {
                writeError(w, http.StatusConflict, "cannot delete a column that still contains tasks")
                return
        }

        if err := p.store.DeleteColumn(colID); err != nil {
                p.API.LogError("Failed to delete column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to delete column")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// ========================================================================
// Helpers
// ========================================================================

// writeJSON marshals data as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, code int, data interface{}) {
        w.WriteHeader(code)
        if err := json.NewEncoder(w).Encode(data); err != nil {
                http.Error(w, "internal server error", http.StatusInternalServerError)
        }
}

// handleGetMe returns the current user info.
func (p *Plugin) handleGetMe(w http.ResponseWriter, r *http.Request, userID string) {
        user, err := p.API.GetUser(userID)
        if err != nil {
                writeError(w, http.StatusInternalServerError, "failed to get user")
                return
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "id":       userID,
                "is_admin": strings.Contains(user.Roles, "system_admin"),
        })
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

func (p *Plugin) broadcastProjectUpdate(projectID string) {
        p.API.PublishWebSocketEvent(
                wsEventProjectUpdated,
                map[string]interface{}{"project_id": projectID},
                &model.WebsocketBroadcast{},
        )
}

// sendTaskNotification sends a DM from the bot to the assignee when a task is assigned.
func (p *Plugin) sendTaskNotification(assigneeID, creatorID, projectName, taskTitle, taskPriority string) {
        if assigneeID == "" || p.botUserID == "" {
                return
        }

        // Get DM channel between bot and assignee
        channel, appErr := p.API.GetDirectChannel(p.botUserID, assigneeID)
        if appErr != nil {
                p.API.LogError("Failed to get DM channel for notification", "error", appErr.Error())
                return
        }

        // Get creator name for the message
        creatorName := "System"
        if creatorID != "" {
                creator, appErr := p.API.GetUser(creatorID)
                if appErr == nil && creator != nil {
                        creatorName = creator.GetDisplayName(model.ShowNicknameFullName)
                }
        }

        priorityLabel := "متوسط"
        priorityIcon := "📌"
        switch taskPriority {
        case "low":
                priorityLabel = "منخفض"
                priorityIcon = "🟢"
        case "high":
                priorityLabel = "عالي"
                priorityIcon = "🟡"
        case "critical":
                priorityLabel = "حرج"
                priorityIcon = "🔴"
        }

        post := &model.Post{
                ChannelId: channel.Id,
                UserId:    p.botUserID,
                Message: fmt.Sprintf(
                        "%s **لديك مهمة جديدة**\n\n"+
                                "**المشروع:** %s\n"+
                                "**المهمة:** %s\n"+
                                "**الأولوية:** %s %s\n"+
                                "**تم التعيين بواسطة:** %s",
                        priorityIcon, projectName, taskTitle, priorityIcon, priorityLabel, creatorName,
                ),
        }

        if _, appErr = p.API.CreatePost(post); appErr != nil {
                p.API.LogError("Failed to send task notification", "error", appErr.Error())
        }
}
