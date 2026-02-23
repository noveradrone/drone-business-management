#!/bin/zsh

PROJECT_DIR="/Users/ozturk/Documents/New project/drone-business-management"
BACKEND_SCRIPT="$PROJECT_DIR/start-backend.command"
FRONTEND_SCRIPT="$PROJECT_DIR/start-frontend.command"

if [ ! -f "$BACKEND_SCRIPT" ] || [ ! -f "$FRONTEND_SCRIPT" ]; then
  echo "Script backend/frontend introuvable dans: $PROJECT_DIR"
  read -r "x?Appuie sur Entree pour fermer..."
  exit 1
fi

open -a Terminal "$BACKEND_SCRIPT"
sleep 1
open -a Terminal "$FRONTEND_SCRIPT"

exit 0
