#!/bin/bash
# Alert on command failure (macOS notification center)
osascript -e 'display notification "Command failed — check terminal" with title "⚠ Chief Scout" sound name "Basso"' 2>/dev/null
