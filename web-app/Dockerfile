FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Give ownership of public directory to nextjs user
RUN chown -R nextjs:nodejs /app/public

USER nextjs

EXPOSE 3000

CMD ["npm", "start"] 