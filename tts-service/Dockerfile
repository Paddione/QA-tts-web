FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Create directory for MP3 files and config
RUN mkdir -p /app/public/mp3
RUN mkdir -p /app/config

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Give ownership of mp3 directory to nextjs user
RUN chown -R nextjs:nodejs /app/public/mp3

USER nextjs

EXPOSE 3002

CMD ["npm", "start"] 