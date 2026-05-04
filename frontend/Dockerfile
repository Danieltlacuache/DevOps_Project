# =============================================================================
# CondoManager Pro — Frontend Container Image
# Base: Nginx Alpine for minimal size (~40MB)
# =============================================================================

FROM nginx:alpine

# Copy static files to Nginx html directory
COPY index.html /usr/share/nginx/html/
COPY dashboard.html /usr/share/nginx/html/
COPY register.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY dashboard.js /usr/share/nginx/html/
COPY register.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY config.js /usr/share/nginx/html/

# Custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint script for environment variable injection
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
