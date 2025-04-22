# Use official Node.js LTS image
FROM node:22.1.0

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for local dev/hot reload)
RUN npm install

# Install nodemon globally for hot reload in development
RUN npm install -g nodemon

# Copy the rest of the project
COPY . .

# Create a logs directory (optional but useful)
RUN mkdir -p /app/logs && chmod -R 777 /app/logs

# Set default environment variables
ENV PORT=5255
ENV NODE_ENV=production

# Expose internal port for Docker networking
EXPOSE 5255

# Default command (can be overridden by docker-compose)
CMD ["npm", "start"]
