# Exercise 7 Solution: Docker Security Best Practices

## Solution

### Step 1: Create a secure application

Create project directory:
```bash
mkdir secure-docker-app
cd secure-docker-app
```

Create `app.py`:
```python
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os

class SecureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = json.dumps({
                'message': 'Secure Docker Application',
                'user': os.environ.get('USER', 'unknown'),
                'uid': os.getuid(),
                'gid': os.getgid()
            })
            self.wfile.write(response.encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), SecureHandler)
    print('Server running on port 8000')
    server.serve_forever()
```

### Step 2: Create .dockerignore

Create `.dockerignore`:
```
# Git
.git
.gitignore

# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv/
.venv/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Docker
Dockerfile*
docker-compose.yml

# Docs
*.md
README.md
LICENSE

# Tests
tests/
test_*.py
*_test.py

# Config
.env
.env.*
```

### Step 3: Create secure Dockerfile

Create `Dockerfile`:
```dockerfile
# Use specific version, not latest
FROM python:3.9.18-slim-bookworm

# Add metadata
LABEL maintainer="security@example.com"
LABEL description="Secure Docker application with best practices"
LABEL version="1.0"

# Create non-root user with specific UID/GID
RUN groupadd -r appgroup -g 1000 && \
    useradd -r -u 1000 -g appgroup -m -s /sbin/nologin appuser

# Set working directory
WORKDIR /app

# Copy application files with correct ownership
COPY --chown=appuser:appgroup app.py .

# Create read-only directories
RUN mkdir -p /app/data && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run application
CMD ["python", "-u", "app.py"]
```

### Step 4: Build the secure image

```bash
docker build -t secure-app:1.0 .
```

### Step 5: Run with security options

```bash
# Run with read-only root filesystem
docker run -d \
  --name secure-app \
  --read-only \
  --tmpfs /tmp \
  -p 8000:8000 \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  secure-app:1.0
```

**Security flags explained**:
- `--read-only`: Makes root filesystem read-only
- `--tmpfs /tmp`: Creates writable temporary directory
- `--security-opt=no-new-privileges`: Prevents privilege escalation
- `--cap-drop=ALL`: Drops all Linux capabilities

### Step 6: Test the application

```bash
# Test endpoint
curl http://localhost:8000

# Expected output:
# {"message": "Secure Docker Application", "user": "appuser", "uid": 1000, "gid": 1000}

# Test health check
curl http://localhost:8000/health

# Check health status
docker inspect secure-app --format='{{.State.Health.Status}}'
```

### Step 7: Verify security measures

```bash
# Verify non-root user
docker exec secure-app id
# Output: uid=1000(appuser) gid=1000(appgroup)

# Try to write to filesystem (should fail)
docker exec secure-app touch /test.txt
# Output: touch: cannot touch '/test.txt': Read-only file system

# Verify can write to tmpfs
docker exec secure-app touch /tmp/test.txt
docker exec secure-app ls -la /tmp/test.txt
# Should succeed

# Check capabilities
docker exec secure-app cat /proc/1/status | grep Cap
# Should show minimal capabilities
```

### Step 8: Scan for vulnerabilities (optional)

```bash
# Using Docker scan (requires Docker account)
docker scan secure-app:1.0

# Using Trivy (if installed)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image secure-app:1.0

# Using Grype (if installed)
grype secure-app:1.0
```

### Step 9: Create docker-compose with security

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    image: secure-app:1.0
    container_name: secure-app
    ports:
      - "8000:8000"
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Run with compose:
```bash
docker-compose up -d
```

## Comprehensive Security Checklist

### ✅ 1. Base Image Security

```dockerfile
# Use specific versions
FROM python:3.9.18-slim-bookworm

# Use minimal base images
FROM python:3.9-slim  # or alpine

# Use official images
FROM python  # Official Python image
```

### ✅ 2. Non-root User

```dockerfile
# Create user with specific UID
RUN useradd -r -u 1000 -m appuser

# Switch to non-root
USER appuser

# Verify in running container
docker exec container id
```

### ✅ 3. Read-only Filesystem

```bash
docker run --read-only --tmpfs /tmp myapp
```

### ✅ 4. Drop Capabilities

```bash
docker run --cap-drop=ALL myapp
```

### ✅ 5. Security Options

```bash
docker run --security-opt=no-new-privileges:true myapp
```

### ✅ 6. Resource Limits

```bash
docker run \
  --memory="512m" \
  --memory-swap="512m" \
  --cpus="1.0" \
  myapp
```

### ✅ 7. Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost/ || exit 1
```

### ✅ 8. Use .dockerignore

Exclude sensitive and unnecessary files.

### ✅ 9. Multi-stage Builds

Minimize final image size and attack surface.

### ✅ 10. Scan for Vulnerabilities

Regularly scan images for known vulnerabilities.

## Advanced Security Dockerfile

```dockerfile
# Use specific digest for immutability
FROM python:3.9.18-slim-bookworm@sha256:abc123...

# Set labels
LABEL security.contact="security@example.com"
LABEL security.reviewed="2024-01-08"

# Update packages and remove cache
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with no shell
RUN groupadd -r appgroup -g 1000 && \
    useradd -r -u 1000 -g appgroup -m -s /sbin/nologin appuser

WORKDIR /app

# Copy with ownership
COPY --chown=appuser:appgroup requirements.txt .

# Install dependencies as root (if needed for compilation)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=appuser:appgroup . .

# Set file permissions
RUN chmod -R 550 /app && \
    chmod -R 770 /app/data

# Switch to non-root user
USER appuser

# Don't expose unnecessary ports
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Use exec form for CMD (doesn't spawn shell)
CMD ["python", "-u", "app.py"]
```

## Docker Compose with Full Security

```yaml
version: '3.8'

services:
  app:
    build: .
    image: secure-app:1.0
    container_name: secure-app
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # Network
    ports:
      - "127.0.0.1:8000:8000"  # Bind to localhost only
    
    # Filesystem
    read_only: true
    tmpfs:
      - /tmp:size=10M,mode=1777
    volumes:
      - type: volume
        source: app-data
        target: /app/data
        read_only: false
    
    # Security
    security_opt:
      - no-new-privileges:true
      - seccomp=./seccomp-profile.json
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if needed
    
    # User
    user: "1000:1000"
    
    # Health
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    
    # Restart
    restart: unless-stopped
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  app-data:
    driver: local
```

## Security Scanning Tools

### 1. Docker Scan

```bash
docker scan secure-app:1.0
```

### 2. Trivy

```bash
# Install
brew install aquasecurity/trivy/trivy

# Scan
trivy image secure-app:1.0

# High and Critical only
trivy image --severity HIGH,CRITICAL secure-app:1.0
```

### 3. Grype

```bash
# Install
brew tap anchore/grype
brew install grype

# Scan
grype secure-app:1.0
```

### 4. Snyk

```bash
# Install
npm install -g snyk

# Authenticate
snyk auth

# Scan
snyk container test secure-app:1.0
```

## Runtime Security

### AppArmor Profile

Create `docker-apparmor-profile`:
```
#include <tunables/global>

profile docker-secure flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  network,
  capability,
  
  deny /sys/[^f]** wklx,
  deny /proc/sys/** wklx,
  deny /proc/sysrq-trigger rwklx,
}
```

Load and use:
```bash
sudo apparmor_parser -r -W docker-apparmor-profile
docker run --security-opt apparmor=docker-secure myapp
```

### Seccomp Profile

Create `seccomp-profile.json`:
```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": [
    "SCMP_ARCH_X86_64"
  ],
  "syscalls": [
    {
      "names": [
        "accept",
        "bind",
        "listen",
        "read",
        "write",
        "close"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

Use:
```bash
docker run --security-opt seccomp=seccomp-profile.json myapp
```

## Security Best Practices Summary

| Practice | Command/Configuration |
|----------|----------------------|
| **Specific versions** | `FROM python:3.9.18-slim` |
| **Non-root user** | `USER appuser` |
| **Read-only FS** | `--read-only` |
| **Drop capabilities** | `--cap-drop=ALL` |
| **No new privileges** | `--security-opt=no-new-privileges` |
| **Resource limits** | `--memory="512m" --cpus="1.0"` |
| **Health checks** | `HEALTHCHECK CMD ...` |
| **Minimal image** | Use alpine or slim variants |
| **Vulnerability scan** | `docker scan`, `trivy`, `grype` |
| **Secrets management** | Use Docker secrets, not ENV |

## Common Security Mistakes to Avoid

### ❌ Running as root

```dockerfile
# Bad
FROM python:3.9
COPY app.py .
CMD ["python", "app.py"]
```

### ✅ Run as non-root

```dockerfile
# Good
FROM python:3.9
RUN useradd -m appuser
USER appuser
COPY app.py .
CMD ["python", "app.py"]
```

### ❌ Using latest tag

```dockerfile
# Bad
FROM python:latest
```

### ✅ Use specific version

```dockerfile
# Good
FROM python:3.9.18-slim
```

### ❌ Exposing sensitive data

```dockerfile
# Bad
ENV DATABASE_PASSWORD=secret123
```

### ✅ Use secrets

```bash
# Good
docker run -e DATABASE_PASSWORD_FILE=/run/secrets/db_password myapp
```

## Key Takeaways

- Always run containers as non-root user
- Use specific image versions, not `latest`
- Implement read-only filesystems where possible
- Drop all capabilities and add only what's needed
- Add health checks for monitoring
- Use .dockerignore to exclude sensitive files
- Scan images regularly for vulnerabilities
- Limit resource usage to prevent DoS
- Never include secrets in images
- Keep base images minimal (alpine, slim)
- Update base images regularly
- Use multi-stage builds to reduce attack surface
