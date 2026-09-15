# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
# You can pass VITE_ env variables as build args here if needed in production
RUN npm run build

# Serve stage
FROM nginx:alpine
# Copy the built output to nginx's html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a basic nginx configuration for React Router (Single Page App)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
