# P0 — Bug Fixes & Codebase Audit

## Goal

Fix all known bugs from specs 03.1-03.8 and verify every "DONE" feature actually works end-to-end in the browser. Nothing new gets built until the foundation is solid.

## Priority

This phase blocks everything else. Do not proceed to P1 until all bugs are resolved and the audit passes.

## Known Bugs

| # | Bug | Symptom | Expected | Likely Cause |
|---|-----|---------|----------|--------------|
| B1 | Project name not syncing to workspace | New project opens with "Untitled Project" on canvas navbar | Should show the name entered during creation | Workspace shell may not re-fetch after creation, or redirect fires before DB write completes |
| B2 | Share button non-functional | Clicking Share in workspace navbar does nothing | Should open Share Dialog (built in 03.6) | Dialog component exists but may not be wired into workspace navbar |
| B3 | Templates section empty | Templates area in sidebar is blank | Should show "Coming soon" placeholder with clear messaging | No empty state or placeholder rendered |
| B4 | Settings not functional | Settings in sidebar does nothing | Should open settings panel or show placeholder | No settings spec exists — needs placeholder or removal |
| B5 | AI sidebar disconnected | Chat/Suggestions/Spec tabs show stale placeholders | Expected (specs P3-P4 not built), but placeholders should communicate status clearly | Improve placeholder copy and disabled states |

## Codebase Audit Checklist

Run each check manually in the browser. Mark pass/fail.

### Auth Flow
- [ ] Sign up with new account -> lands on /editor
- [ ] Sign in with existing account -> lands on /editor
- [ ] Sign out -> redirects to /
- [ ] Refresh while signed in -> session persists
- [ ] Visit /editor while signed out -> redirects to sign-in

### Project CRUD
- [ ] Create project -> card appears in editor home grid
- [ ] Rename project -> name updates in card and DB
- [ ] Duplicate project -> copy appears with "(Copy)" suffix
- [ ] Delete project -> card removed, DB record gone
- [ ] Project count in sidebar matches actual projects

### Workspace Entry
- [ ] Click project card -> navigate to /editor/[roomId]
- [ ] Workspace navbar shows correct project name
- [ ] Back button returns to editor home
- [ ] Breadcrumb shows correct path

### Collaboration
- [ ] Owner can open Share dialog
- [ ] Invite by email -> collaborator appears in list
- [ ] Collaborator can access the room
- [ ] Remove collaborator -> access revoked
- [ ] Copy link button works

### Liveblocks & Canvas
- [ ] Status bar shows "Connected" in a room
- [ ] Two browser tabs in same room -> mutual cursors visible
- [ ] Canvas pans (drag background) and zooms (scroll wheel)
- [ ] Minimap renders in bottom-right
- [ ] Dot grid background visible
- [ ] Empty state with quick-start actions renders on blank canvas

### API Routes
- [ ] GET /api/projects -> returns user's projects (200)
- [ ] POST /api/projects -> creates project (201)
- [ ] PATCH /api/projects/[id] -> updates project (200)
- [ ] DELETE /api/projects/[id] -> removes project (200)
- [ ] Unauthorized requests -> 401
- [ ] Access to other user's project -> 403

## Acceptance Criteria

- All 5 bugs fixed and verified
- All audit checklist items pass
- No console errors or unhandled promise rejections
- `npm run build` passes clean
- Progress tracker updated with audit results

## Files Likely Affected

| File | Reason |
|------|--------|
| `components/editor/workspace-navbar.tsx` | B1 — project name fetch, B2 — share dialog wiring |
| `components/editor/workspace-shell.tsx` | B1 — project data passing |
| `components/editor/sidebar.tsx` | B3/B4 — template/settings placeholders |
| `components/editor/ai-sidebar.tsx` | B5 — improved placeholder states |
