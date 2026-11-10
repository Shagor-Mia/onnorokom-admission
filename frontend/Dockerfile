# --- Dependencies + sources ---
FROM node:20-alpine AS source
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# --- Test stage: `docker compose --profile test run --rm frontend-tests` ---
FROM source AS test
CMD ["npm", "test"]

# --- Build stage: type-check and build static files ---
FROM source AS build
# Build-time default; the running container can still override it (see below).
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# --- Runtime stage: static files served by nginx ---
FROM nginx:1.27-alpine AS final
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

# The browser calls the backend directly, so this must be a host-reachable URL.
ENV VITE_API_BASE_URL=http://localhost:8080
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
