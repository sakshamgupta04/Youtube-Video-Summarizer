FROM python:3.11-slim

# Prevent python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies: ffmpeg for audio, curl for health checks, git
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker application code
COPY . /app

# Expose port (default 8000, compatible with HF Spaces app_port)
EXPOSE 8000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn web server (FastAPI + background queue loop)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
