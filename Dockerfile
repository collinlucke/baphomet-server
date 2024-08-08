FROM node:latest
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env ./
EXPOSE 80
CMD ["npm", "start"]