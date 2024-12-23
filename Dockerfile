FROM node:latest AS build

WORKDIR /app

ARG ATLAS_DB_USERNAME
ARG ATLAS_CLUSTER
ARG ATLAS_DB
ARG ATLAS_DB_PASSWORD
ARG ACCESS_TOKEN_SECRET
ARG REFRESH_TOKEN_SECRET
ARG SSL_KEY_PATH
ARG SSL_CERT_PATH
ARG SSL_CA_PATH

ENV ATLAS_DB_USERNAME=${ATLAS_DB_USERNAME}
ENV ATLAS_CLUSTER=${ATLAS_CLUSTER}
ENV ATLAS_DB=${ATLAS_DB}
ENV ATLAS_DB_PASSWORD=${ATLAS_DB_PASSWORD}
ENV ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET}
ENV REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
COPY ${SSL_KEY_PATH} ./keyfile.key
COPY ${SSL_CERT_PATH} ./certfile.cer
COPY ${SSL_CA_PATH} ./intermediate.cer

RUN echo "ATLAS_DB_PASSWORD=${ATLAS_DB_PASSWORD}" >> .env
RUN echo "ATLAS_DB_USERNAME=${ATLAS_DB_USERNAME}" >> .env
RUN echo "ATLAS_CLUSTER=${ATLAS_CLUSTER}" >> .env
RUN echo "ATLAS_DB=${ATLAS_DB}" >> .env
RUN echo "ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET}" >> .env
RUN echo "REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}" >> .env

RUN npm install -g pnpm typescript
RUN pnpm install

EXPOSE 5050
EXPOSE 443
CMD ["pnpm", "start"]
