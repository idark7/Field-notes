# Deployment (Hostinger VPS, Ubuntu)

This guide deploys the app with Docker and explains how to update from GitHub.

## 1) Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2) Clone the repo

```bash
git clone <YOUR_GITHUB_REPO_URL> field-notes
cd field-notes
```

## 3) Create production `.env`

Create `.env` in the repo root with production values:

```bash
cat <<'ENV' > .env
# App
NODE_ENV=production
JWT_SECRET=change-me-long-random

# Database (for bundled Postgres in docker-compose.yml)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me-strong
POSTGRES_DB=postgres

# App database connection
DATABASE_URL=postgresql://postgres:change-me-strong@db:5432/postgres?schema=gdt_field_notes
ENV
```

### Required vs defaults

- Required: `JWT_SECRET`, `DATABASE_URL`.
- Defaults (used if omitted): `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=postgres`.
- Optional: `NODE_ENV=production` (recommended).
- If you use an external database, only `DATABASE_URL` is required; you can omit the `POSTGRES_*` values.

If you are using an external Postgres (managed DB), set `DATABASE_URL` to that host and either:
- remove the `db` service from `docker-compose.yml`, or
- keep it but ignore it.

## 4) Build and run

```bash
docker compose up -d --build
```

Migrations are applied automatically on container start (`prisma migrate deploy`).

Optional seed:

```bash
docker compose exec app npm run db:seed
```

## 5) Update from GitHub

```bash
git pull

docker compose up -d --build
```

This rebuilds the image and restarts the containers.

### Data safety

`docker compose up -d --build` does **not** replace the database. The Postgres data lives in the `db-data` volume and persists across updates. The database is only reset if you run `docker compose down -v` or point `DATABASE_URL` to a different database.

## 6) Logs

```bash
docker compose logs -f app
```

## 7) (Optional) Reverse proxy + SSL

For a custom domain with SSL, put Nginx/Caddy in front of the app and proxy to `localhost:3000`.

Example Nginx upstream:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
