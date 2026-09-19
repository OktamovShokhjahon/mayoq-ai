FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=@twinrx/api
COPY apps/api apps/api
RUN npm run build --workspace=@twinrx/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
