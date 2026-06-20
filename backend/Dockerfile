FROM node:22-bookworm-slim

WORKDIR /app

# glibc-based image: reliable sharp/prisma binaries on Windows, macOS, and Linux builders
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libvips42 \
    openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run db:generate && npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["sh", "/usr/local/bin/docker-entrypoint.sh"]
