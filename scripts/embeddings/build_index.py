#!/usr/bin/env python3
"""
Build HNSW index from embeddings for fast approximate nearest neighbor search.
"""

import argparse
import numpy as np
from pathlib import Path

try:
    import hnswlib
except ImportError:
    print("Installing hnswlib...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'hnswlib'])
    import hnswlib


def dequantize_int8(quantized: np.ndarray, vmin: float, scale: float) -> np.ndarray:
    """Dequantize int8 vectors back to float32."""
    return ((quantized.astype(np.float32) + 128) / scale) + vmin


def build_index(
    embeddings_path: str,
    existing_index_path: str | None,
    output_path: str,
    m: int = 16,
    ef_construction: int = 200
):
    """Build or update HNSW index."""

    # Load embeddings
    data = np.load(embeddings_path, allow_pickle=True)
    ids = data['ids']
    vectors = data['vectors']
    dimensions = int(data['dimensions'])

    if len(ids) == 0:
        print("No embeddings to index")
        return

    print(f"Loaded {len(ids)} embeddings with {dimensions} dimensions")

    # Dequantize if needed (HNSW needs float32)
    quantize_type = str(data.get('quantize_type', 'float32'))
    if quantize_type == 'int8':
        print("Dequantizing vectors for indexing...")
        vmin = float(data['quantize_min'])
        scale = float(data['quantize_scale'])
        vectors = dequantize_int8(vectors, vmin, scale)

    # Ensure float32
    vectors = vectors.astype(np.float32)

    # Create or load index
    index = hnswlib.Index(space='cosine', dim=dimensions)

    if existing_index_path and Path(existing_index_path).exists():
        print(f"Loading existing index from {existing_index_path}")
        index.load_index(existing_index_path)
        # Resize if needed
        current_count = index.get_current_count()
        new_max = current_count + len(ids)
        index.resize_index(new_max)
    else:
        print("Creating new index...")
        # Initialize with some headroom
        max_elements = max(len(ids) * 2, 10000)
        index.init_index(max_elements=max_elements, M=m, ef_construction=ef_construction)

    # Add vectors
    print(f"Adding {len(ids)} vectors to index...")

    # Create integer labels (HNSW requires int labels)
    # We'll maintain a separate mapping of label -> note_id
    start_label = index.get_current_count()
    labels = np.arange(start_label, start_label + len(ids))

    index.add_items(vectors, labels)

    # Set ef for search (can be adjusted at query time)
    index.set_ef(50)

    # Save index
    index.save_index(output_path)
    print(f"Saved index to {output_path}")
    print(f"Index stats: {index.get_current_count()} vectors, max {index.get_max_elements()}")

    # Save label mapping as JSON (browser-compatible)
    mapping_path = output_path.replace('.bin', '_mapping.json')
    import json
    with open(mapping_path, 'w') as f:
        json.dump({
            'labels': labels.tolist(),
            'ids': ids.tolist()
        }, f)
    print(f"Saved label mapping to {mapping_path}")


def main():
    parser = argparse.ArgumentParser(description='Build HNSW index from embeddings')
    parser.add_argument('--embeddings', required=True, help='Input NPZ file with embeddings')
    parser.add_argument('--existing-index', help='Existing index to update')
    parser.add_argument('--output', required=True, help='Output index file path')
    parser.add_argument('--m', type=int, default=16, help='HNSW M parameter')
    parser.add_argument('--ef-construction', type=int, default=200, help='HNSW ef_construction')

    args = parser.parse_args()

    build_index(
        embeddings_path=args.embeddings,
        existing_index_path=args.existing_index,
        output_path=args.output,
        m=args.m,
        ef_construction=args.ef_construction
    )


if __name__ == '__main__':
    main()
