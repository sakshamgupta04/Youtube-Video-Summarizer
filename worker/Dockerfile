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

# Create non-root user with UID 1000 required by Hugging Face Spaces
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    TORCH_HOME=/home/user/.cache/torch

# Create cache directories with user permissions
RUN mkdir -p /home/user/.cache/huggingface /home/user/.cache/torch && \
    chown -R user:user /home/user/.cache

WORKDIR /home/user/app

# Copy requirements and install dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy worker application code
COPY --chown=user:user . /home/user/app

# Switch to non-root user
USER user

# Expose port (7860 is the default port for Hugging Face Spaces)
EXPOSE 7860

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# Start Uvicorn web server (FastAPI + background queue loop)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]

