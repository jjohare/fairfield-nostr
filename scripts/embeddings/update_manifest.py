#!/usr/bin/env python3
"""
Update manifest.json with embedding generation metadata.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
import numpy as np


def update_manifest(
    notes_path: str,
    embeddings_path: str,
    output_path: str
):
    """Update or create manifest.json."""

    # Load existing manifest or create new
    manifest_path = Path(output_path)
    if manifest_path.exists():
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    else:
        manifest = {
            "version": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_event_id": None,
            "total_vectors": 0
        }

    # Load notes to get last event
    with open(notes_path, 'r') as f:
        notes = json.load(f)

    # Load embeddings for stats
    data = np.load(embeddings_path, allow_pickle=True)

    # Update manifest
    manifest["version"] = manifest.get("version", 0) + 1
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest["total_vectors"] = len(data['ids'])
    manifest["dimensions"] = int(data['dimensions'])
    manifest["model"] = str(data.get('model', 'unknown'))
    manifest["quantize_type"] = str(data.get('quantize_type', 'float32'))

    # Track last processed event
    if notes:
        # Sort by created_at and get the most recent
        notes.sort(key=lambda x: x['created_at'], reverse=True)
        manifest["last_event_id"] = notes[0]["id"]
        manifest["last_event_timestamp"] = notes[0]["created_at"]

    # File URLs (will be set relative to GCS bucket)
    version = manifest["version"]
    bucket_name = os.environ.get('GCS_BUCKET_NAME', 'minimoonoir-vectors')

    manifest["files"] = {
        "index": f"v{version}/index.bin",
        "index_mapping": f"v{version}/index_mapping.npz",
        "embeddings": f"v{version}/embeddings.npz",
        "manifest": f"v{version}/manifest.json"
    }

    # Latest URLs for easy access
    manifest["latest"] = {
        "index": "latest/index.bin",
        "index_mapping": "latest/index_mapping.npz",
        "embeddings": "latest/embeddings.npz",
        "manifest": "latest/manifest.json"
    }

    # GCS public URLs
    manifest["gcs_bucket"] = bucket_name
    manifest["public_urls"] = {
        "index": f"https://storage.googleapis.com/{bucket_name}/latest/index.bin",
        "index_mapping": f"https://storage.googleapis.com/{bucket_name}/latest/index_mapping.npz",
        "embeddings": f"https://storage.googleapis.com/{bucket_name}/latest/embeddings.npz",
        "manifest": f"https://storage.googleapis.com/{bucket_name}/latest/manifest.json"
    }

    # Compute file sizes
    embeddings_file = Path(embeddings_path)
    if embeddings_file.exists():
        manifest["embeddings_size_bytes"] = embeddings_file.stat().st_size

    index_file = Path("index.bin")
    if index_file.exists():
        manifest["index_size_bytes"] = index_file.stat().st_size

    # Write manifest
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Updated manifest: version {manifest['version']}, {manifest['total_vectors']} vectors")


def main():
    parser = argparse.ArgumentParser(description='Update embedding manifest')
    parser.add_argument('--notes', required=True, help='Notes JSON file')
    parser.add_argument('--embeddings', required=True, help='Embeddings NPZ file')
    parser.add_argument('--output', required=True, help='Output manifest.json path')

    args = parser.parse_args()

    update_manifest(
        notes_path=args.notes,
        embeddings_path=args.embeddings,
        output_path=args.output
    )


if __name__ == '__main__':
    main()
