FROM node:alpine3.18
WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY . .
EXPOSE 5050
CMD [ "pnpm", "run", "start" ]