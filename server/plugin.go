package main

import (
        "database/sql"
        "encoding/json"
        "fmt"
        "io"
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
        botDisplayName = "بوت إدارة المشاريع"
        botDescription = "بوت نظام لإشعارات إضافة إدارة المشاريع"
        maxBodySize    = 1 << 20 // 1 MB
)

// hexColorRe validates 6-digit hex color strings like #ff0033.
var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// validPriorities is the set of accepted priority values.
var validPriorities = map[string]bool{"low": true, "medium": true, "high": true, "critical": true}

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

// ensureBot creates or finds the bot user and stores its ID.
func (p *Plugin) ensureBot() error {
        // Try to find existing bot by username
        if user, appErr := p.API.GetUserByUsername(botUsername); appErr == nil && user != nil {
                p.botUserID = user.Id

                bName := botUsername
                bDisplayName := botDisplayName
                bDesc := botDescription

                botPatch := &model.BotPatch{
                        Username:    &bName,
                        DisplayName: &bDisplayName,
                        Description: &bDesc,
                }
                if _, err := p.API.PatchBot(user.Id, botPatch); err != nil {
                        p.API.LogWarn("Failed to patch bot details", "error", err.Error())
                }

                p.API.LogInfo("Bot user found and patched", "user_id", user.Id)
                return nil
        }

        // Create the bot
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
                // Don't fail activation, just log
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
                        p.handleDeleteProject(w, r, id)
                        return
                case rest == "/members" && r.Method == http.MethodPost:
                        p.handleAddMembers(w, r, id)
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
                                p.handleRemoveMember(w, r, id, memberUserID)
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
                        p.handleDeleteTask(w, r, taskID)
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
                        p.handleDeleteColumn(w, r, colID)
                        return
                }
        }

        // /api/v1/users
        if match(path, "/api/v1/users") && r.Method == http.MethodGet {
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
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }

        user, err := p.API.GetUser(userID)
        if err != nil {
                writeError(w, http.StatusInternalServerError, "failed to get user")
                return
        }
        if !strings.Contains(user.Roles, "system_admin") {
                writeError(w, http.StatusForbidden, "only system admins can create projects")
                return
        }
        if strings.TrimSpace(body.Name) == "" {
                writeError(w, http.StatusBadRequest, "project name is required")
                return
        }

        proj, createErr := p.store.CreateProject(strings.TrimSpace(body.Name), body.Description, userID)
        if createErr != nil {
                p.API.LogError("Failed to create project", "error", createErr.Error())
                writeError(w, http.StatusInternalServerError, "failed to create project")
                return
        }
        p.broadcastProjectUpdate(proj.ID)
        writeJSON(w, http.StatusCreated, proj)
}

// isProjectMember checks if a user is a member of a project.
func (p *Plugin) isProjectMember(projectID, userID string) (bool, error) {
        members, err := p.store.GetProjectMembers(projectID)
        if err != nil {
                return false, fmt.Errorf("check project membership: %w", err)
        }
        for _, m := range members {
                if m.UserID == userID {
                        return true, nil
                }
        }
        return false, nil
}

func (p *Plugin) handleGetProject(w http.ResponseWriter, r *http.Request, id string, userID string) {
        // Membership check
        found, err := p.isProjectMember(id, userID)
        if err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check project membership")
                return
        }
        if !found {
                writeError(w, http.StatusForbidden, "you are not a member of this project")
                return
        }

        proj, err := p.store.GetProject(id)
        if err != nil {
                if err == sql.ErrNoRows {
                        writeError(w, http.StatusNotFound, "project not found")
                        return
                }
                p.API.LogError("Failed to get project", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to get project")
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
                        m.DisplayName = user.GetDisplayName(model.ShowFullName)
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

// isProjectAdmin checks if a user is an admin of a project.
func (p *Plugin) isProjectAdmin(projectID, userID string) (bool, error) {
        members, err := p.store.GetProjectMembers(projectID)
        if err != nil {
                return false, fmt.Errorf("check project admin: %w", err)
        }
        for _, m := range members {
                if m.UserID == userID && m.Role == "admin" {
                        return true, nil
                }
        }
        return false, nil
}

func (p *Plugin) handleDeleteProject(w http.ResponseWriter, r *http.Request, id string) {
        userID := r.Header.Get("Mattermost-User-Id")
        isAdmin, err := p.isProjectAdmin(id, userID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "Only project admins can delete a project")
                return
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
        // Membership check
        found, err := p.isProjectMember(projectID, userID)
        if err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check project membership")
                return
        }
        if !found {
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

func (p *Plugin) handleAddMembers(w http.ResponseWriter, r *http.Request, projectID string) {
        userID := r.Header.Get("Mattermost-User-Id")
        isAdmin, err := p.isProjectAdmin(projectID, userID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "Only project admins can add members")
                return
        }
        var body struct {
                MemberIDs []string `json:"member_ids"`
        }
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&body); err != nil {
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
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "added"})
}

func (p *Plugin) handleRemoveMember(w http.ResponseWriter, r *http.Request, projectID, userID string) {
        currentUserID := r.Header.Get("Mattermost-User-Id")
        isAdmin, err := p.isProjectAdmin(projectID, currentUserID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "Only project admins can remove members")
                return
        }
        if err := p.store.RemoveProjectMember(projectID, userID); err != nil {
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
        // Membership check
        found, err := p.isProjectMember(projectID, userID)
        if err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check project membership")
                return
        }
        if !found {
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
        var body struct {
                Title       string `json:"title"`
                Description string `json:"description"`
                DueDate     string `json:"due_date"`
                DueTime     string `json:"due_time"`
                Priority    string `json:"priority"`
                AssigneeID  string `json:"assignee_id"`
                Status      string `json:"status"`
        }
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }
        if strings.TrimSpace(body.Title) == "" {
                writeError(w, http.StatusBadRequest, "title is required")
                return
        }

        // Validate priority
        priority := body.Priority
        if priority == "" {
                priority = "medium"
        }
        if !validPriorities[priority] {
                writeError(w, http.StatusBadRequest, "invalid priority")
                return
        }

        // Determine initial status
        status := body.Status
        if status == "" {
                status = projectID + "-backlog"
        }
        assigneeID := body.AssigneeID

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
                p.safeGo(func() { p.sendTaskNotification(assigneeID, userID, projectID, projectName, body.Title, priority, task.ID) })
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusCreated, task.ToJSON())
}

func (p *Plugin) handleUpdateTask(w http.ResponseWriter, r *http.Request, taskID string, userID string) {
        var body map[string]interface{}
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }

        // Get task to check project membership and permissions
        task, err := p.store.GetTask(taskID)
        if err != nil {
                writeError(w, http.StatusNotFound, "task not found")
                return
        }

        isAdmin, err := p.isProjectAdmin(task.ProjectID, userID)
        if err != nil {
                p.API.LogError("Failed to check permissions", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "only project admins can update tasks")
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
        if pid, err := p.store.GetTaskProjectID(taskID); err == nil {
                p.broadcastProjectUpdate(pid)
        }
        writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (p *Plugin) handleDeleteTask(w http.ResponseWriter, r *http.Request, taskID string) {
        userID := r.Header.Get("Mattermost-User-Id")

        task, err := p.store.GetTask(taskID)
        if err != nil {
                writeError(w, http.StatusNotFound, "task not found")
                return
        }

        // Check permissions: Must be project admin or the task assignee
        isAdmin, err := p.isProjectAdmin(task.ProjectID, userID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin && !(task.AssigneeID.Valid && task.AssigneeID.String == userID) {
                writeError(w, http.StatusForbidden, "You can only delete your own tasks or must be a project admin")
                return
        }

        if err := p.store.DeleteTask(taskID); err != nil {
                p.API.LogError("Failed to delete task", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to delete task")
                return
        }

        p.broadcastProjectUpdate(task.ProjectID)
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
                if page >= 50 {
                        break
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
                users = append(users, batch...)
                if len(batch) < perPage {
                        break
                }
                page++
        }

        // Return a lighter payload without email.
        type userView struct {
                ID          string `json:"id"`
                Username    string `json:"username"`
                DisplayName string `json:"display_name"`
        }

        result := make([]userView, len(users))
        for i, u := range users {
                result[i] = userView{
                        ID:          u.Id,
                        Username:    u.Username,
                        DisplayName: u.GetDisplayName(model.ShowFullName),
                }
        }
        writeJSON(w, http.StatusOK, result)
}

// ========================================================================
// Helpers
// ========================================================================

// writeJSON marshals data as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, code int, data interface{}) {
        buf, err := json.Marshal(data)
        if err != nil {
                http.Error(w, "internal server error", http.StatusInternalServerError)
                return
        }
        w.Header().Set("Content-Length", strconv.Itoa(len(buf)))
        w.WriteHeader(code)
        w.Write(buf)
}

// ---------- Me Handler ----------

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

// ---------- Column Handlers ----------

func (p *Plugin) handleGetColumns(w http.ResponseWriter, r *http.Request, projectID string, userID string) {
        // Membership check
        found, err := p.isProjectMember(projectID, userID)
        if err != nil {
                p.API.LogError("Failed to check membership", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check project membership")
                return
        }
        if !found {
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
        // Admin check
        isAdmin, err := p.isProjectAdmin(projectID, userID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "only project admins can create columns")
                return
        }

        var col store.Column
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&col); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }
        col.ProjectID = projectID
        if strings.TrimSpace(col.Title) == "" {
                writeError(w, http.StatusBadRequest, "column title is required")
                return
        }

        // Validate color format
        if col.Color != "" && !hexColorRe.MatchString(col.Color) {
                writeError(w, http.StatusBadRequest, "invalid color format, must be #RRGGBB")
                return
        }

        if err := p.store.CreateColumn(&col); err != nil {
                p.API.LogError("Failed to create column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to create column")
                return
        }
        p.broadcastProjectUpdate(projectID)
        writeJSON(w, http.StatusCreated, col)
}

func (p *Plugin) handleUpdateColumn(w http.ResponseWriter, r *http.Request, colID string, userID string) {
        var req struct {
                Title     string `json:"title"`
                Color     string `json:"color"`
                SortOrder *int   `json:"sort_order"`
                ProjectID string `json:"project_id"`
        }
        if err := json.NewDecoder(io.LimitReader(r.Body, maxBodySize)).Decode(&req); err != nil {
                writeError(w, http.StatusBadRequest, "invalid request body")
                return
        }

        // Validate color format
        if req.Color != "" && !hexColorRe.MatchString(req.Color) {
                writeError(w, http.StatusBadRequest, "invalid color format, must be #RRGGBB")
                return
        }

        // Admin check - look up the column to get its project_id
        column, err := p.store.GetColumnByID(colID)
        if err != nil {
                writeError(w, http.StatusNotFound, "column not found")
                return
        }

        isAdmin, err := p.isProjectAdmin(column.ProjectID, userID)
        if err != nil {
                p.API.LogError("Failed to check admin status", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to check permissions")
                return
        }
        if !isAdmin {
                writeError(w, http.StatusForbidden, "only project admins can update columns")
                return
        }

        if err := p.store.UpdateColumn(colID, req.Title, req.Color, req.SortOrder); err != nil {
                p.API.LogError("Failed to update column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to update column")
                return
        }
        p.broadcastProjectUpdate(column.ProjectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (p *Plugin) handleDeleteColumn(w http.ResponseWriter, r *http.Request, colID string) {
        userID := r.Header.Get("Mattermost-User-Id")

        // Get column's project_id from database instead of trusting query params
        column, err := p.store.GetColumnByID(colID)
        if err != nil {
                writeError(w, http.StatusNotFound, "column not found")
                return
        }

        // Verify the caller is a project admin
        isAdmin, err := p.isProjectAdmin(column.ProjectID, userID)
        if err != nil || !isAdmin {
                writeError(w, http.StatusForbidden, "only project admins can delete columns")
                return
        }

        if err := p.store.DeleteColumn(colID); err != nil {
                if err == sql.ErrNoRows {
                        writeError(w, http.StatusNotFound, "column not found")
                        return
                }
                if strings.Contains(err.Error(), "cannot delete column") {
                        writeError(w, http.StatusConflict, err.Error())
                        return
                }
                p.API.LogError("Failed to delete column", "error", err.Error())
                writeError(w, http.StatusInternalServerError, "failed to delete column")
                return
        }

        p.broadcastProjectUpdate(column.ProjectID)
        writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
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
        if remaining == "" || len(remaining) > 64 {
                return "", "", false
        }
        // The ID is everything up to the next "/" (or end of string).
        if idx := strings.Index(remaining, "/"); idx >= 0 {
                return remaining[idx:], remaining[:idx], true
        }
        return "", remaining, true
}

// broadcastProjectUpdate sends a WebSocket event to all project members.
// It looks up project members and sends individual events scoped to each user.
func (p *Plugin) broadcastProjectUpdate(projectID string) {
        members, err := p.store.GetProjectMembers(projectID)
        if err != nil {
                p.API.LogError("Failed to broadcast project update", "error", err.Error())
                return
        }
        payload := map[string]interface{}{"project_id": projectID}
        for _, m := range members {
                p.API.PublishWebSocketEvent("project_updated", payload, &model.WebsocketBroadcast{UserId: m.UserID})
        }
}

// safeGo runs fn in a goroutine with panic recovery.
func (p *Plugin) safeGo(fn func()) {
        go func() {
                defer func() {
                        if r := recover(); r != nil {
                                p.API.LogError("goroutine panic recovered", "panic", fmt.Sprint(r))
                        }
                }()
                fn()
        }()
}

// sendTaskNotification sends a DM from the bot to the assignee when a task is assigned.
func (p *Plugin) sendTaskNotification(assigneeID, creatorID, projectID, projectName, taskTitle, taskPriority, taskID string) {
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
        priorityIcon := "🔵"
        colorCode := "#3498db" // Blue
        switch taskPriority {
        case "low":
                priorityLabel = "منخفض"
                priorityIcon = "🟢"
                colorCode = "#2ecc71" // Green
        case "high":
                priorityLabel = "عالي"
                priorityIcon = "🟠"
                colorCode = "#f39c12" // Orange
        case "critical":
                priorityLabel = "حرج"
                priorityIcon = "🔴"
                colorCode = "#e74c3c" // Red
        }

        post := &model.Post{
                ChannelId: channel.Id,
                UserId:    p.botUserID,
        }
        compactText := fmt.Sprintf("**المشروع:** %s  |  **الأولوية:** %s %s  |  **بواسطة:** 👤 %s",
                projectName, priorityIcon, priorityLabel, creatorName)

        attachment := &model.SlackAttachment{
                Fallback: fmt.Sprintf("مهمة جديدة: %s", taskTitle),
                Color:    colorCode,
                Title:    fmt.Sprintf("📝 %s", taskTitle),
                Pretext:  "**لقد تم تعيين مهمة جديدة لك!**",
                Text:     compactText,
        }

        post.AddProp("attachments", []*model.SlackAttachment{attachment})

        if _, appErr = p.API.CreatePost(post); appErr != nil {
                p.API.LogError("Failed to send task notification", "error", appErr.Error())
        }
}

// MessageWillBePosted intercepts messages before they are posted to block direct messages to the bot.
func (p *Plugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
        // If the bot hasn't been initialized yet, just allow everything
        if p.botUserID == "" {
                return post, ""
        }

        channel, appErr := p.API.GetChannel(post.ChannelId)
        if appErr != nil {
                return post, ""
        }

        // Check if this is a Direct Message channel
        if channel.Type == model.ChannelTypeDirect {
                // A DM channel name is made of the two user IDs joined by "__"
                // If the channel name contains our bot's ID, it means someone is messaging the bot
                if strings.Contains(channel.Name, p.botUserID) {
                        // If the sender is NOT the bot itself, block the message
                        if post.UserId != p.botUserID {
                                return nil, "عذراً، هذا البوت مخصص للإشعارات التلقائية فقط ولا يمكن مراسلته."
                        }
                }
        }

        return post, ""
}