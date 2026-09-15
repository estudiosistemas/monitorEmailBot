---
name: render
description: >-
  Provides runbooks, configurations, and best practices for deploying, managing,
  and monitoring services and blueprints on Render.com, including render.yaml,
  persistent disks, environment variables, Render CLI, and Render MCP tools.
---

# Render.com Deployment & Operations Skill

This skill provides operational procedures, blueprint specifications, and troubleshooting steps for applications deployed to Render.com.

---

## 1. Render Blueprint (`render.yaml`) Reference

Render allows infrastructure as code through `render.yaml` at the root of the repository.

### Standard Web Service with Persistent Disk:
```yaml
services:
  - type: web
    name: mail-agent-api
    runtime: node
    plan: starter # Persistent disks require Starter plan or above
    region: oregon # or ohio, frankfurt, singapore
    buildCommand: npm ci && npx prisma generate && npm run build
    startCommand: npm run start
    healthCheckPath: /health
    disk:
      name: mail-agent-data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: file:/data/mail-agent.db
      - key: OPENAI_API_KEY
        sync: false # Set manually in the Render dashboard for security
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: ENCRYPTION_KEY
        generateValue: true
```

### Critical Rules for Render Disks:
* **Single Service Attachment:** A Persistent Disk can **only** be mounted to a single service. If you have both a Web Service and a Worker service needing the same database, they cannot share a disk.
  * **Solution:** Combine Web Server + Poller loop inside the same Web Service instance, or use Render Managed PostgreSQL.
* **Write Permissions:** Make sure the application process has write permissions to the mount directory (`/data`).

---

## 2. Using Render MCP Tools

When the Render MCP server is active (`RENDER_API_KEY` configured), the agent can execute:
* **List Services:** Discover existing services, their IDs, status, and repository links.
* **Get Service Details:** Inspect environment variables, plans, and regions.
* **Deploy Service:** Trigger deployments for a service (`deploy_service`).
* **Fetch Logs:** Retrieve recent deployment or runtime logs (`get_logs`) to diagnose crashes or errors.
* **Restart Service:** Restart instances when configurations change.

---

## 3. Deployment Checklist for Node.js / TypeScript Projects

1. **Host Binding:** Ensure the server listens on `0.0.0.0`, not `127.0.0.1` or `localhost`.
   ```typescript
   const port = Number(process.env.PORT) || 3000;
   await app.listen({ port, host: '0.0.0.0' });
   ```
2. **Port Handling:** Always use the `PORT` environment variable injected by Render.
3. **Prisma Migrations:** Run migrations either in the build step or start command:
   ```bash
   npx prisma migrate deploy
   ```
4. **Health Check:** Implement a fast, reliable endpoint at `GET /health` responding with `200 OK`.
