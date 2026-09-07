//! Benchmarks for the NIP-28 forum thread model (`nostr_bbs_core::thread`).
//!
//! These exercise the three operations a board actually performs on every
//! render, over a deterministic synthetic channel of a few hundred kind-42
//! posts:
//!
//! - `thread_tree_build` — [`group_threads`]: partition a channel buffer into
//!   threads, resolving every reply up its parent chain to a root.
//! - `reply_parent_verify` — [`reply_parent`] + [`is_thread_root`] +
//!   parent lookup: parse each post's `reply`-marked `e` tag and confirm the
//!   parent it names is present in the loaded set. This is structural linkage
//!   verification, not signature verification — Schnorr costs live in
//!   `bench_events.rs` and would swamp the tag-parsing signal here.
//! - `thread_page_assemble` — [`thread_messages`]: collect and order one
//!   thread's page for display.
//!
//! The fixture is built from a fixed seed with no RNG dependency, so run-to-run
//! variation reflects code changes rather than a different corpus.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::collections::HashSet;

use nostr_bbs_core::event::{compute_event_id, NostrEvent, UnsignedEvent};
use nostr_bbs_core::thread::{
    channel_message_tags, group_threads, is_thread_root, reply_parent, thread_messages,
};

/// The channel every fixture post is anchored to.
const CHANNEL: &str = "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00";
/// A second channel whose posts share the buffer — the model must filter them.
const OTHER_CHANNEL: &str = "dead0000dead0000dead0000dead0000dead0000dead0000dead0000dead0000";

const ROOTS: usize = 12;
const REPLIES: usize = 300;
const ORPHANS: usize = 8;
const NOISE: usize = 40;

/// Deterministic linear-congruential generator (glibc constants) so the fixture
/// is byte-identical on every run and every machine.
struct Lcg(u64);

impl Lcg {
    fn new(seed: u64) -> Self {
        Self(seed)
    }
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);
        self.0 >> 11
    }
    /// Uniform-enough index in `0..n`.
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

/// Build one kind-42 post with a real NIP-01 event id computed from its content.
fn post(seq: usize, created_at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    let unsigned = UnsignedEvent {
        pubkey: format!("{:064x}", 0xAB00 + (seq % 7)),
        created_at,
        kind: 42,
        tags,
        content: format!("post #{seq} — synthetic forum message body for benchmarking"),
    };
    let id = hex::encode(compute_event_id(&unsigned));
    NostrEvent {
        id,
        pubkey: unsigned.pubkey,
        created_at: unsigned.created_at,
        kind: unsigned.kind,
        tags: unsigned.tags,
        content: unsigned.content,
        sig: String::new(),
    }
}

/// A synthetic board buffer: `ROOTS` threads, `REPLIES` replies distributed over
/// them at varying nesting depth, `ORPHANS` replies whose parent never arrived,
/// and `NOISE` posts belonging to a different channel.
///
/// Returns the buffer plus the id of the busiest root, for the page benchmark.
fn synthetic_channel() -> (Vec<NostrEvent>, String) {
    let mut rng = Lcg::new(0x5EED_1234_ABCD_0001);
    let mut posts: Vec<NostrEvent> = Vec::with_capacity(ROOTS + REPLIES + ORPHANS + NOISE);
    let mut seq = 0usize;

    // Thread roots.
    let mut root_ids: Vec<String> = Vec::with_capacity(ROOTS);
    for i in 0..ROOTS {
        let p = post(
            seq,
            1_700_000_000 + i as u64,
            channel_message_tags(CHANNEL, None),
        );
        root_ids.push(p.id.clone());
        posts.push(p);
        seq += 1;
    }

    // Replies. Each attaches either directly to a root or to an earlier reply in
    // the same thread, producing chains the resolver has to walk.
    let mut thread_members: Vec<Vec<String>> = root_ids.iter().map(|r| vec![r.clone()]).collect();
    let mut busiest = 0usize;
    for i in 0..REPLIES {
        // Skew towards the first few threads so one is clearly the busiest.
        let t = rng.below(ROOTS * 2) % ROOTS;
        let members = &thread_members[t];
        let parent = members[rng.below(members.len())].clone();
        let author = format!("{:064x}", 0xBB00 + rng.below(11));
        let p = post(
            seq,
            1_700_000_100 + i as u64,
            channel_message_tags(CHANNEL, Some((parent, author))),
        );
        thread_members[t].push(p.id.clone());
        if thread_members[t].len() > thread_members[busiest].len() {
            busiest = t;
        }
        posts.push(p);
        seq += 1;
    }

    // Orphans: replies pointing at a parent that is not in the buffer. These
    // force the resolver down its full bounded walk before giving up.
    for i in 0..ORPHANS {
        let missing = format!("{:064x}", 0xF000_0000u64 + i as u64);
        let author = format!("{:064x}", 0xCC00 + i);
        posts.push(post(
            seq,
            1_700_000_500 + i as u64,
            channel_message_tags(CHANNEL, Some((missing, author))),
        ));
        seq += 1;
    }

    // Posts from another channel sharing the buffer.
    for i in 0..NOISE {
        posts.push(post(
            seq,
            1_700_000_600 + i as u64,
            channel_message_tags(OTHER_CHANNEL, None),
        ));
        seq += 1;
    }

    let busiest_root = root_ids[busiest].clone();
    (posts, busiest_root)
}

/// Partition a whole channel buffer into threads (the Boards screen render).
fn bench_thread_tree_build(c: &mut Criterion) {
    let (posts, _) = synthetic_channel();
    c.bench_function("thread_tree_build", |b| {
        b.iter(|| {
            let threads = group_threads(black_box(&posts), black_box(CHANNEL));
            black_box(threads.len())
        });
    });
}

/// Parse every post's reply linkage and confirm the parent it names is loaded.
fn bench_reply_parent_verify(c: &mut Criterion) {
    let (posts, _) = synthetic_channel();
    let ids: HashSet<&str> = posts.iter().map(|p| p.id.as_str()).collect();
    c.bench_function("reply_parent_verify", |b| {
        b.iter(|| {
            let mut roots = 0usize;
            let mut linked = 0usize;
            let mut orphaned = 0usize;
            for p in black_box(&posts) {
                match reply_parent(p) {
                    None => {
                        if is_thread_root(p, black_box(CHANNEL)) {
                            roots += 1;
                        }
                    }
                    Some(parent) => {
                        if ids.contains(parent.as_str()) {
                            linked += 1;
                        } else {
                            orphaned += 1;
                        }
                    }
                }
            }
            black_box((roots, linked, orphaned))
        });
    });
}

/// Assemble one thread's page — root plus every descendant reply, ordered.
fn bench_thread_page_assemble(c: &mut Criterion) {
    let (posts, busiest_root) = synthetic_channel();
    c.bench_function("thread_page_assemble", |b| {
        b.iter(|| {
            let page = thread_messages(
                black_box(&posts),
                black_box(CHANNEL),
                black_box(busiest_root.as_str()),
            );
            black_box(page.len())
        });
    });
}

criterion_group!(
    benches,
    bench_thread_tree_build,
    bench_reply_parent_verify,
    bench_thread_page_assemble,
);
criterion_main!(benches);
