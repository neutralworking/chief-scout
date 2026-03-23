#!/bin/bash
# Chief Scout — session startup dashboard

DATA=$(cat)

bold="\033[1m"
dim="\033[2m"
reset="\033[0m"
cyan="\033[96m"
green="\033[92m"
yellow="\033[93m"
magenta="\033[95m"
white="\033[97m"
bar_green="\033[42m"
bar_dim="\033[100m"

session_id=$(echo "$DATA" | jq -r '.session_id // empty' 2>/dev/null)

echo ""
echo -e "${bold}${cyan}  ⚽  CHIEF SCOUT${reset}${dim}  ─────────────────────────────${reset}"
if [ -n "$session_id" ]; then
  echo -e "  ${dim}session${reset}  ${session_id}"
fi
echo ""

# Git info
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
dirty=$(git diff --stat HEAD 2>/dev/null | tail -1)
ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "?")
echo -e "  ${dim}branch${reset}  ${cyan}${branch}${reset}  ${dim}│${reset}  ${dim}ahead${reset} ${ahead}  ${dim}│${reset}  ${dim}${dirty:-clean}${reset}"
echo ""

# Sprint goals from WORKING.md
if [ -f .claude/context/WORKING.md ]; then
  echo -e "  ${bold}${magenta}Sprint${reset}"
  sed -n '/^## Current Sprint/,/^## /p' .claude/context/WORKING.md 2>/dev/null | grep -E '^[0-9]+\.' | head -4 | while read -r line; do
    if echo "$line" | grep -qi "DONE\|COMPLETE"; then
      icon="\033[92m✓\033[0m"
    elif echo "$line" | grep -qi "IN PROGRESS"; then
      icon="\033[93m◉\033[0m"
    else
      icon="\033[2m○\033[0m"
    fi
    # Extract just the name between ** **
    name=$(echo "$line" | sed 's/^[0-9]*\. \*\*\([^*]*\)\*\*.*/\1/')
    echo -e "  ${icon}  ${name}"
  done
  echo ""
fi

# Fetch remote + check for branches not yet merged to main
git fetch --quiet 2>/dev/null
unmerged_count=$(git branch -r --no-merged origin/main 2>/dev/null | grep -v 'origin/HEAD' | wc -l | tr -d ' ')
unmerged=$(git branch -r --no-merged origin/main --sort=-committerdate 2>/dev/null | grep -v 'origin/HEAD' | head -5)
if [ -n "$unmerged" ]; then
  echo -e "  ${bold}${magenta}Unmerged Branches${reset}  ${dim}(${unmerged_count} total — see BRANCHES.md)${reset}"
  echo "$unmerged" | while read -r br; do
    br_name=$(echo "$br" | sed 's|origin/||;s/^ *//')
    last_commit=$(git log -1 --format="%ar" "$br" 2>/dev/null)
    echo -e "  ${yellow}↗${reset}  ${br_name}  ${dim}(${last_commit})${reset}"
  done
  echo ""
fi

# Recent commits (compact)
echo -e "  ${bold}${magenta}Recent${reset}"
git log --oneline -5 2>/dev/null | while read -r line; do
    hash="${line%% *}"
    msg="${line#* }"
    echo -e "  \033[2m${hash}\033[0m ${msg}"
  done
echo ""

# Quick DB stats if psql available
if command -v psql &>/dev/null && [ -n "$POSTGRES_DSN" ]; then
  people=$(psql "$POSTGRES_DSN" -t -c "SELECT count(*) FROM people" 2>/dev/null | tr -d ' ')
  grades=$(psql "$POSTGRES_DSN" -t -c "SELECT count(*) FROM attribute_grades" 2>/dev/null | tr -d ' ')
  if [ -n "$people" ] && [ -n "$grades" ]; then
    echo -e "  ${bold}${magenta}DB${reset}  ${green}${people}${reset} people  ${dim}│${reset}  ${green}${grades}${reset} grades"
    echo ""
  fi
fi

echo -e "${dim}  ─────────────────────────────────────────────${reset}"
echo ""
