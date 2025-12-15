# Multi-stage build for minimal image size
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only first (smaller image, no GPU needed)
RUN pip install --no-cache-dir --user torch==2.1.2 --index-url https://download.pytorch.org/whl/cpu

# Copy and install other Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Download model at build time to avoid cold start delays
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy Python packages and model cache from builder
COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache /root/.cache

# Update PATH
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY main.py .

# Cloud Run expects port 8080
ENV PORT=8080

# Use gunicorn with uvicorn workers for production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 4 --worker-class uvicorn.workers.UvicornWorker --timeout 60 main:app
