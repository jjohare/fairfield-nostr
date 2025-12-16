#!/usr/bin/env python3
"""
Upload embedding index files to Google Cloud Storage.
Creates public bucket structure for frontend sync.

Usage:
    python upload_to_gcs.py --bucket minimoonoir-vectors --source output/

Environment:
    GOOGLE_APPLICATION_CREDENTIALS - Path to service account key JSON
"""

import argparse
import os
from pathlib import Path

try:
    from google.cloud import storage
except ImportError:
    print("Installing google-cloud-storage...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'google-cloud-storage'])
    from google.cloud import storage


def upload_to_gcs(bucket_name: str, source_dir: Path, prefix: str = ""):
    """Upload index files to GCS bucket."""

    client = storage.Client()

    # Create bucket if it doesn't exist
    try:
        bucket = client.get_bucket(bucket_name)
        print(f"Using existing bucket: {bucket_name}")
    except Exception:
        bucket = client.create_bucket(bucket_name, location="us-central1")
        # Make bucket publicly readable
        bucket.make_public(recursive=True, future=True)
        print(f"Created new bucket: {bucket_name}")

    # Files to upload
    files_to_upload = [
        "index.bin",
        "index_mapping.json",
        "embeddings.npz",
        "manifest.json",
        "synthetic_events.json",
    ]

    for filename in files_to_upload:
        source_path = source_dir / filename
        if not source_path.exists():
            print(f"Warning: {filename} not found, skipping")
            continue

        # Upload to versioned prefix
        if prefix:
            blob_name = f"{prefix}/{filename}"
        else:
            blob_name = filename

        blob = bucket.blob(blob_name)

        # Set content type
        content_type = "application/octet-stream"
        if filename.endswith(".json"):
            content_type = "application/json"
        elif filename.endswith(".npz"):
            content_type = "application/x-npz"

        blob.upload_from_filename(str(source_path), content_type=content_type)
        blob.make_public()

        print(f"Uploaded {filename} -> gs://{bucket_name}/{blob_name}")
        print(f"  Public URL: {blob.public_url}")

    # Also upload to 'latest' prefix
    print("\nUpdating 'latest' prefix...")
    for filename in files_to_upload:
        source_path = source_dir / filename
        if not source_path.exists():
            continue

        blob_name = f"latest/{filename}"
        blob = bucket.blob(blob_name)

        content_type = "application/octet-stream"
        if filename.endswith(".json"):
            content_type = "application/json"

        blob.upload_from_filename(str(source_path), content_type=content_type)
        blob.make_public()

        print(f"  latest/{filename} -> {blob.public_url}")

    print("\nUpload complete!")
    print(f"\nManifest URL: https://storage.googleapis.com/{bucket_name}/latest/manifest.json")


def main():
    parser = argparse.ArgumentParser(description='Upload embeddings to Google Cloud Storage')
    parser.add_argument('--bucket', default='minimoonoir-vectors', help='GCS bucket name')
    parser.add_argument('--source', default='output', help='Source directory with index files')
    parser.add_argument('--prefix', default='', help='Key prefix (e.g., v1, v2)')

    args = parser.parse_args()

    source_dir = Path(__file__).parent / args.source

    if not source_dir.exists():
        print(f"Error: Source directory {source_dir} does not exist")
        return 1

    upload_to_gcs(
        bucket_name=args.bucket,
        source_dir=source_dir,
        prefix=args.prefix
    )

    return 0


if __name__ == '__main__':
    exit(main())
