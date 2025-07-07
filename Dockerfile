# Dockerfile for PingOne Protect - Signals SDK Demo
# Use the latest LTS Node.js version (as per package.json engines)
FROM node:lts-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies (only production dependencies)
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose server port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
