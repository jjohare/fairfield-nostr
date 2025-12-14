"""
Cloud Run Embedding API Service
Generates text embeddings using sentence-transformers all-MiniLM-L6-v2 model (384 dimensions)
"""

import os
from typing import List, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import numpy as np


# Global model instance (loaded once at startup)
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model at startup to avoid cold start delays"""
    global model
    print("Loading sentence-transformers model...")
    model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print(f"Model loaded. Embedding dimensions: {model.get_sentence_embedding_dimension()}")
    yield
    # Cleanup (if needed)
    model = None


app = FastAPI(
    title="Embedding API",
    description="Generate text embeddings using sentence-transformers",
    version="1.0.0",
    lifespan=lifespan
)


# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    """Request model for embedding generation"""
    text: Union[str, List[str]] = Field(
        ...,
        description="Single text string or list of text strings to embed"
    )


class EmbedResponse(BaseModel):
    """Response model for embedding generation"""
    embeddings: List[List[float]] = Field(
        ...,
        description="Generated embeddings (list of vectors)"
    )
    dimensions: int = Field(
        ...,
        description="Dimensionality of each embedding vector"
    )
    count: int = Field(
        ...,
        description="Number of embeddings generated"
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "dimensions": model.get_sentence_embedding_dimension() if model else None
    }


@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """
    Generate embeddings for input text(s)

    Args:
        request: EmbedRequest with text (string or list of strings)

    Returns:
        EmbedResponse with embeddings, dimensions, and count
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Normalize input to list
    texts = [request.text] if isinstance(request.text, str) else request.text

    if not texts:
        raise HTTPException(status_code=400, detail="No text provided")

    if len(texts) > 100:
        raise HTTPException(
            status_code=400,
            detail="Too many texts. Maximum 100 per request"
        )

    try:
        # Generate embeddings
        embeddings = model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True  # L2 normalization for cosine similarity
        )

        # Convert to list of lists for JSON serialization
        embeddings_list = embeddings.tolist()

        return EmbedResponse(
            embeddings=embeddings_list,
            dimensions=model.get_sentence_embedding_dimension(),
            count=len(embeddings_list)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding generation failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Embedding API",
        "version": "1.0.0",
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "dimensions": 384,
        "endpoints": {
            "health": "/health",
            "embed": "/embed (POST)"
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
