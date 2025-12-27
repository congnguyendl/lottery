# Use Node.js 18 LTS (không cần openssl-legacy-provider)
FROM node:18-alpine

# Upgrade npm to the latest version
RUN npm install -g npm@9.6.2

# Set the author of the Dockerfile
LABEL maintainer="YIN"

# Set working directory
WORKDIR /lottery

# Copy package files first for better layer caching
COPY server/package*.json ./server/
COPY product/package*.json ./product/

# Install server dependencies
WORKDIR /lottery/server
RUN npm install --production=false

# Install product dependencies
WORKDIR /lottery/product
RUN npm install

# Copy source code
WORKDIR /lottery
COPY server/ ./server/
COPY product/ ./product/

# Remove the line that opens the default browser when starting the server
RUN sed -i '/openBrowser/ d' ./server/server.js || true

# Build the application
# Với Node.js 18, thử build trực tiếp (có thể không cần openssl-legacy-provider)
# Nếu cần, dùng node với flag trực tiếp thay vì NODE_OPTIONS
WORKDIR /lottery/product
RUN node --openssl-legacy-provider ./node_modules/.bin/webpack --mode=production --progress --colors

# Create necessary directories
RUN mkdir -p /lottery/server/data \
    && mkdir -p /lottery/server/cache \
    && mkdir -p /lottery/server/uploads

# Expose port 8888 (server chạy ở port này)
EXPOSE 8888

# Set the working directory to the product directory (where dist is)
WORKDIR /lottery/product

# Start the server
# npm run serve -> cd dist && node ../../server/index.js 8888
# This will serve static files from /lottery/product/dist
CMD ["npm", "run", "serve"]
