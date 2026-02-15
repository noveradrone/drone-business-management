#!/bin/zsh
cd "/Users/ozturk/Documents/New project/drone-business-management/frontend" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "npm introuvable. Installe Node.js.";
  read -r "x?Appuie sur Entrée pour fermer..."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm install || { read -r "x?Erreur npm install. Entrée pour fermer..."; exit 1; }
fi
npm run dev
read -r "x?Serveur frontend arrêté. Appuie sur Entrée pour fermer..."
