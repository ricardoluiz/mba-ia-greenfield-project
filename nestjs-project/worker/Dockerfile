FROM node:25.6.0-slim

RUN apt-get update && apt-get install -y ffmpeg curl postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY worker.ts ./worker.ts

CMD ["npx", "tsx", "worker.ts"]
