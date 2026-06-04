#!/bin/sh
set -e

cat > /usr/share/nginx/html/env.js <<EOF
window.__ENV__ = {
  "apiBaseUrl": "${API_BASE_URL:-}",
  "kratosPublicUrl": "${KRATOS_PUBLIC_URL:-}"
};
EOF

exec nginx -g 'daemon off;'
