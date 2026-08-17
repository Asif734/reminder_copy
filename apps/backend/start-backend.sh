#!/bin/zsh

osascript <<'EOF'
tell application "Terminal"
  activate
  do script "cd '/Users/tht_developers/Vscode-Asif/reminder copy/apps/backend' && docker compose up"
end tell
EOF
