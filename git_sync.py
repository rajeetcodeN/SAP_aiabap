"""
Git Synchronization Utility for abapGit.
Writes generated ABAP files into /src/ matching abapGit conventions
and optionally commits and pushes them to the remote Git repository.
"""

import os
import subprocess
from typing import Dict, Any


class GitSync:
    def __init__(self, repo_root: str = None):
        if repo_root is None:
            # Default to parent directory of web-app
            self.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        else:
            self.repo_root = os.path.abspath(repo_root)
        self.src_dir = os.path.join(self.repo_root, "src")
        os.makedirs(self.src_dir, exist_ok=True)

    def write_class_files(self, class_name: str, class_code: str, 
                           test_code: str, xml_code: str) -> Dict[str, Any]:
        """Write the 3 abapGit artifacts into /src/."""
        lower_name = class_name.lower()
        class_file = os.path.join(self.src_dir, f"{lower_name}.clas.abap")
        test_file = os.path.join(self.src_dir, f"{lower_name}.clas.locals_imp.abap")
        xml_file = os.path.join(self.src_dir, f"{lower_name}.clas.xml")

        try:
            with open(class_file, "w", encoding="utf-8") as f:
                f.write(class_code)
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(test_code)
            with open(xml_file, "w", encoding="utf-8") as f:
                f.write(xml_code)

            return {
                "success": True,
                "files_written": [class_file, test_file, xml_file],
                "message": f"Saved {class_name.upper()} artifacts to src/ directory."
            }
        except Exception as e:
            return {"success": False, "message": f"Failed to write files: {str(e)}"}

    def commit_and_push(self, class_name: str, commit_message: str = "") -> Dict[str, Any]:
        """Commit changes to Git and push to origin."""
        if not commit_message:
            commit_message = f"feat(abap): generate and verify {class_name.upper()} via web portal"

        try:
            # Stage files in src
            subprocess.run(["git", "add", "src/"], cwd=self.repo_root, check=True, capture_output=True, text=True)

            # Check if there are staged changes
            diff_check = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=self.repo_root)
            if diff_check.returncode == 0:
                return {
                    "success": True,
                    "committed": False,
                    "message": "No new changes detected; files in src/ are already up to date."
                }

            # Commit
            subprocess.run(["git", "commit", "-m", commit_message], cwd=self.repo_root, check=True, capture_output=True, text=True)

            # Push
            push_res = subprocess.run(["git", "push", "origin", "main"], cwd=self.repo_root, capture_output=True, text=True)
            if push_res.returncode == 0:
                return {
                    "success": True,
                    "committed": True,
                    "pushed": True,
                    "message": f"Successfully committed and pushed {class_name.upper()} to GitHub origin/main."
                }
            else:
                return {
                    "success": True,
                    "committed": True,
                    "pushed": False,
                    "message": f"Committed locally. Push failed or remote not reachable: {push_res.stderr[:200]}"
                }
        except Exception as e:
            return {"success": False, "message": f"Git operation error: {str(e)}"}
