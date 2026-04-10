FROM python:3.11-slim

# Build context is the project root (set in docker-compose).
# We place the entire project at /app so that config.py's
# BASE_DIR.parent resolves to /app/cloud correctly.

WORKDIR /app

# Install dependencies first (cache layer)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Working directory for running Flask
WORKDIR /app/backend

EXPOSE 5000

# Seed demo users (safe to run repeatedly — skips existing accounts),
# then start Flask.
CMD ["sh", "-c", "python seed_demo_users.py && python run.py"]
