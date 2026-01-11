FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Expose SSE port
EXPOSE 3001

CMD ["npm", "start"]
