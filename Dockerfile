# Use official Node.js LTS image
FROM node:22.1.0

# Create app directory
WORKDIR /app

# Install dependencies (excluding dev)
COPY package*.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Create logs directory with write access
RUN mkdir -p /app/logs && chmod -R 777 /app/logs

# Set environment vars (can be overridden at runtime)
ENV PORT=5255
ENV NODE_ENV=production

# Expose internal port
EXPOSE 5255

# Run the app
CMD ["npm", "start"]
