FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=@twinrx/web
COPY apps/web apps/web
RUN npm run build --workspace=@twinrx/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/node_modules apps/web/node_modules
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
