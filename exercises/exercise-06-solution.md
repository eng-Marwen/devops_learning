# Exercise 6 Solution: Multi-stage Builds

## Solution

### Step 1: Create a Node.js application

Create project directory:
```bash
mkdir nodejs-multistage
cd nodejs-multistage
```

Create `package.json`:
```json
{
  "name": "nodejs-app",
  "version": "1.0.0",
  "description": "Multi-stage build example",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

Create `server.js`:
```javascript
const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Multi-stage build example',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2: Create single-stage Dockerfile (for comparison)

Create `Dockerfile.single`:
```dockerfile
FROM node:16

WORKDIR /app

COPY package*.json ./
COPY server.js ./

RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
```

### Step 3: Create multi-stage Dockerfile

Create `Dockerfile`:
```dockerfile
# Stage 1: Build/Dependencies
FROM node:16 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY server.js ./

# Stage 2: Production
FROM node:16-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only production dependencies from builder
COPY --from=builder /app/package*.json ./
RUN npm install --production

# Copy application code from builder
COPY --from=builder /app/server.js ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start application
CMD ["npm", "start"]
```

### Step 4: Build both images and compare sizes

```bash
# Build single-stage image
docker build -f Dockerfile.single -t nodejs-single .

# Build multi-stage image
docker build -t nodejs-multi .

# Compare sizes
docker images | grep nodejs
```

**Expected output**:
```
REPOSITORY      TAG       SIZE
nodejs-multi    latest    ~120MB
nodejs-single   latest    ~900MB
```

**Size reduction**: ~85% smaller!

### Step 5: Run and test the optimized image

```bash
# Run the container
docker run -d -p 3000:3000 --name myapp nodejs-multi

# Test the application
curl http://localhost:3000
curl http://localhost:3000/health

# Check running as non-root user
docker exec myapp whoami
# Output: nodejs

# View logs
docker logs myapp

# Check health status
docker inspect myapp | grep -A 5 Health
```

### Step 6: Verify security improvements

```bash
# Check user
docker exec myapp id
# uid=1001(nodejs) gid=1001(nodejs)

# Try to write to system directories (should fail)
docker exec myapp touch /etc/test
# touch: /etc/test: Permission denied

# Clean up
docker stop myapp
docker rm myapp
```

## Advanced Multi-stage Example with Go

Create `main.go`:
```go
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello from Go!")
    })
    
    fmt.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
```

Create `Dockerfile.go`:
```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files if they exist
COPY go.* ./

# Copy source code
COPY main.go ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/app .

EXPOSE 8080

CMD ["./app"]
```

Build and check size:
```bash
docker build -f Dockerfile.go -t go-app .
docker images go-app
# Size: ~10MB (compared to ~800MB with full Go image!)
```

## Python Multi-stage Example

Create `app.py`:
```python
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify(message="Multi-stage Python app")

@app.route('/health')
def health():
    return jsonify(status="healthy")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

Create `requirements.txt`:
```
Flask==2.3.3
```

Create `Dockerfile.python`:
```dockerfile
# Build stage
FROM python:3.9 AS builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.9-slim

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application
COPY app.py .

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Update PATH
ENV PATH=/home/appuser/.local/bin:$PATH

EXPOSE 5000

CMD ["python", "app.py"]
```

Build and compare:
```bash
docker build -f Dockerfile.python -t python-multi .
docker images python-multi
# Significantly smaller than including build tools
```

## Benefits of Multi-stage Builds

### 1. Reduced Image Size
- Only runtime dependencies in final image
- No build tools, compilers, or dev dependencies
- Smaller attack surface

### 2. Better Security
- Fewer packages means fewer vulnerabilities
- Build tools not present in production image
- Can run as non-root user

### 3. Faster Deployment
- Smaller images transfer faster
- Quicker container startup
- Less bandwidth usage

### 4. Cleaner Images
- No leftover build artifacts
- No source code in production (if not needed)
- Optimized layer structure

## Size Comparison Table

| Language | Single-stage | Multi-stage | Reduction |
|----------|-------------|-------------|-----------|
| **Node.js** | ~900MB | ~120MB | 85% |
| **Go** | ~800MB | ~10MB | 98.7% |
| **Python** | ~900MB | ~150MB | 83% |
| **Java** | ~500MB | ~200MB | 60% |

## Best Practices

### 1. Name your build stages

```dockerfile
FROM node:16 AS dependencies
FROM node:16 AS builder
FROM node:16-alpine AS production
```

### 2. Copy only what's needed

```dockerfile
# Copy only compiled artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

### 3. Use appropriate base images

```dockerfile
# Builder: Full featured
FROM node:16 AS builder

# Production: Minimal
FROM node:16-alpine AS production
```

### 4. Leverage build cache

```dockerfile
# Copy dependencies first (changes less frequently)
COPY package*.json ./
RUN npm install

# Copy source code last (changes more frequently)
COPY src ./src
```

### 5. Use .dockerignore

Create `.dockerignore`:
```
node_modules
npm-debug.log
.git
.env
*.md
tests
.dockerignore
Dockerfile*
```

## Advanced Patterns

### Multiple build stages for different targets

```dockerfile
# Base stage
FROM node:16 AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# Test stage
FROM base AS test
RUN npm install
COPY . .
CMD ["npm", "test"]

# Build stage
FROM base AS builder
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:16-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

Build specific stage:
```bash
# Development
docker build --target development -t app:dev .

# Test
docker build --target test -t app:test .

# Production
docker build --target production -t app:prod .
```

### Using build arguments

```dockerfile
ARG NODE_VERSION=16

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
# ... build steps

FROM node:${NODE_VERSION}-alpine
# ... production steps
```

Build with custom argument:
```bash
docker build --build-arg NODE_VERSION=18 -t app .
```

## Troubleshooting

### Issue: Files not found in final stage

**Problem**: Files from builder stage not accessible

**Solution**: Ensure correct COPY --from syntax

```dockerfile
COPY --from=builder /app/dist ./dist
```

### Issue: Large final image despite multi-stage

**Problem**: Copying unnecessary files

**Solution**: Be selective about what you copy

```dockerfile
# Bad
COPY --from=builder /app .

# Good
COPY --from=builder /app/dist ./dist
```

### Issue: Build fails in specific stage

**Solution**: Build and test specific stage

```bash
docker build --target builder -t test-builder .
docker run -it test-builder /bin/sh
```

## Key Takeaways

- Multi-stage builds dramatically reduce image size
- Only include runtime dependencies in final image
- Use minimal base images for production (alpine, slim)
- Name your build stages for clarity
- Copy only necessary artifacts between stages
- Combine with security best practices (non-root user)
- Use .dockerignore to exclude unnecessary files
- Test each stage independently during development
