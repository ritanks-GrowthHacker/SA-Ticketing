# Environment Configuration

## Important: Single .env File Policy

This project uses **ONLY** the `.env` file for all environments.

### Configuration:
- ✅ **Docker**: Uses `.env` (configured in docker-compose.yml)
- ✅ **npm run dev**: Uses `.env` only
- ❌ **DO NOT** create `.env.local`, `.env.development`, or `.env.production`

### Why?
- Ensures consistency between development and Docker environments
- Prevents confusion from multiple environment files
- Simplifies deployment and configuration management

### Files:
- `.env` - Main environment file (used by both dev and Docker)
- `.env.example` - Template for new developers
- `.env.local`, `.env.development`, etc. - **BLOCKED** in .gitignore

### How it works:
1. `.gitignore` prevents creation of `.env.local` and variants
2. `.dockerignore` ensures Docker only sees `.env`
3. `next.config.ts` configured for single env file
4. All developers and Docker use the same `.env` file

### For new developers:
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your local database credentials
# DO NOT create .env.local
```
