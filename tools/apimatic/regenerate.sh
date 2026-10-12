#!/bin/sh
# Regenerates Cosign's APIMatic outputs from api/openapi.yaml:
#   docs-portal/  the static docs portal (served by Render)
#   sdks/         TypeScript, Python and C# SDKs
#   tools/apimatic/build/plugin  the Context Plugin (published to its own repo)
# Needs: Node 24 via nvm (.nvmrc), `npm install` here once, and
# `./apimatic.sh auth login` once (opens your browser).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cp "$ROOT/api/openapi.yaml" "$HERE/portal/src/spec/openapi.yaml"
"$HERE/apimatic.sh" api validate -i "$HERE/portal" > /dev/null
"$HERE/apimatic.sh" portal generate -i "$HERE/portal" -d "$HERE/build/portal" -f > /dev/null
"$HERE/apimatic.sh" plugin generate -i "$HERE/portal" -d "$HERE/build/plugin" -f > /dev/null
rm -rf "$ROOT/docs-portal" && cp -R "$HERE/build/portal" "$ROOT/docs-portal"
rm -rf "$ROOT/sdks" && mkdir -p "$ROOT/sdks"
for lang in typescript python csharp; do
  mkdir -p "$ROOT/sdks/$lang"
  unzip -q "$HERE/build/portal/__downloads/sdk/$lang.zip" -d "$ROOT/sdks/$lang"
done
# The Context Plugin's own repo (Osteeen/cosign-context-plugin) lives in plugin-repo/;
# sync it, then commit and push there by hand after reviewing.
if [ -d "$HERE/plugin-repo/.git" ]; then
  rsync -a --delete --exclude .git "$HERE/build/plugin/" "$HERE/plugin-repo/"
fi
echo "Regenerated docs-portal/, sdks/ and the Context Plugin from api/openapi.yaml"
