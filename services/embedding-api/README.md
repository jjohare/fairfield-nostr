# Embedding API Service

Cloud Run-compatible embedding API service that generates text embeddings using sentence-transformers.

## Features

- **Model**: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
- **Framework**: FastAPI with async support
- **Production**: Gunicorn with Uvicorn workers
- **Optimization**: Model pre-loaded at build time to minimize cold starts
- **Scaling**: Stateless, auto-scales 0-10 instances

## API Endpoints

### `GET /health`
Health check endpoint for Cloud Run monitoring.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "dimensions": 384
}
```

### `POST /embed`
Generate embeddings for text input.

**Request:**
```json
{
  "text": "Hello world"
}
```
or
```json
{
  "text": ["Hello world", "Another text"]
}
```

**Response:**
```json
{
  "embeddings": [[0.123, -0.456, ...]],
  "dimensions": 384,
  "count": 1
}
```

**Limits:**
- Max 100 texts per request
- Embeddings are L2 normalized for cosine similarity

## Local Development

### Prerequisites
- Python 3.11+
- Docker (optional)

### Run with Python
```bash
cd services/embedding-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Access at http://localhost:8080

### Run with Docker
```bash
cd services/embedding-api
docker build -t embedding-api .
docker run -p 8080:8080 -e ALLOWED_ORIGINS="*" embedding-api
```

## Cloud Run Deployment

### Manual Deployment
```bash
# Build and push image
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly
gcloud run deploy embedding-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 0
```

### Automated Deployment
Connect Cloud Build trigger to repository:
1. Create trigger in Cloud Console
2. Link to `services/embedding-api/cloudbuild.yaml`
3. Deploys automatically on push

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `*` |

## Architecture

```
┌─────────────────┐
│   Cloud Run     │
│  (Auto-scale)   │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ FastAPI  │
    │ Gunicorn │
    └────┬─────┘
         │
    ┌────▼──────────────┐
    │ SentenceTransformer│
    │  all-MiniLM-L6-v2 │
    │  (384 dimensions)  │
    └───────────────────┘
```

## Performance

- **Cold Start**: ~3-5 seconds (model pre-loaded in image)
- **Warm Request**: ~50-100ms per embedding
- **Memory**: 2Gi recommended
- **CPU**: 2 vCPU recommended
- **Concurrency**: 4 threads per worker

## API Usage

Cloud Run deployment endpoint:

```javascript
const response = await fetch('https://embedding-api-617806532906.us-central1.run.app/embed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello' })
});
```

## Monitoring

Cloud Run provides automatic monitoring:
- Request count and latency
- Error rates
- CPU and memory usage
- Cold start metrics

Access metrics in Cloud Console or use Cloud Monitoring API.

## Cost Optimization

- **Min Instances**: Set to 0 for development (scales to zero)
- **Max Instances**: Limit based on expected traffic
- **CPU Allocation**: Only during request processing
- **Memory**: 2Gi sufficient for model + inference

Estimated cost: $0.001-0.01 per 1000 requests (depending on execution time)

## Security

- CORS configured via `ALLOWED_ORIGINS` environment variable
- No authentication required by default (add Cloud IAM if needed)
- Rate limiting recommended via Cloud Armor or API Gateway
- Input validation: max 100 texts per request

## Troubleshooting

### Model not loading
- Check Cloud Build logs for download errors
- Verify memory allocation (min 2Gi)
- Ensure internet access during build

### Timeout errors
- Increase `--timeout` in cloudbuild.yaml
- Check CPU allocation (min 2 vCPU)
- Monitor request latency in Cloud Console

### CORS errors
- Set `ALLOWED_ORIGINS` to your domain
- Multiple origins: comma-separated list
- Wildcard: `*` (development only)
