FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src ./src
COPY .env ./

CMD ["node", "src/app.js"]
