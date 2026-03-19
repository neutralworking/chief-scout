# /pr — Create a Pull Request

You create pull requests from the current branch.

## Arguments
`$ARGUMENTS` — optional: PR title override, or "draft" for draft PR.

## Steps

### 1. Gather context
```bash
git branch --show-current
git log --oneline --reverse origin/main..HEAD
git diff --stat origin/main..HEAD
git push -u origin $(git branch --show-current)
```

### 2. Generate PR content
From the commit history and diff stats, generate:
- **Title**: concise (<70 chars), describes the overall change
- **Summary**: 3-5 bullet points covering what changed
- **New files/features**: table if there are new scripts, components, or migrations
- **Test plan**: checklist of things to verify

### 3. Extract repo owner/name
Parse from the git remote URL. The remote may be a local proxy like:
`http://local_proxy@127.0.0.1:PORT/git/OWNER/REPO`

```bash
REMOTE_URL=$(git remote get-url origin)
# Extract owner/repo — handles both github.com and proxy URLs
OWNER_REPO=$(echo "$REMOTE_URL" | grep -oP '(?:github\.com[:/]|/git/)(\K[^/]+/[^/.]+)')
```

### 4. Create or update the PR via GitHub API
Always use `curl` to `api.github.com` with `$GH_TOKEN`. The `gh` CLI does NOT work in sandbox environments because it doesn't recognize the local proxy as a GitHub host. **Do not attempt `gh pr create` — go straight to curl.**

**Check for existing PR first:**
```bash
curl -s -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/$OWNER_REPO/pulls?head=OWNER:BRANCH&state=open"
```

**If PR exists → PATCH to update title/body:**
```bash
curl -s -X PATCH \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER_REPO/pulls/$PR_NUMBER" \
  -d '{"title":"...","body":"..."}'
```

**If no PR exists → POST to create:**
```bash
curl -s -X POST \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER_REPO/pulls" \
  -d '{"title":"...","head":"BRANCH","base":"main","body":"...","draft":false}'
```

For draft PRs, set `"draft": true`.

**Parse and display the result:**
```bash
| python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html_url') or d)"
```

### 5. PR body format
Always use this structure:

```markdown
## Summary
- bullet 1
- bullet 2

## Changes
| Area | What changed |
|---|---|
| UI | ... |
| Pipeline | ... |
| Migrations | ... |

## Test plan
- [ ] step 1
- [ ] step 2

<session-url>
```

## Rules
- Always push the branch before creating the PR
- If push fails, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- Never create a PR if there are no commits ahead of main
- Include the Claude session URL at the bottom of the PR body
- If `$ARGUMENTS` contains "draft", create as draft PR
- Base branch is always `main` unless the user specifies otherwise
- **Always use curl + GH_TOKEN, never gh CLI** — the sandbox proxy breaks gh
- Check for existing PR before creating — update if one exists
- Escape JSON body properly (newlines as `\n`, quotes as `\"`)


## Guardrails
Before starting multi-step work, segment the task:

### Per segment:
1. **Scope**: what files/tables/routes are affected
2. **Exit criteria**: specific, testable conditions (not "it works" — be precise)
3. **Scenario tests**: edge cases to verify before moving on
4. **Mid-segment checkpoint**: post progress update

### Rules:
- Max 3 segments per session
- Verify ALL exit criteria before proceeding to next segment
- If blocked: log to `.claude/context/WORKING.md` blockers section, do not power through
- End of task: drop insights to `/context save`
