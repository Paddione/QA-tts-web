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

# Give ownership of working directory to node user (UID 1000)
# This matches the typical host user UID to avoid permission issues
RUN chown -R node:node /app

USER node

EXPOSE 3002

CMD ["npm", "start"] 