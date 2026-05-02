FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.ts tsconfig.json ./
COPY src ./src

RUN npm run build 2>/dev/null || true

EXPOSE 3001

ENV NODE_ENV=production
ENV WS_PORT=3001

CMD ["node", "server.ts"]
