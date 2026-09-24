FROM node:22-alpine
WORKDIR /app
COPY share-server/*.mjs ./share-server/
COPY src/share-snapshot.js ./src/share-snapshot.js
COPY PRIVACY.md ./PRIVACY.md
RUN printf '{"type":"module"}\n' > package.json && mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8788 SHARE_DATA_DIR=/data
EXPOSE 8788
CMD ["node", "share-server/server.mjs"]
