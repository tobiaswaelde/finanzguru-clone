FROM node:26-bookworm-slim AS build
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')"
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/package.json
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile --ignore-scripts --filter web... \
    && pnpm --filter web... build

FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
COPY --from=build --chown=node:node /workspace/apps/web/.output/ ./
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
