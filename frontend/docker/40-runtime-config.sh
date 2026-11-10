#!/bin/sh
# Writes the backend URL from the VITE_API_BASE_URL environment variable into
# /config.js at container start, so the URL can be changed without rebuilding.
set -eu

API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:8080}"
# Escape characters that would break the JavaScript string literal.
ESCAPED=$(printf '%s' "$API_BASE_URL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = { apiBaseUrl: "${ESCAPED}" };
EOF

echo "runtime-config: frontend will call backend at ${API_BASE_URL}"
