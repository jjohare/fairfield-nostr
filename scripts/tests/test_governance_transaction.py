"""Execute the production D1 projection SQL against SQLite, including races."""
import re
import sqlite3
import unittest
from pathlib import Path
SOURCE = Path(__file__).resolve().parents[2] / 'crates/nostr-bbs-relay-worker/src/relay_do/receipts.rs'
def sql(name):
    return re.search(r'const '+name+r': &str = r#"(.*?)"#;',SOURCE.read_text(),re.S)[1]
class ProjectionTransaction(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.executescript('''PRAGMA foreign_keys=ON;
        CREATE TABLE broker_cases(id TEXT PRIMARY KEY,state TEXT,nostr_event_id TEXT,assigned_to TEXT,updated_at INTEGER);
        CREATE TABLE broker_decisions(decision_id TEXT PRIMARY KEY,case_id TEXT REFERENCES broker_cases(id),outcome TEXT,outcome_detail TEXT,broker_pubkey TEXT,reasoning TEXT,prior_decision_id TEXT,decided_at INTEGER);
        CREATE TABLE governance_receipts(event_id TEXT PRIMARY KEY,case_id TEXT,request_event_id TEXT,stage TEXT,projected_at INTEGER,decision_id TEXT,stage_error TEXT);
        INSERT INTO broker_cases VALUES('case','open','request',NULL,0);
        INSERT INTO governance_receipts VALUES('event','case','request','relay-accepted',NULL,NULL,NULL);''')
    def commit(self):
        with self.db:
            counts=[]
            for name,args in [
                ('PROJECTION_DECISION_SQL',('decision','case','approve',None,'broker','reviewed',None,10,'open','request','event')),
                ('PROJECTION_CASE_SQL',('decided','broker',10,'case')),
                ('PROJECTION_RECEIPT_SQL',('projection-committed',10,'decision','event'))]:
                self.db.execute(sql(name),args)
                counts.append(self.db.execute('SELECT changes()').fetchone()[0])
            return counts
    def test_first_commit_then_duplicate_is_noop(self):
        self.assertEqual(self.commit(),[1,1,1]);self.assertEqual(self.commit(),[0,0,0])
        self.assertEqual(self.db.execute('SELECT count(*) FROM broker_decisions').fetchone()[0],1)
    def test_changed_case_request_state_or_receipt_is_noop(self):
        for mutation in ["UPDATE broker_cases SET state='decided'","UPDATE broker_cases SET nostr_event_id='other'","DELETE FROM broker_cases","DELETE FROM governance_receipts","UPDATE governance_receipts SET request_event_id='other'","UPDATE governance_receipts SET stage='projection-committed'","INSERT INTO broker_decisions VALUES('other','case','delegate',NULL,'b','',NULL,9)"]:
            with self.subTest(mutation=mutation):
                self.setUp();self.db.execute(mutation);self.db.commit()
                before=self.db.execute('SELECT * FROM broker_cases').fetchall()
                self.assertEqual(self.commit(),[0,0,0]);self.assertEqual(self.db.execute('SELECT * FROM broker_cases').fetchall(),before)
                self.assertEqual(self.db.execute("SELECT count(*) FROM broker_decisions WHERE decision_id='decision'").fetchone()[0],0)
    def test_receipt_failure_rolls_back_case_and_decision(self):
        self.db.execute("CREATE TRIGGER receipt_failure BEFORE UPDATE ON governance_receipts BEGIN SELECT RAISE(ABORT,'injected'); END")
        with self.assertRaises(sqlite3.IntegrityError):self.commit()
        self.assertEqual(self.db.execute('SELECT count(*) FROM broker_decisions').fetchone()[0],0)
        self.assertEqual(self.db.execute('SELECT state FROM broker_cases').fetchone()[0],'open')
if __name__=='__main__':unittest.main()
