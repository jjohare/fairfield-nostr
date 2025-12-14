#!/usr/bin/env python3
"""
Upload embedding files to Google Cloud Storage.
Uses Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS.
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


def get_gcs_client():
    """Create GCS client using Application Default Credentials."""
    # If GOOGLE_APPLICATION_CREDENTIALS is set, it will be used automatically
    # Otherwise, falls back to Application Default Credentials
    return storage.Client()


def upload_files(bucket_name: str, files: list[str], prefix: str = ''):
    """Upload files to GCS bucket and make them publicly readable."""

    client = get_gcs_client()
    bucket = client.bucket(bucket_name)

    for file_path in files:
        path = Path(file_path)
        if not path.exists():
            print(f"Warning: {file_path} does not exist, skipping")
            continue

        # Build key with optional prefix
        key = f"{prefix}/{path.name}" if prefix else path.name
        key = key.lstrip('/')

        # Determine content type
        content_type = 'application/octet-stream'
        if path.suffix == '.json':
            content_type = 'application/json'
        elif path.suffix == '.npz':
            content_type = 'application/x-npz'
        elif path.suffix == '.bin':
            content_type = 'application/octet-stream'

        print(f"Uploading {path.name} to gs://{bucket_name}/{key}")

        blob = bucket.blob(key)
        blob.upload_from_filename(
            str(path),
            content_type=content_type
        )

        # Make publicly readable
        blob.make_public()

        print(f"  Uploaded {path.stat().st_size:,} bytes")
        print(f"  Public URL: {blob.public_url}")

    # Also upload to 'latest' prefix for easy access
    print(f"\nUpdating 'latest' prefix...")
    for file_path in files:
        path = Path(file_path)
        if not path.exists():
            continue

        key = f"latest/{path.name}"

        # Determine content type
        content_type = 'application/octet-stream'
        if path.suffix == '.json':
            content_type = 'application/json'
        elif path.suffix == '.npz':
            content_type = 'application/x-npz'
        elif path.suffix == '.bin':
            content_type = 'application/octet-stream'

        blob = bucket.blob(key)
        blob.upload_from_filename(
            str(path),
            content_type=content_type
        )

        # Make publicly readable
        blob.make_public()

        print(f"  Updated latest/{path.name}")

    print("Upload complete!")


def main():
    parser = argparse.ArgumentParser(description='Upload files to Google Cloud Storage')
    parser.add_argument(
        '--bucket',
        default=os.environ.get('GCS_BUCKET_NAME', 'minimoonoir-vectors'),
        help='GCS bucket name (default: minimoonoir-vectors or GCS_BUCKET_NAME env var)'
    )
    parser.add_argument('--files', nargs='+', required=True, help='Files to upload')
    parser.add_argument('--prefix', default='', help='Key prefix (e.g., v1, v2)')

    args = parser.parse_args()

    upload_files(
        bucket_name=args.bucket,
        files=args.files,
        prefix=args.prefix
    )


if __name__ == '__main__':
    main()
