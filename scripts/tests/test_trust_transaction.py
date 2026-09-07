"""Run the production demotion SQL against SQLite, including successful no-ops."""
import pathlib
import re
import sqlite3
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[2] / 'crates/nostr-bbs-relay-worker/src/trust_sweep.rs'

def statement(name):
    text = SOURCE.read_text()
    return re.search(r'const ' + name + r': &str = r#"(.*?)"#;', text, re.S)[1]

class TrustTransactionTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript('''
          CREATE TABLE whitelist(pubkey TEXT PRIMARY KEY, trust_level INTEGER,
            trust_level_updated_at REAL, is_admin INTEGER, last_active_at REAL,
            days_active INTEGER, posts_read INTEGER, posts_created INTEGER,
            mod_actions_against INTEGER);
          CREATE TABLE admin_log(actor_pubkey TEXT, action TEXT, target_pubkey TEXT,
            previous_value TEXT, new_value TEXT, reason TEXT, created_at INTEGER);
          INSERT INTO whitelist VALUES ('key', 1, NULL, 0, 100, 0, 0, 0, 0);
        ''')
    def tearDown(self):
        self.db.close()
    def commit(self):
        with self.db:
            changes = self.db.execute(statement('DEMOTION_UPDATE_SQL'),
                (0, 1000, 'key', 1, 0, 100, None, 0, 0, 0, 0)).rowcount
            audit = self.db.execute(statement('DEMOTION_AUDIT_SQL'),
                ('system', 'trust_level_change', 'key', '1', '0', 'auto-demotion (hysteresis)', 1000)).rowcount
        return changes, audit
    def test_transition_and_audit_commit_once(self):
        self.assertEqual(self.commit(), (1, 1))
        self.assertEqual(self.commit(), (0, 0))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM admin_log').fetchone()[0], 1)
    def test_every_concurrent_policy_input_change_prevents_audit(self):
        changes = {'trust_level': 3, 'is_admin': 1, 'last_active_at': 999,
            'trust_level_updated_at': 999, 'days_active': 20, 'posts_read': 100,
            'posts_created': 20, 'mod_actions_against': 1}
        for field, value in changes.items():
            with self.subTest(field=field):
                self.db.execute('SAVEPOINT scenario')
                self.db.execute(f'UPDATE whitelist SET {field} = ?', (value,))
                self.assertEqual(self.commit(), (0, 0))
                self.assertEqual(self.db.execute('SELECT COUNT(*) FROM admin_log').fetchone()[0], 0)
                # Reset the snapshot for the next independently mutated input.
                self.db.execute('UPDATE whitelist SET trust_level=1, trust_level_updated_at=NULL, is_admin=0, last_active_at=100, days_active=0, posts_read=0, posts_created=0, mod_actions_against=0')
                self.db.commit()
    def test_missing_row_does_not_create_audit(self):
        self.db.execute('DELETE FROM whitelist')
        self.assertEqual(self.commit(), (0, 0))
    def test_audit_sql_failure_rolls_back_state(self):
        self.db.executescript("CREATE TRIGGER reject_audit BEFORE INSERT ON admin_log BEGIN SELECT RAISE(ABORT, 'injected audit failure'); END;")
        with self.assertRaises(sqlite3.IntegrityError): self.commit()
        self.assertEqual(self.db.execute('SELECT trust_level FROM whitelist').fetchone()[0], 1)
    def test_nullable_snapshot_uses_null_safe_comparison(self):
        self.db.execute('UPDATE whitelist SET last_active_at=NULL')
        self.assertEqual(self.commit(), (0, 0))

if __name__ == '__main__': unittest.main()
