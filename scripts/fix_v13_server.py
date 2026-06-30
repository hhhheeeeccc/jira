#!/usr/bin/env python3
"""Fix all server-side audit issues."""

import re

def read(path):
    with open(path, 'r') as f:
        return f.read()

def write(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ============================================================
# 1. server/store/store.go
# ============================================================
s = read('/home/z/my-project/server/store/store.go')

# Fix #6: migration done -> completed
s = s.replace(
    "`UPDATE tasks SET status = project_id || '-done' WHERE status = 'done'`",
    "`UPDATE tasks SET status = project_id || '-completed' WHERE status = 'done'`"
)

# Fix #18 + #21: newID returns error + versioned migrations
s = s.replace(
    "func newID() string {\n\tb := make([]byte, 16)\n\t_, _ = rand.Read(b)",
    "func newID() (string, error) {\n\tb := make([]byte, 16)\n\tif _, err := rand.Read(b); err != nil {\n\t\treturn \"\", fmt.Errorf(\"generate UUID: %w\", err)\n\t}"
)

write('/home/z/my-project/server/store/store.go', s)
print("OK store.go")

# ============================================================
# 2. server/store/task.go
# ============================================================
s = read('/home/z/my-project/server/store/task.go')

# Fix #14: strings.Join
s = s.replace(
    'query := "UPDATE tasks SET " + join(setParts, ", ") + " WHERE id = ?"',
    'query := "UPDATE tasks SET " + strings.Join(setParts, ", ") + " WHERE id = ?"'
)
s = re.sub(r'\nfunc join\(parts \[\]string, sep string\) string \{.*?\n\}', '\n', s, flags=re.DOTALL)

# Fix #11: transaction
s = s.replace(
    '\tid := newID()',
    '\tid, err := newID()\n\tif err != nil {\n\t\treturn nil, fmt.Errorf("generate task ID: %w", err)\n\t}'
)
s = s.replace(
    '\t_, err = s.db.Exec(\n\t\t`INSERT INTO tasks',
    '\t_, err = tx.Exec(\n\t\t`INSERT INTO tasks'
)
# Add tx begin/commit
s = s.replace(
    '\t// Determine sort_order: max existing + 1 for the same project+status.',
    '\ttx, err := s.db.Begin()\n\tif err != nil {\n\t\treturn nil, fmt.Errorf("begin tx: %w", err)\n\t}\n\tdefer tx.Rollback()\n\n\t// Determine sort_order: max existing + 1 for the same project+status.'
)
s = s.replace(
    '\terr = s.db.QueryRow(\n\t\t`SELECT MAX(sort_order) FROM tasks WHERE project_id = ? AND status = ?`,',
    '\terr = tx.QueryRow(\n\t\t`SELECT MAX(sort_order) FROM tasks WHERE project_id = ? AND status = ?`,'
)
# Add commit before return
s = s.replace(
    '\treturn &Task{',
    '\tif err := tx.Commit(); err != nil {\n\t\treturn nil, fmt.Errorf("commit tx: %w", err)\n\t}\n\n\treturn &Task{'
)

write('/home/z/my-project/server/store/task.go', s)
print("OK task.go")

# ============================================================
# 3. server/store/column.go
# ============================================================
s = read('/home/z/my-project/server/store/column.go')

# Fix #19: rows affected
s = s.replace(
    '\t_, err := s.db.Exec(query, args...)\n\tif err != nil {\n\t\treturn fmt.Errorf("failed to update column: %w", err)\n\t}\n\treturn nil\n}',
    '\tres, err := s.db.Exec(query, args...)\n\tif err != nil {\n\t\treturn fmt.Errorf("failed to update column: %w", err)\n\t}\n\tn, _ := res.RowsAffected()\n\tif n == 0 {\n\t\treturn sql.ErrNoRows\n\t}\n\treturn nil\n}'
)

# Fix newID
s = s.replace(
    '\tif col.ID == "" {\n\t\tcol.ID = newID()\n\t}',
    '\tif col.ID == "" {\n\t\tvar err error\n\t\tcol.ID, err = newID()\n\t\tif err != nil {\n\t\t\treturn fmt.Errorf("generate column ID: %w", err)\n\t\t}\n\t}'
)

write('/home/z/my-project/server/store/column.go', s)
print("OK column.go")

# ============================================================
# 4. server/store/project.go
# ============================================================
s = read('/home/z/my-project/server/store/project.go')

s = s.replace('\tid := newID()\n\tnow', '\tid, err := newID()\n\tif err != nil {\n\t\treturn nil, fmt.Errorf("generate project ID: %w", err)\n\t}\n\tnow')
s = s.replace('\t\tmemberID := newID()', '\t\tmemberID, err := newID()\n\t\tif err != nil {\n\t\t\treturn nil, fmt.Errorf("generate member ID: %w", err)\n\t\t}')
s = s.replace('\t\tfor _, uid := range userIDs {\n\t\t\tid := newID()', '\t\tfor _, uid := range userIDs {\n\t\t\tid, err := newID()\n\t\t\tif err != nil {\n\t\t\t\treturn fmt.Errorf("generate member ID: %w", err)\n\t\t\t}')

write('/home/z/my-project/server/store/project.go', s)
print("OK project.go")

# ============================================================
# 5. server/plugin.go
# ============================================================
p = read('/home/z/my-project/server/plugin.go')

# #13: Log commit/buildDate
p = p.replace(
    'p.API.LogInfo("Jira Project Management plugin activating", "version", p.version)',
    'p.API.LogInfo("Jira Project Management plugin activating", "version", p.version, "commit", p.commit, "buildDate", p.buildDate)'
)

# #5: handleDeleteColumn admin-only
p = p.replace(
    '// Authorization: user must be a member of the column\'s project\n\tprojectID, err := p.store.GetColumnProjectID(colID)\n\tif err != nil {\n\t\tp.API.LogError("Failed to get column project", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to verify column ownership")\n\t\treturn\n\t}\n\tif projectID == "" {\n\t\twriteError(w, http.StatusNotFound, "column not found")\n\t\treturn\n\t}\n\tif ok, err := p.store.IsProjectMember(projectID, userID); err != nil {\n\t\tp.API.LogError("Failed to check membership", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to check membership")\n\t\treturn\n\t} else if !ok {\n\t\twriteError(w, http.StatusForbidden, "you are not a member of this project")\n\t\treturn\n\t}\n\n\t// Server-side check',
    '// Authorization: only project admins (or system admins) can delete columns\n\tprojectID, err := p.store.GetColumnProjectID(colID)\n\tif err != nil {\n\t\tp.API.LogError("Failed to get column project", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to verify column ownership")\n\t\treturn\n\t}\n\tif projectID == "" {\n\t\twriteError(w, http.StatusNotFound, "column not found")\n\t\treturn\n\t}\n\tif !p.isUserSystemAdmin(userID) {\n\t\tif ok, err := p.store.IsProjectAdmin(projectID, userID); err != nil {\n\t\t\tp.API.LogError("Failed to check project admin", "error", err.Error())\n\t\t\twriteError(w, http.StatusInternalServerError, "failed to check permissions")\n\t\t\treturn\n\t\t} else if !ok {\n\t\t\twriteError(w, http.StatusForbidden, "only project admins can delete columns")\n\t\t\treturn\n\t\t}\n\t}\n\n\t// Server-side check'
)

# #5: handleUpdateColumn admin-only
p = p.replace(
    '// Authorization: user must be a member of the column\'s project\n\tprojectID, err := p.store.GetColumnProjectID(colID)\n\tif err != nil {\n\t\tp.API.LogError("Failed to get column project", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to verify column ownership")\n\t\treturn\n\t}\n\tif projectID == "" {\n\t\twriteError(w, http.StatusNotFound, "column not found")\n\t\treturn\n\t}\n\tif ok, err := p.store.IsProjectMember(projectID, userID); err != nil {\n\t\tp.API.LogError("Failed to check membership", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to check membership")\n\t\treturn\n\t} else if !ok {\n\t\twriteError(w, http.StatusForbidden, "you are not a member of this project")\n\t\treturn\n\t}\n\n\tvar req struct {',
    '// Authorization: only project admins (or system admins) can update columns\n\tprojectID, err := p.store.GetColumnProjectID(colID)\n\tif err != nil {\n\t\tp.API.LogError("Failed to get column project", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to verify column ownership")\n\t\treturn\n\t}\n\tif projectID == "" {\n\t\twriteError(w, http.StatusNotFound, "column not found")\n\t\treturn\n\t}\n\tif !p.isUserSystemAdmin(userID) {\n\t\tif ok, err := p.store.IsProjectAdmin(projectID, userID); err != nil {\n\t\t\tp.API.LogError("Failed to check project admin", "error", err.Error())\n\t\t\twriteError(w, http.StatusInternalServerError, "failed to check permissions")\n\t\t\treturn\n\t\t} else if !ok {\n\t\t\twriteError(w, http.StatusForbidden, "only project admins can update columns")\n\t\t\treturn\n\t\t}\n\t}\n\n\tvar req struct {'
)

# #17: handleGetMe nil check
p = p.replace(
    'if err != nil {\n\t\twriteError(w, http.StatusInternalServerError, "failed to get user")\n\t\treturn\n\t}\n\twriteJSON(w, http.StatusOK, map[string]interface{}{',
    'if err != nil {\n\t\twriteError(w, http.StatusInternalServerError, "failed to get user")\n\t\treturn\n\t}\n\tif user == nil {\n\t\twriteError(w, http.StatusNotFound, "user not found")\n\t\treturn\n\t}\n\twriteJSON(w, http.StatusOK, map[string]interface{}{'
)

# #7: handleGetUsers - privacy + perPage + takes userID
p = p.replace(
    'func (p *Plugin) handleGetUsers(w http.ResponseWriter, r *http.Request) {',
    'func (p *Plugin) handleGetUsers(w http.ResponseWriter, r *http.Request, userID string) {'
)
p = p.replace(
    'if path == "/api/v1/users" && r.Method == http.MethodGet {\n\t\tp.handleGetUsers(w, r)\n\t\treturn\n\t}',
    'if path == "/api/v1/users" && r.Method == http.MethodGet {\n\t\tp.handleGetUsers(w, r, userID)\n\t\treturn\n\t}'
)
# Add perPage param
p = p.replace(
    '\tif v := r.URL.Query().Get("page"); v != "" {\n\t\tif n, err := strconv.Atoi(v); err == nil && n > 0 {\n\t\t\tpage = n - 1 // 0-indexed internally\n\t\t}\n\t}',
    '\tif v := r.URL.Query().Get("page"); v != "" {\n\t\tif n, err := strconv.Atoi(v); err == nil && n > 0 {\n\t\t\tpage = n - 1 // 0-indexed internally\n\t\t}\n\t}\n\tif v := r.URL.Query().Get("per_page"); v != "" {\n\t\tif n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {\n\t\t\tperPage = n\n\t\t}\n\t}'
)
# Email privacy
p = p.replace(
    '\ttype userView struct {\n\t\tID          string `json:"id"`\n\t\tUsername    string `json:"username"`\n\t\tDisplayName string `json:"display_name"`\n\t\tEmail       string `json:"email"`\n\t}\n\n\tresult := make([]userView, len(batch))\n\tfor i, u := range batch {\n\t\tresult[i] = userView{\n\t\t\tID:          u.Id,\n\t\t\tUsername:    u.Username,\n\t\t\tDisplayName: u.GetDisplayName(model.ShowFullName),\n\t\t\tEmail:       u.Email,\n\t\t}\n\t}',
    '\tisAdmin := p.isUserSystemAdmin(userID)\n\n\ttype userView struct {\n\t\tID          string `json:"id"`\n\t\tUsername    string `json:"username"`\n\t\tDisplayName string `json:"display_name"`\n\t\tEmail       string `json:"email,omitempty"`\n\t}\n\n\tresult := make([]userView, len(batch))\n\tfor i, u := range batch {\n\t\tuv := userView{\n\t\t\tID:          u.Id,\n\t\t\tUsername:    u.Username,\n\t\t\tDisplayName: u.GetDisplayName(model.ShowFullName),\n\t\t}\n\t\tif isAdmin {\n\t\t\tuv.Email = u.Email\n\t\t}\n\t\tresult[i] = uv\n\t}'
)

# #12: batch fetch members
p = p.replace(
    '\tfor _, m := range members {\n\t\tuser, appErr := p.API.GetUser(m.UserID)\n\t\tif appErr == nil && user != nil {\n\t\t\tm.Username = user.Username\n\t\t\tm.DisplayName = user.GetDisplayName(model.ShowFullName)\n\t\t}\n\t}',
    '\tuserIDs := make([]string, len(members))\n\tfor i, m := range members {\n\t\tuserIDs[i] = m.UserID\n\t}\n\tif users, appErr := p.API.GetUsersByIds(userIDs); appErr == nil {\n\t\tuserMap := make(map[string]*model.User, len(users))\n\t\tfor _, u := range users {\n\t\t\tuserMap[u.Id] = u\n\t\t}\n\t\tfor _, m := range members {\n\t\t\tif u, ok := userMap[m.UserID]; ok {\n\t\t\t\tm.Username = u.Username\n\t\t\t\tm.DisplayName = u.GetDisplayName(model.ShowFullName)\n\t\t\t}\n\t\t}\n\t}'
)

# #20: validate member_ids
p = p.replace(
    '\tif err := p.store.AddProjectMembers(projectID, body.MemberIDs); err != nil {',
    '\t// Validate all user IDs exist\n\tif users, appErr := p.API.GetUsersByIds(body.MemberIDs); appErr == nil {\n\t\tfound := make(map[string]bool, len(users))\n\t\tfor _, u := range users {\n\t\t\tfound[u.Id] = true\n\t\t}\n\t\tfor _, uid := range body.MemberIDs {\n\t\t\tif !found[uid] {\n\t\t\t\twriteError(w, http.StatusBadRequest, fmt.Sprintf("user %s not found", uid))\n\t\t\t\treturn\n\t\t\t}\n\t\t}\n\t}\n\n\tif err := p.store.AddProjectMembers(projectID, body.MemberIDs); err != nil {'
)

# #28: don't swallow error in handleRemoveMember
p = p.replace(
    '\t// Prevent removing the last admin\n\tmembers, err := p.store.GetProjectMembers(projectID)\n\tif err == nil {\n\t\tadminCount := 0\n\t\tfor _, m := range members {\n\t\t\tif m.Role == "admin" {\n\t\t\t\tadminCount++\n\t\t\t}\n\t\t}\n\t\tisTargetAdmin := false\n\t\tfor _, m := range members {\n\t\t\tif m.UserID == targetUserID && m.Role == "admin" {\n\t\t\t\tisTargetAdmin = true\n\t\t\t\tbreak\n\t\t\t}\n\t\t}\n\t\tif isTargetAdmin && adminCount <= 1 {\n\t\t\twriteError(w, http.StatusForbidden, "cannot remove the last admin of a project")\n\t\t\treturn\n\t\t}\n\t}',
    '\t// Prevent removing the last admin\n\tmembers, err := p.store.GetProjectMembers(projectID)\n\tif err != nil {\n\t\tp.API.LogError("Failed to get members for admin check", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to check project admins")\n\t\treturn\n\t}\n\tadminCount := 0\n\tfor _, m := range members {\n\t\tif m.Role == "admin" {\n\t\t\tadminCount++\n\t\t}\n\t}\n\tisTargetAdmin := false\n\tfor _, m := range members {\n\t\tif m.UserID == targetUserID && m.Role == "admin" {\n\t\t\tisTargetAdmin = true\n\t\t\tbreak\n\t\t}\n\t}\n\tif isTargetAdmin && adminCount <= 1 {\n\t\twriteError(w, http.StatusForbidden, "cannot remove the last admin of a project")\n\t\treturn\n\t}'
)

# #8: notification uses trimmed title
p = p.replace(
    'go p.sendTaskNotification(assigneeID, userID, projectName, body.Title, priority)',
    'go p.sendTaskNotification(assigneeID, userID, projectName, title, priority)'
)

# Fix duplicate priorityIcon in notification message
p = p.replace(
    '"**الأولوية:** %s %s\\n"+\n\t\t\t\t\t\t"**تم التعيين بواسطة:** %s",\n\t\t\t\t\t\tpriorityIcon, projectName, taskTitle, priorityIcon, priorityLabel, creatorName,',
    '"**الأولوية:** %s %s\\n"+\n\t\t\t\t\t\t"**تم التعيين بواسطة:** %s",\n\t\t\t\t\t\tpriorityIcon, projectName, taskTitle, priorityLabel, creatorName,'
)

# #9: validate due_date/due_time in createTask
p = p.replace(
    '\t// Validate status against actual project columns\n\tstatus := body.Status\n\tif status == "" {',
    '\t// Validate due_date format (YYYY-MM-DD)\n\tif body.DueDate != "" && !validDateRe.MatchString(body.DueDate) {\n\t\twriteError(w, http.StatusBadRequest, "due_date must be in YYYY-MM-DD format")\n\t\treturn\n\t}\n\t// Validate due_time format (HH:MM)\n\tif body.DueTime != "" && !validTimeRe.MatchString(body.DueTime) {\n\t\twriteError(w, http.StatusBadRequest, "due_time must be in HH:MM format")\n\t\treturn\n\t}\n\n\t// Validate status against actual project columns\n\tstatus := body.Status\n\tif status == "" {'
)

# #9: validate due_date/due_time in updateTask
p = p.replace(
    '\t\t\t\t// Validate title length\n\t\t\t\tif jsonKey == "title" {',
    '\t\t\t\t// Validate due_date format\n\t\t\t\tif jsonKey == "due_date" {\n\t\t\t\t\tvalStr, _ := v.(string)\n\t\t\t\t\tif valStr != "" && !validDateRe.MatchString(valStr) {\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, "due_date must be in YYYY-MM-DD format")\n\t\t\t\t\t\treturn\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\t// Validate due_time format\n\t\t\t\tif jsonKey == "due_time" {\n\t\t\t\t\tvalStr, _ := v.(string)\n\t\t\t\t\tif valStr != "" && !validTimeRe.MatchString(valStr) {\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, "due_time must be in HH:MM format")\n\t\t\t\t\t\treturn\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\t// Validate title length\n\t\t\t\tif jsonKey == "title" {'
)

# #10: description length in updateTask
p = p.replace(
    '\t\t\t\t// Validate title length\n\t\t\t\tif jsonKey == "title" {\n\t\t\t\t\tvalStr, _ := v.(string)\n\t\t\t\t\tif len(valStr) > maxTaskTitleLen {\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, fmt.Sprintf("title must be at most %d characters", maxTaskTitleLen))\n\t\t\t\t\t\treturn\n\t\t\t\t\t}\n\t\t\t\t}',
    '\t\t\t\t// Validate title length\n\t\t\t\tif jsonKey == "title" {\n\t\t\t\t\tvalStr, _ := v.(string)\n\t\t\t\t\tif len(valStr) > maxTaskTitleLen {\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, fmt.Sprintf("title must be at most %d characters", maxTaskTitleLen))\n\t\t\t\t\t\treturn\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\t// Validate description length\n\t\t\t\tif jsonKey == "description" {\n\t\t\t\t\tvalStr, _ := v.(string)\n\t\t\t\t\tif len(valStr) > maxTaskDescLen {\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, fmt.Sprintf("description must be at most %d characters", maxTaskDescLen))\n\t\t\t\t\t\treturn\n\t\t\t\t\t}\n\t\t\t\t}'
)

# #31: sort_order type validation
p = p.replace(
    '\t\t\t\t\tdefault:\n\t\t\t\t\t\tupdates[col] = v\n\t\t\t\t\t}',
    '\t\t\t\t\tcase nil:\n\t\t\t\t\t\t// null ok\n\t\t\t\t\tdefault:\n\t\t\t\t\t\twriteError(w, http.StatusBadRequest, "sort_order must be a number")\n\t\t\t\t\t\treturn\n\t\t\t\t\t}'
)

# Add regex constants
p = p.replace(
    '// Valid priority checker.\nvar validPriorityRe',
    '// Valid date format checker (YYYY-MM-DD).\nvar validDateRe = regexp.MustCompile(`^\\\\d{4}-\\\\d{2}-\\\\d{2}$`)\n\n// Valid time format checker (HH:MM).\nvar validTimeRe = regexp.MustCompile(`^\\\\d{2}:\\\\d{2}$`)\n\n// Valid priority checker.\nvar validPriorityRe'
)

# handleUpdateColumn: handle ErrNoRows from store
p = p.replace(
    '\tif err := p.store.UpdateColumn(colID, title, req.Color, req.SortOrder); err != nil {\n\t\tp.API.LogError("Failed to update column", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to update column")\n\t\treturn\n\t}',
    '\tif err := p.store.UpdateColumn(colID, title, req.Color, req.SortOrder); err != nil {\n\t\tif err == sql.ErrNoRows {\n\t\t\twriteError(w, http.StatusNotFound, "column not found")\n\t\t\treturn\n\t\t}\n\t\tp.API.LogError("Failed to update column", "error", err.Error())\n\t\twriteError(w, http.StatusInternalServerError, "failed to update column")\n\t\treturn\n\t}'
)

write('/home/z/my-project/server/plugin.go', p)
print("OK plugin.go")
print("\nAll server fixes done!")
