FROM node:24-alpine3.21

ARG BASE_URL="/"

# Copy configuration files and install dependencies
COPY *.json ./
COPY *.js ./

RUN npm install --ci
RUN npm install -g serve

# Copy source files and public assets
COPY public/ public/ 
COPY index.html ./
COPY src/ src/

# Build and serve the application
RUN npm run build -- --base $BASE_URL

ENV NODE_ENV=production
EXPOSE 3000

CMD ["serve", "./dist/"]
