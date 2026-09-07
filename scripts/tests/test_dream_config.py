"""An evaluator's piped output must not hide a failed command."""
import json
from pathlib import Path
import subprocess
import unittest
class DreamEvaluatorStatus(unittest.TestCase):
    def test_all_build_and_evaluation_pipelines_propagate_failure(self):
        config=json.loads((Path(__file__).resolve().parents[2]/'dream.config.json').read_text())
        entries={'build':config['buildStep'],**config['evaluatorEntrypoints']}
        for name,entry in entries.items():
            with self.subTest(entrypoint=name):
                command=entry if isinstance(entry,str) else entry['cmd']
                # Exercise each configured pipeline, replacing the executable
                # with a deterministic failure, without running any real build.
                self.assertIn('cargo ',command)
                result=subprocess.run(command.replace('cargo ','false '),shell=True,capture_output=True,text=True,timeout=5)
                self.assertNotEqual(result.returncode,0)
if __name__=='__main__':unittest.main()
