# ===== Docker frontend (Nuxt) =====
# NUXT_PUBLIC_API_BASE di-bake ke bundle client SAAT BUILD,
# jadi diteruskan via build ARG (lihat docker-compose.yml), bukan runtime env.
FROM node:24-alpine AS build

WORKDIR /app

ARG NUXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS prod

WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
