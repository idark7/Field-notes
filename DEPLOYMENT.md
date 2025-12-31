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
JWT_SECRET=change-me-strong-gdt
# If running over HTTPS keep default; for HTTP-only (temporary) set to false so cookies work
COOKIE_SECURE=false

# Database (for bundled Postgres in docker-compose.yml)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me-strong-gdt
POSTGRES_DB=postgres

# App database connection
DATABASE_URL=postgresql://postgres:change-me-strong-gdt@db:5432/postgres?schema=gdt_field_notes
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

## 7) Reverse proxy + HTTPS (Nginx + Let’s Encrypt)

You need a real domain name for a trusted certificate; IP-only will always show “Not Secure”. Point DNS (`A` record) to the VPS public IP first.

### Install Nginx + Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ufw allow 'Nginx Full'   # opens 80/443 if UFW is enabled
```

### Create Nginx config

Replace `your-domain.com` with your domain. This proxies HTTP→app and handles WebSocket upgrades.

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # Managed by Certbot after issuance
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

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

Save as `/etc/nginx/sites-available/field-notes.conf` and enable it:

```bash
sudo ln -s /etc/nginx/sites-available/field-notes.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Obtain and install TLS cert

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot will inject the correct `ssl_certificate` paths and set up auto-renewal. Test renewal:

```bash
sudo certbot renew --dry-run
```

### App config for HTTPS

- In `.env`, set `COOKIE_SECURE=true` so auth cookies use `Secure` flag.
- Keep the app listening on port `3000` (inside Docker). Nginx handles :80/:443.

### Restart stack (if app config changed)

```bash
docker compose up -d --build
```
