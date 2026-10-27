# Lightweight production container for Google Cloud Run
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy application source and public assets
COPY src/ ./src/
COPY public/ ./public/

# Run as non-root user for container security
USER node

EXPOSE 8080

CMD ["node", "src/index.js"]
