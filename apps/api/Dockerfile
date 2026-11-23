FROM node:26-bookworm-slim AS build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter api... \
    && pnpm --filter api... build \
    && pnpm --filter api deploy --legacy --prod /runtime \
    && cp -a apps/api/dist /runtime/dist

FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/app.db
COPY --from=build --chown=node:node /runtime/ ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
