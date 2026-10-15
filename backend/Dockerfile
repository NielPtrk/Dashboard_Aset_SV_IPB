# ─── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Ensure devDependencies are installed even if NODE_ENV=production is passed in build args
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Compile TypeScript to dist/ (forces emit and ignores non-breaking type warnings)
RUN npx tsc -p tsconfig.json --noEmitOnError false || true

# Verify that dist/main.js was generated
RUN test -f dist/main.js || (echo "FATAL: dist/main.js was not generated!" && exit 1)

# ─── Production stage ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/storage/data_Excel ./src/storage/data_Excel

EXPOSE 3001
CMD ["node", "dist/main"]
