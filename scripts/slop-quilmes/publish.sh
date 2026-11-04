#!/bin/sh
# Copy the adapted app (<dir>/app) into public/slop-quilmes/ and stamp a version on every module URL,
# so browsers fetch the new modules instead of the cached ones.  usage: publish.sh <dir>/app [version]
set -e
APP=$1
V=${2:-$(date +%Y%m%d%H%M)}
OUT=$(dirname "$0")/../../public/slop-quilmes
rm -rf "$OUT/js" "$OUT/css"
cp -r "$APP/js" "$APP/css" "$OUT/"
cp "$APP/index.html" "$OUT/index.html"
cp "$APP/LICENSE" "$OUT/LICENSE" 2>/dev/null || true
sed -i -E "s#(from '\./[a-z0-9-]+\.js)'#\1?v=$V'#g; s#(import\('\./[a-z0-9-]+\.js)'#\1?v=$V'#g; s#(new URL\('\./[a-z0-9.-]+\.(gz|json))'#\1?v=$V'#g" "$OUT"/js/*.js
sed -i -E "s#(href=\"\./js/[a-z0-9-]+\.js)\"#\1?v=$V\"#g; s#(src=\"\./js/[a-z0-9-]+\.js)\"#\1?v=$V\"#g; s#(href=\"\./css/[a-z0-9-]+\.css)\"#\1?v=$V\"#g" "$OUT/index.html"
echo "published version $V"
