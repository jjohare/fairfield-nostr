#!/usr/bin/env python3
"""
Generate synthetic Nostr data (channels, posts) and build HNSW index.
Uses the deployed embedding API for vector generation.
"""

import json
import hashlib
import time
import random
import requests
import numpy as np
from pathlib import Path

# Configuration
EMBEDDING_API_URL = "https://embedding-api-617806532906.us-central1.run.app"
RELAY_URL = "wss://nostr-relay-617806532906.us-central1.run.app"
OUTPUT_DIR = Path(__file__).parent / "output"

# Synthetic content themes for Fairfield community
THEMES = {
    "meditation": [
        "Just finished a wonderful 20-minute TM session. The silence was profound today.",
        "Anyone else notice how the group meditations feel different? There's a palpable coherence.",
        "Sharing my experience with the Sidhis program - flying sutras are incredible.",
        "Morning dome meditation was beautiful. 500+ meditators creating world peace.",
        "Started the TM-Sidhi program last month. Life-changing experience.",
        "The evening program at the Golden Dome was especially powerful today.",
        "Celebrating 10 years of regular practice. Gratitude for Maharishi's gift.",
    ],
    "community": [
        "New co-op opening on Burlington Ave! Organic produce from local farms.",
        "Looking for a roommate in the Abundance apartments. Vegetarian preferred.",
        "Anyone want to carpool to the Des Moines airport next Friday?",
        "Volunteer opportunity at the Raj - they need help with the gardens.",
        "Community potluck this Sunday at the Patanjali center. Bring a dish!",
        "Book club meeting tomorrow - we're discussing 'Science of Being'.",
        "Lost cat near 1st street - orange tabby named Veda. Please help!",
    ],
    "education": [
        "MIU enrollment open for spring semester. Consciousness-based education rocks!",
        "Computer science program at MIU is really taking off. Great faculty.",
        "Sanskrit class starting next week at the community center.",
        "Ayurveda workshop this weekend - learn about your dosha type.",
        "Jyotish reading available at the Pandit house. Very accurate predictions.",
        "Children's TM program has openings. Great for stress relief in kids.",
        "PhD defense in physics department - quantum mechanics and consciousness.",
    ],
    "wellness": [
        "Panchakarma at the Raj was transformative. Feel 10 years younger!",
        "New yoga studio opening on Main Street. Asana and pranayama classes.",
        "Organic cafe added new vegan options. The kitchari is amazing.",
        "Ayurvedic cooking class this Saturday. Learn to balance your doshas.",
        "Morning yoga in the park - all levels welcome, 6am start.",
        "Pulse diagnosis available at the clinic. Fascinating ancient science.",
        "Herbal supplements workshop - learn about ashwagandha and brahmi.",
    ],
    "events": [
        "World Peace Assembly next month! 8000 meditators expected.",
        "Guru Purnima celebration at the dome. Special program planned.",
        "Diwali festival preparations underway. Fireworks display confirmed.",
        "Summer music festival featuring Gandharva Veda performances.",
        "Annual health fair at MIU campus. Free screenings available.",
        "Sthapatya Veda architecture tour of Vedic City homes.",
        "Documentary screening about Maharishi's global movement.",
    ],
}

CHANNEL_NAMES = [
    ("meditation-circle", "Daily meditation experiences and insights"),
    ("community-board", "Local events, classifieds, and community news"),
    ("miu-students", "MIU student discussions and campus life"),
    ("wellness-corner", "Health, Ayurveda, and holistic living"),
    ("events-calendar", "Upcoming events and gatherings"),
    ("vedic-science", "Discussions on Maharishi's Vedic Science"),
    ("housing-exchange", "Rooms, apartments, and housing needs"),
    ("carpool-connect", "Ride sharing and transportation"),
]


def generate_keypair():
    """Generate a simple deterministic keypair for synthetic data."""
    privkey = hashlib.sha256(str(random.random()).encode()).hexdigest()
    # Simplified - just use hash as pubkey (not cryptographically valid but fine for test data)
    pubkey = hashlib.sha256(privkey.encode()).hexdigest()
    return privkey, pubkey


def create_event(pubkey: str, kind: int, content: str, tags: list) -> dict:
    """Create a Nostr event structure."""
    created_at = int(time.time()) - random.randint(0, 86400 * 30)  # Within last 30 days

    # Create event without signature (for synthetic data)
    event = {
        "pubkey": pubkey,
        "created_at": created_at,
        "kind": kind,
        "tags": tags,
        "content": content,
    }

    # Generate deterministic event ID
    serialized = json.dumps([0, pubkey, created_at, kind, tags, content], separators=(',', ':'))
    event["id"] = hashlib.sha256(serialized.encode()).hexdigest()
    event["sig"] = "0" * 128  # Placeholder signature

    return event


def get_embedding(text: str) -> list:
    """Get embedding from the deployed API."""
    try:
        response = requests.post(
            f"{EMBEDDING_API_URL}/embed",
            json={"text": text},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["embeddings"][0]
    except Exception as e:
        print(f"Embedding API error: {e}")
        return None


def generate_synthetic_data():
    """Generate synthetic channels and posts."""
    OUTPUT_DIR.mkdir(exist_ok=True)

    events = []
    embeddings = []
    event_ids = []

    # Generate user keypairs
    users = [generate_keypair() for _ in range(20)]
    print(f"Generated {len(users)} synthetic users")

    # Create channels (kind 40)
    channels = {}
    for name, about in CHANNEL_NAMES:
        _, pubkey = random.choice(users)
        channel_event = create_event(
            pubkey=pubkey,
            kind=40,
            content=json.dumps({"name": name, "about": about}),
            tags=[]
        )
        events.append(channel_event)
        channels[name] = channel_event["id"]
        print(f"Created channel: {name}")

    # Create posts in channels (kind 42)
    post_count = 0
    for theme, messages in THEMES.items():
        for message in messages:
            _, pubkey = random.choice(users)

            # Pick a relevant channel
            if theme == "meditation":
                channel = "meditation-circle"
            elif theme == "community":
                channel = random.choice(["community-board", "housing-exchange", "carpool-connect"])
            elif theme == "education":
                channel = random.choice(["miu-students", "vedic-science"])
            elif theme == "wellness":
                channel = "wellness-corner"
            else:
                channel = "events-calendar"

            channel_id = channels.get(channel)
            if not channel_id:
                continue

            post_event = create_event(
                pubkey=pubkey,
                kind=42,
                content=message,
                tags=[["e", channel_id, "", "root"]]
            )
            events.append(post_event)

            # Get embedding for this post
            embedding = get_embedding(message)
            if embedding:
                embeddings.append(embedding)
                event_ids.append(post_event["id"])
                post_count += 1
                print(f"Created post {post_count}: {message[:50]}...")

    # Also create some regular notes (kind 1)
    extra_notes = [
        "Beautiful sunrise over the dome this morning. Jai Guru Dev!",
        "Just moved to Fairfield from California. Everyone is so welcoming!",
        "The annual town meeting was productive. Great community engagement.",
        "Finished reading 'Maharishi's Vedic University'. Profound knowledge.",
        "Cooking class at the Raj kitchen was amazing. Learned new recipes.",
        "Group flying feels more coherent lately. Something is shifting.",
        "Spring is here! Gardens are blooming throughout Vedic City.",
        "Gratitude for this unique community. Nowhere else like it.",
    ]

    for note in extra_notes:
        _, pubkey = random.choice(users)
        note_event = create_event(
            pubkey=pubkey,
            kind=1,
            content=note,
            tags=[]
        )
        events.append(note_event)

        embedding = get_embedding(note)
        if embedding:
            embeddings.append(embedding)
            event_ids.append(note_event["id"])
            post_count += 1
            print(f"Created note {post_count}: {note[:50]}...")

    # Save events
    events_path = OUTPUT_DIR / "synthetic_events.json"
    with open(events_path, 'w') as f:
        json.dump(events, f, indent=2)
    print(f"\nSaved {len(events)} events to {events_path}")

    # Save embeddings as NPZ for build_index.py
    if embeddings:
        embeddings_path = OUTPUT_DIR / "embeddings.npz"
        np.savez(
            embeddings_path,
            ids=np.array(event_ids),
            vectors=np.array(embeddings, dtype=np.float32),
            dimensions=384,
            model="all-MiniLM-L6-v2",
            quantize_type="float32"
        )
        print(f"Saved {len(embeddings)} embeddings to {embeddings_path}")

    return events_path, OUTPUT_DIR / "embeddings.npz"


def build_hnsw_index(embeddings_path: Path):
    """Build HNSW index from embeddings."""
    try:
        import hnswlib
    except ImportError:
        print("Installing hnswlib...")
        import subprocess
        subprocess.check_call(['pip', 'install', 'hnswlib'])
        import hnswlib

    # Load embeddings
    data = np.load(embeddings_path, allow_pickle=True)
    ids = data['ids']
    vectors = data['vectors'].astype(np.float32)
    dimensions = int(data['dimensions'])

    print(f"\nBuilding HNSW index for {len(ids)} vectors ({dimensions} dimensions)")

    # Create index
    index = hnswlib.Index(space='cosine', dim=dimensions)
    index.init_index(max_elements=max(len(ids) * 2, 1000), M=16, ef_construction=200)

    # Add vectors with integer labels
    labels = np.arange(len(ids))
    index.add_items(vectors, labels)
    index.set_ef(50)

    # Save index
    index_path = OUTPUT_DIR / "index.bin"
    index.save_index(str(index_path))
    print(f"Saved HNSW index to {index_path}")

    # Save mapping as JSON
    mapping_path = OUTPUT_DIR / "index_mapping.json"
    with open(mapping_path, 'w') as f:
        json.dump({
            'labels': labels.tolist(),
            'ids': ids.tolist()
        }, f)
    print(f"Saved label mapping to {mapping_path}")

    # Create manifest
    manifest = {
        "version": int(time.time()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_vectors": len(ids),
        "dimensions": dimensions,
        "model": "all-MiniLM-L6-v2",
        "quantize_type": "float32",
        "index_size_bytes": index_path.stat().st_size,
        "embeddings_size_bytes": embeddings_path.stat().st_size,
        "latest": {
            "index": "latest/index.bin",
            "index_mapping": "latest/index_mapping.json",
            "embeddings": "latest/embeddings.npz",
            "manifest": "latest/manifest.json"
        }
    }

    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved manifest to {manifest_path}")

    return index_path, mapping_path, manifest_path


def test_search(query: str):
    """Test semantic search with a query."""
    try:
        import hnswlib
    except ImportError:
        print("hnswlib not installed, skipping search test")
        return

    # Get query embedding
    embedding = get_embedding(query)
    if not embedding:
        print("Failed to get query embedding")
        return

    # Load index
    index_path = OUTPUT_DIR / "index.bin"
    mapping_path = OUTPUT_DIR / "index_mapping.json"

    if not index_path.exists():
        print("Index not found")
        return

    index = hnswlib.Index(space='cosine', dim=384)
    index.load_index(str(index_path))
    index.set_ef(50)

    with open(mapping_path) as f:
        mapping = json.load(f)

    # Search
    query_vector = np.array([embedding], dtype=np.float32)
    labels, distances = index.knn_query(query_vector, k=5)

    print(f"\nSearch results for: '{query}'")
    print("-" * 50)

    # Load events to show content
    events_path = OUTPUT_DIR / "synthetic_events.json"
    with open(events_path) as f:
        events = {e["id"]: e for e in json.load(f)}

    for i, (label, distance) in enumerate(zip(labels[0], distances[0])):
        event_id = mapping['ids'][label]
        event = events.get(event_id, {})
        score = 1 - distance
        content = event.get('content', 'N/A')[:80]
        print(f"{i+1}. [score: {score:.3f}] {content}...")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate synthetic Nostr data and build index')
    parser.add_argument('--generate', action='store_true', help='Generate synthetic data')
    parser.add_argument('--build-index', action='store_true', help='Build HNSW index')
    parser.add_argument('--test', type=str, help='Test search with a query')
    parser.add_argument('--all', action='store_true', help='Run all steps')

    args = parser.parse_args()

    if args.all or (not args.generate and not args.build_index and not args.test):
        args.generate = True
        args.build_index = True
        args.test = "meditation experience"

    if args.generate:
        events_path, embeddings_path = generate_synthetic_data()

    if args.build_index:
        embeddings_path = OUTPUT_DIR / "embeddings.npz"
        if embeddings_path.exists():
            build_hnsw_index(embeddings_path)
        else:
            print("No embeddings found. Run with --generate first.")

    if args.test:
        test_search(args.test)
