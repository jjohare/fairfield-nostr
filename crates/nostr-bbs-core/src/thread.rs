//! NIP-28 forum threading: reply linkage, thread grouping, and page assembly.
//!
//! A board is a kind-40 channel; its posts are kind-42 messages that all anchor
//! to the channel with `["e", <channel_id>, "", "root"]`. A *reply* additionally
//! carries `["e", <parent_id>, "", "reply"]` (NIP-10 marked form) plus a `["p",
//! <parent_author>]` tag. Everything else — arbitrary nesting depth, orphaned
//! replies whose parent has not been fetched yet, posts from other channels
//! mixed into the same buffer — falls out of those two rules.
//!
//! This module is pure: it reads only [`NostrEvent`] fields, performs no I/O,
//! and is shared by the web client, the BBS client, and the workers so all three
//! agree on what a thread *is*. It does not verify signatures — feed it events
//! that [`crate::verify_event_strict`] has already accepted.
//!
//! ```
//! use nostr_bbs_core::thread::{channel_message_tags, group_threads, thread_messages};
//! # use nostr_bbs_core::event::NostrEvent;
//! # fn post(id: &str, at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
//! #     NostrEvent { id: id.into(), pubkey: String::new(), created_at: at,
//! #                  kind: 42, tags, content: String::new(), sig: String::new() }
//! # }
//! let root = post("r1", 100, channel_message_tags("chan", None));
//! let reply = post("a1", 150, channel_message_tags("chan", Some(("r1".into(), "pk".into()))));
//!
//! let threads = group_threads(&[root, reply], "chan");
//! assert_eq!(threads.len(), 1);
//! assert_eq!(threads[0].reply_count, 1);
//! assert_eq!(threads[0].last_activity, 150);
//! ```

use crate::event::NostrEvent;
use std::collections::{HashMap, HashSet};

/// Maximum parent hops walked when resolving a reply to its thread root.
///
/// A malformed or hostile event set can describe a cycle (`a` replies to `b`,
/// `b` replies to `a`); the walk is bounded so resolution always terminates.
/// Threads deeper than this resolve to `None` and surface as orphans rather
/// than hanging the caller.
pub const MAX_PARENT_HOPS: usize = 64;

/// Build the NIP-28 tags for a kind-42 channel message.
///
/// Every message anchors to the channel root (`["e", channel_id, "", "root"]`).
/// A reply additionally references its parent post and that post's author, so
/// clients can thread and notify without a second fetch.
pub fn channel_message_tags(
    channel_id: &str,
    reply_to: Option<(String, String)>,
) -> Vec<Vec<String>> {
    let mut tags = vec![vec![
        "e".to_string(),
        channel_id.to_string(),
        String::new(),
        "root".to_string(),
    ]];
    if let Some((reply_id, reply_author)) = reply_to {
        tags.push(vec![
            "e".to_string(),
            reply_id,
            String::new(),
            "reply".to_string(),
        ]);
        tags.push(vec!["p".to_string(), reply_author]);
    }
    tags
}

/// The root channel id a kind-42 post belongs to — its first `e` tag (NIP-28).
pub fn post_root_channel(ev: &NostrEvent) -> Option<String> {
    ev.tags
        .iter()
        .find(|t| t.first().map(String::as_str) == Some("e"))
        .and_then(|t| t.get(1))
        .cloned()
}

/// The parent post id a kind-42 reply points at — its `reply`-marked `e` tag.
///
/// `None` for a thread root, which anchors to the channel only and carries no
/// reply marker.
pub fn reply_parent(ev: &NostrEvent) -> Option<String> {
    ev.tags
        .iter()
        .find(|t| {
            t.first().map(String::as_str) == Some("e")
                && t.get(3).map(String::as_str) == Some("reply")
        })
        .and_then(|t| t.get(1).cloned())
}

/// Whether a kind-42 post opens a thread in `channel_id`: anchored to that
/// channel and carrying no reply marker.
///
/// Legacy unthreaded posts are roots too, so they render as single-post threads
/// instead of disappearing.
pub fn is_thread_root(ev: &NostrEvent, channel_id: &str) -> bool {
    post_root_channel(ev).as_deref() == Some(channel_id) && reply_parent(ev).is_none()
}

/// One thread in a board: its root post, the replies beneath it, and when it
/// last saw activity.
#[derive(Clone, Debug)]
pub struct ThreadInfo {
    /// The root kind-42 post that opened the thread.
    pub root: NostrEvent,
    /// Number of replies resolving to this root, at any nesting depth.
    pub reply_count: usize,
    /// Newest `created_at` across the root and all its replies.
    pub last_activity: u64,
}

/// The reply-linkage index for one channel: who each reply's parent is, and
/// which posts are thread roots.
///
/// Both [`group_threads`] and [`thread_messages`] build this first; splitting it
/// out lets a caller that needs several projections of the same buffer pay for
/// the index once.
struct Linkage<'a> {
    in_chan: Vec<&'a NostrEvent>,
    root_ids: HashSet<String>,
    parent_of: HashMap<String, String>,
}

impl<'a> Linkage<'a> {
    fn build(posts: &'a [NostrEvent], channel_id: &str) -> Self {
        let in_chan: Vec<&NostrEvent> = posts
            .iter()
            .filter(|p| post_root_channel(p).as_deref() == Some(channel_id))
            .collect();
        let root_ids: HashSet<String> = in_chan
            .iter()
            .filter(|p| reply_parent(p).is_none())
            .map(|p| p.id.clone())
            .collect();
        let parent_of: HashMap<String, String> = in_chan
            .iter()
            .filter_map(|p| reply_parent(p).map(|par| (p.id.clone(), par)))
            .collect();
        Self {
            in_chan,
            root_ids,
            parent_of,
        }
    }

    /// Walk a reply's parent chain up to the thread root it belongs to.
    ///
    /// `None` when the chain leaves the loaded set (an orphan whose root has not
    /// arrived) or exceeds [`MAX_PARENT_HOPS`].
    fn resolve_root(&self, reply_id: &str) -> Option<String> {
        let mut cur = self.parent_of.get(reply_id)?.clone();
        for _ in 0..MAX_PARENT_HOPS {
            if self.root_ids.contains(&cur) {
                return Some(cur);
            }
            let next = self.parent_of.get(&cur)?;
            cur = next.clone();
        }
        None
    }
}

/// Partition a channel's kind-42 posts into threads — each root with its reply
/// count and last-activity time, most recently active first.
///
/// Replies attach to their root by following the `reply`-marked `e` tag upwards,
/// so a reply-to-a-reply still counts against the thread it belongs to. An
/// orphan reply (root not loaded) becomes its own single-post thread rather than
/// vanishing from the board.
pub fn group_threads(posts: &[NostrEvent], channel_id: &str) -> Vec<ThreadInfo> {
    let link = Linkage::build(posts, channel_id);

    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut last: HashMap<String, u64> = HashMap::new();
    for p in &link.in_chan {
        if link.root_ids.contains(&p.id) {
            counts.insert(p.id.clone(), 0);
            last.insert(p.id.clone(), p.created_at);
        }
    }

    let mut orphans: Vec<&NostrEvent> = Vec::new();
    for p in &link.in_chan {
        if link.root_ids.contains(&p.id) {
            continue;
        }
        match link.resolve_root(&p.id) {
            Some(root) => {
                *counts.entry(root.clone()).or_insert(0) += 1;
                last.entry(root)
                    .and_modify(|t| *t = (*t).max(p.created_at))
                    .or_insert(p.created_at);
            }
            None => orphans.push(p),
        }
    }

    let mut out: Vec<ThreadInfo> = link
        .in_chan
        .iter()
        .filter(|p| link.root_ids.contains(&p.id))
        .map(|p| ThreadInfo {
            root: (*p).clone(),
            reply_count: counts.get(&p.id).copied().unwrap_or(0),
            last_activity: last.get(&p.id).copied().unwrap_or(p.created_at),
        })
        .collect();
    for o in orphans {
        out.push(ThreadInfo {
            root: o.clone(),
            reply_count: 0,
            last_activity: o.created_at,
        });
    }
    out.sort_by_key(|t| std::cmp::Reverse(t.last_activity));
    out
}

/// Assemble one thread's page — the root plus every reply resolving to it — in
/// chronological order so the conversation reads top-down.
///
/// The root always leads, even when a re-broadcast reply carries an earlier
/// `created_at`.
pub fn thread_messages(posts: &[NostrEvent], channel_id: &str, root_id: &str) -> Vec<NostrEvent> {
    let link = Linkage::build(posts, channel_id);
    let mut out: Vec<NostrEvent> = link
        .in_chan
        .iter()
        .filter(|p| p.id == root_id || link.resolve_root(&p.id).as_deref() == Some(root_id))
        .map(|p| (*p).clone())
        .collect();
    out.sort_by(|a, b| {
        (a.id != root_id)
            .cmp(&(b.id != root_id))
            .then(a.created_at.cmp(&b.created_at))
    });
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(id: &str, kind: u64, created_at: u64, content: &str, tags: Vec<Vec<&str>>) -> NostrEvent {
        NostrEvent {
            id: id.to_string(),
            pubkey: "pk".to_string(),
            created_at,
            kind,
            tags: tags
                .into_iter()
                .map(|t| t.into_iter().map(String::from).collect())
                .collect(),
            content: content.to_string(),
            sig: String::new(),
        }
    }

    #[test]
    fn channel_message_tags_top_level_anchors_to_root() {
        let tags = channel_message_tags("chan", None);
        assert_eq!(tags, vec![vec!["e", "chan", "", "root"]]);
    }

    #[test]
    fn channel_message_tags_reply_adds_parent_and_author() {
        let tags = channel_message_tags("chan", Some(("parent".into(), "author".into())));
        assert_eq!(
            tags,
            vec![
                vec!["e", "chan", "", "root"],
                vec!["e", "parent", "", "reply"],
                vec!["p", "author"],
            ]
        );
    }

    #[test]
    fn post_root_channel_reads_first_e_tag() {
        let post = ev("R", 42, 10, "hi", vec![vec!["e", "C", "", "root"]]);
        assert_eq!(post_root_channel(&post).as_deref(), Some("C"));
        let untagged = ev("U", 42, 10, "hi", vec![vec!["p", "somebody"]]);
        assert_eq!(post_root_channel(&untagged), None);
    }

    #[test]
    fn reply_parent_reads_reply_marked_e_tag() {
        let root = ev("R", 42, 10, "hi", vec![vec!["e", "C", "", "root"]]);
        assert_eq!(reply_parent(&root), None);
        let reply = ev(
            "A",
            42,
            20,
            "re",
            vec![vec!["e", "C", "", "root"], vec!["e", "R", "", "reply"]],
        );
        assert_eq!(reply_parent(&reply).as_deref(), Some("R"));
    }

    #[test]
    fn is_thread_root_distinguishes_roots_from_replies() {
        let root = ev("R", 42, 10, "hi", vec![vec!["e", "C", "", "root"]]);
        let reply = ev(
            "A",
            42,
            20,
            "re",
            vec![vec!["e", "C", "", "root"], vec!["e", "R", "", "reply"]],
        );
        assert!(is_thread_root(&root, "C"));
        assert!(!is_thread_root(&reply, "C"));
        // A root anchored to a DIFFERENT channel is not a root here.
        assert!(!is_thread_root(&root, "OTHER"));
    }

    #[test]
    fn group_threads_counts_replies_and_tracks_last_activity() {
        let posts = vec![
            ev(
                "R1",
                42,
                100,
                "first thread",
                vec![vec!["e", "C", "", "root"]],
            ),
            ev(
                "A",
                42,
                150,
                "reply to R1",
                vec![vec!["e", "C", "", "root"], vec!["e", "R1", "", "reply"]],
            ),
            ev(
                "B",
                42,
                170,
                "nested reply",
                vec![vec!["e", "C", "", "root"], vec!["e", "A", "", "reply"]],
            ),
            ev(
                "R2",
                42,
                120,
                "second thread",
                vec![vec!["e", "C", "", "root"]],
            ),
        ];
        let threads = group_threads(&posts, "C");
        assert_eq!(threads.len(), 2);
        // R1: 2 replies (A + nested B), last activity 170. Sorted by activity
        // desc so R1 (170) precedes R2 (120).
        assert_eq!(threads[0].root.id, "R1");
        assert_eq!(threads[0].reply_count, 2);
        assert_eq!(threads[0].last_activity, 170);
        assert_eq!(threads[1].root.id, "R2");
        assert_eq!(threads[1].reply_count, 0);
        assert_eq!(threads[1].last_activity, 120);
    }

    #[test]
    fn group_threads_ignores_other_channels_and_promotes_orphans() {
        let posts = vec![
            ev("R1", 42, 100, "here", vec![vec!["e", "C", "", "root"]]),
            ev(
                "X",
                42,
                90,
                "elsewhere",
                vec![vec!["e", "OTHER", "", "root"]],
            ),
            // Orphan reply — its parent P is not loaded, so it becomes its own
            // single-post thread rather than vanishing.
            ev(
                "O",
                42,
                110,
                "orphan",
                vec![vec!["e", "C", "", "root"], vec!["e", "P", "", "reply"]],
            ),
        ];
        let threads = group_threads(&posts, "C");
        assert_eq!(threads.len(), 2); // R1 + orphan O; OTHER-channel X excluded
        assert!(threads.iter().any(|t| t.root.id == "R1"));
        assert!(threads
            .iter()
            .any(|t| t.root.id == "O" && t.reply_count == 0));
    }

    #[test]
    fn thread_messages_returns_root_plus_replies_chronological() {
        let posts = vec![
            ev(
                "B",
                42,
                170,
                "nested",
                vec![vec!["e", "C", "", "root"], vec!["e", "A", "", "reply"]],
            ),
            ev("R1", 42, 100, "root", vec![vec!["e", "C", "", "root"]]),
            ev(
                "A",
                42,
                150,
                "reply",
                vec![vec!["e", "C", "", "root"], vec!["e", "R1", "", "reply"]],
            ),
            ev(
                "R2",
                42,
                120,
                "other thread",
                vec![vec!["e", "C", "", "root"]],
            ),
        ];
        let msgs = thread_messages(&posts, "C", "R1");
        let ids: Vec<&str> = msgs.iter().map(|m| m.id.as_str()).collect();
        // Root R1 first, then A, then nested B (oldest→newest); R2 excluded.
        assert_eq!(ids, vec!["R1", "A", "B"]);
    }

    #[test]
    fn thread_resolution_terminates_on_a_reply_cycle() {
        // A ↔ B reply to each other and neither is a root: the bounded walk must
        // give up and promote both as orphans instead of looping forever.
        let posts = vec![
            ev(
                "A",
                42,
                100,
                "a",
                vec![vec!["e", "C", "", "root"], vec!["e", "B", "", "reply"]],
            ),
            ev(
                "B",
                42,
                110,
                "b",
                vec![vec!["e", "C", "", "root"], vec!["e", "A", "", "reply"]],
            ),
        ];
        let threads = group_threads(&posts, "C");
        assert_eq!(threads.len(), 2);
        assert!(threads.iter().all(|t| t.reply_count == 0));
    }

    #[test]
    fn thread_page_excludes_posts_from_other_channels() {
        let posts = vec![
            ev("R1", 42, 100, "root", vec![vec!["e", "C", "", "root"]]),
            ev(
                "Z",
                42,
                150,
                "same parent id, other channel",
                vec![vec!["e", "OTHER", "", "root"], vec!["e", "R1", "", "reply"]],
            ),
        ];
        let msgs = thread_messages(&posts, "C", "R1");
        let ids: Vec<&str> = msgs.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, vec!["R1"]);
    }
}
