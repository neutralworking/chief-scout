#!/usr/bin/env python3
"""Chief Scout — Claude Code statusline (multi-line)"""
import sys, json, subprocess

data = json.load(sys.stdin)

model = data.get("model", {}).get("display_name", "Claude")
session = data.get("session_id", "---")[:8]
pct = int(data.get("context_window", {}).get("used_percentage", 0))
cost = data.get("cost", {}).get("total_cost_usd", 0)
dur_ms = data.get("cost", {}).get("total_duration_ms", 0)
mins = dur_ms // 60000
added = data.get("cost", {}).get("total_lines_added", 0)
removed = data.get("cost", {}).get("total_lines_removed", 0)

# Rate limits
rl5h = data.get("rate_limits", {}).get("five_hour", {}).get("used_percentage", 0)
rl7d = data.get("rate_limits", {}).get("seven_day", {}).get("used_percentage", 0)

# Context bar with color gradient
filled = pct // 10
if pct >= 80:
    bar_color = "\033[31m"  # red
elif pct >= 60:
    bar_color = "\033[33m"  # yellow
else:
    bar_color = "\033[36m"  # cyan
bar = f"{bar_color}{'█' * filled}\033[2m{'░' * (10 - filled)}\033[0m"

# Git info (cached — runs fast)
try:
    branch = subprocess.check_output(
        ["git", "symbolic-ref", "--short", "HEAD"], stderr=subprocess.DEVNULL, timeout=1
    ).decode().strip()
except Exception:
    branch = "?"
try:
    dirty = int(subprocess.check_output(
        ["git", "diff", "--numstat"], stderr=subprocess.DEVNULL, timeout=1
    ).decode().count("\n"))
    staged = int(subprocess.check_output(
        ["git", "diff", "--cached", "--numstat"], stderr=subprocess.DEVNULL, timeout=1
    ).decode().count("\n"))
except Exception:
    dirty, staged = 0, 0

C = "\033[36m"  # cyan
G = "\033[32m"  # green
R = "\033[31m"  # red
Y = "\033[33m"  # yellow
M = "\033[35m"  # magenta
D = "\033[2m"   # dim
B = "\033[1m"   # bold
X = "\033[0m"   # reset

sprint = "wave 2 UI + OTP"

# Line 1: model, context, session, cost, lines
line1 = f"{C}{model}{X} {D}│{X} {bar} {D}{pct}%{X} {D}│{X} sess {D}{session}{X} {D}│{X} {Y}${cost:.2f}{X} {D}{mins}m{X} {D}│{X} {G}+{added}{X}{R}-{removed}{X} {D}│{X} {D}sprint:{X} {sprint}"

# Line 2: git, rate limits
git_str = f"{C}{branch}{X}"
if staged > 0:
    git_str += f" {G}+{staged}{X}"
if dirty > 0:
    git_str += f" {Y}~{dirty}{X}"
if staged == 0 and dirty == 0:
    git_str += f" {D}clean{X}"

rl_str = ""
if rl5h:
    rl_color = R if rl5h >= 80 else (Y if rl5h >= 50 else D)
    rl_str += f" {D}│{X} {D}5h{X} {rl_color}{int(rl5h)}%{X}"
if rl7d:
    rl_color = R if rl7d >= 80 else (Y if rl7d >= 50 else D)
    rl_str += f" {D}7d{X} {rl_color}{int(rl7d)}%{X}"

line2 = f"{D}git{X} {git_str}{rl_str}"

print(line1)
print(line2, end="")
