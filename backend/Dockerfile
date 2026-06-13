FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run db:generate && npm run build

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js"]
