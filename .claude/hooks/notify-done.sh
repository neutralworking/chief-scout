#!/bin/bash
# Notify on long-running task completion (macOS)
# Plays system sound + sends notification center alert
osascript -e 'display notification "Task complete" with title "Chief Scout" sound name "Glass"' 2>/dev/null
