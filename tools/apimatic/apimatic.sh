#!/bin/sh
# Runs the pinned APIMatic CLI (node_modules/@apimatic/cli) with Node 24 from nvm,
# without changing the machine's default Node.
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$HOME/.nvm/versions/node/v$(cat "$DIR/.nvmrc")/bin/node"
exec "$NODE" "$DIR/node_modules/@apimatic/cli/bin/run.js" "$@"
