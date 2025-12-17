# SA-Ticketing Docker Setup

## Prerequisites

- Docker Desktop installed
- Docker Compose installed

## Environment Setup

1. Create a `.env.production` file in the root directory with your environment variables:

```env
# Database
DATABASE_URL=your_database_url

# Authentication
JWT_SECRET=your_jwt_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (Nodemailer)
EMAIL_HOST=your_email_host
EMAIL_PORT=your_email_port
EMAIL_USER=your_email_user
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=your_from_email

# Other configurations
NODE_ENV=production
```

## Building and Running

### Using Docker

Build the image:
```bash
docker build -t sa-ticketing .
```

Run the container:
```bash
docker run -p 3000:3000 --env-file .env.production sa-ticketing
```

### Using Docker Compose

Build and start:
```bash
docker-compose up --build
```

Run in detached mode:
```bash
docker-compose up -d
```

Stop the container:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

## Accessing the Application

Once running, access the application at:
- **Local**: http://localhost:3000

## Production Deployment

For production deployment, ensure:
1. All environment variables are properly set
2. Database is accessible from the Docker container
3. SSL/TLS certificates are configured if needed
4. Use a reverse proxy (nginx, Caddy) for HTTPS
5. Set up proper logging and monitoring

## Troubleshooting

### Container fails to start
- Check environment variables in `.env.production`
- Verify database connectivity
- Check logs: `docker-compose logs app`

### Port already in use
- Change the port mapping in `docker-compose.yml`:
  ```yaml
  ports:
    - "8080:3000"  # Use port 8080 instead
  ```

### Build errors
- Ensure all dependencies are listed in `package.json`
- Clear Docker cache: `docker system prune -a`
- Rebuild without cache: `docker-compose build --no-cache`

## Development with Docker

For development, you can mount the source code as a volume:

```yaml
services:
  app:
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
```

## Security Notes

- Never commit `.env` or `.env.production` files
- Use Docker secrets for sensitive data in production
- Regularly update base images for security patches
- Run containers as non-root user (already configured)
