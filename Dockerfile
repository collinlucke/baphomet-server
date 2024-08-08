FROM node:latest
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env ./
EXPOSE 5050
CMD ["npm", "start"]