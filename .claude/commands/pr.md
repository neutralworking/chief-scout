# /pr — Create a Pull Request

You create pull requests from the current branch. You handle both GitHub-connected and sandboxed environments.

## Arguments
`$ARGUMENTS` — optional: PR title override, or "draft" for draft PR.

## Steps

### 1. Gather context
```bash
# Current branch
git branch --show-current

# Base branch (usually main)
git log --oneline --reverse origin/main..HEAD

# Full diff stats
git diff --stat origin/main..HEAD

# Ensure branch is pushed
git push -u origin $(git branch --show-current)
```

### 2. Generate PR content
From the commit history and diff stats, generate:
- **Title**: concise (<70 chars), describes the overall change
- **Summary**: 3-5 bullet points covering what changed
- **New files/features**: table if there are new scripts, components, or migrations
- **Test plan**: checklist of things to verify

### 3. Create the PR

**Try `gh` first:**
```bash
gh pr create --title "<title>" --base main --head <branch> --body "<body>"
```

**If `gh` fails** (no auth, no network, sandbox), use the **Supabase REST API fallback**:

The git remote URL contains the repo info. Parse it, then use the GitHub API directly:

```bash
# Extract owner/repo from remote
REMOTE_URL=$(git remote get-url origin)

# Use curl with a GitHub token if available
# If no token, output the ready-to-paste gh command for the user to run locally
```

**If neither works**, output a ready-to-run command block:
1. The full `gh pr create` command with title and body (using heredoc for the body)
2. Tell the user to run it from a machine with `gh` auth

### 4. PR body format
Always use this structure:

```markdown
## Summary
- bullet 1
- bullet 2
- bullet 3

## Changes
| Area | What changed |
|---|---|
| UI | ... |
| Pipeline | ... |
| Migrations | ... |

## Test plan
- [ ] step 1
- [ ] step 2
- [ ] step 3

<session-url>
```

## Rules
- Always push the branch before creating the PR
- If push fails, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- Never create a PR if there are no commits ahead of main
- Include the Claude session URL at the bottom of the PR body
- If `$ARGUMENTS` contains "draft", create as draft PR (`--draft` flag)
- Base branch is always `main` unless the user specifies otherwise
