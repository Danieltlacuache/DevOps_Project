#!/bin/sh
# =============================================================================
# CondoManager Pro — Frontend Entrypoint
# Injects API_URL environment variable into config.js at runtime
# =============================================================================

# Replace the API URL in config.js if API_URL env var is set
if [ -n "$API_URL" ]; then
    sed -i "s|AWS_API_URL:.*|AWS_API_URL: \"${API_URL}\",|" /usr/share/nginx/html/config.js
    echo "Injected API_URL: ${API_URL}"
fi

# Execute the CMD (nginx)
exec "$@"
