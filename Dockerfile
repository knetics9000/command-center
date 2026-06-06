# Command Center — Next.js + better-sqlite3. node:20 ships build tools + prebuilt
# better-sqlite3 binaries, so this builds cleanly with no extra apt packages.
FROM node:20-bookworm

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# install deps first (better layer caching)
COPY package*.json ./
RUN npm ci

# app source + build
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
