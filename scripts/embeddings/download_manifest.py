#!/usr/bin/env python3
"""
Download manifest.json from Google Cloud Storage to check for existing embeddings.
"""

import json
import os
import sys

try:
    from google.cloud import storage
    from google.cloud.exceptions import NotFound
except ImportError:
    print("Installing google-cloud-storage...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'google-cloud-storage'])
    from google.cloud import storage
    from google.cloud.exceptions import NotFound


def get_gcs_client():
    """Create GCS client using Application Default Credentials."""
    try:
        return storage.Client()
    except Exception as e:
        print(f"No GCS credentials available: {e}")
        return None


def download_manifest(bucket_name: str = None, output: str = 'manifest.json'):
    """Download latest manifest from GCS."""

    # Use environment variable or default
    if bucket_name is None:
        bucket_name = os.environ.get('GCS_BUCKET_NAME', 'minimoonoir-vectors')

    client = get_gcs_client()
    if not client:
        print("No GCS credentials, using default manifest")
        return False

    try:
        bucket = client.bucket(bucket_name)
        blob = bucket.blob('latest/manifest.json')

        manifest_data = blob.download_as_bytes()
        manifest = json.loads(manifest_data.decode('utf-8'))

        with open(output, 'w') as f:
            json.dump(manifest, f, indent=2)

        print(f"Downloaded manifest: version {manifest.get('version')}, {manifest.get('total_vectors')} vectors")
        return True

    except NotFound:
        print(f"No existing manifest found in gs://{bucket_name}/latest/manifest.json")
        return False
    except Exception as e:
        print(f"Error downloading manifest: {e}")
        return False


if __name__ == '__main__':
    success = download_manifest()
    sys.exit(0 if success else 1)
