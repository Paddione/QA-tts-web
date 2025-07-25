FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Give ownership of working directory to node user (UID 1000)
# This matches the typical host user UID to avoid permission issues
RUN chown -R node:node /app

USER node

EXPOSE 3001

CMD ["npm", "start"] 