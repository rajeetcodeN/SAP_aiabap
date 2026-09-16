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

    def write_object_files(self, object_name: str, files: list) -> Dict[str, Any]:
        """Write any abapGit-structured files to src/."""
        try:
            written = []
            for f in files:
                path = os.path.join(self.src_dir, f['name'])
                with open(path, 'w', encoding='utf-8') as fh:
                    fh.write(f['content'])
                written.append(path)
            return {
                'success': True,
                'files_written': written,
                'message': f'Saved {len(written)} artifact(s) to src/ directory.'
            }
        except Exception as e:
            return {'success': False, 'message': f'Failed to write files: {str(e)}'}

    def get_git_config(self) -> Dict[str, Any]:
        """Returns the active origin remote URL and current branch."""
        try:
            remote_res = subprocess.run(["git", "remote", "get-url", "origin"], cwd=self.repo_root, capture_output=True, text=True)
            url = remote_res.stdout.strip() if remote_res.returncode == 0 else ""
            if "rajeetcodeN" in url:
                url = url.replace("rajeetcodeN", "organization")
            branch_res = subprocess.run(["git", "branch", "--show-current"], cwd=self.repo_root, capture_output=True, text=True)
            branch = branch_res.stdout.strip() if branch_res.returncode == 0 else "main"
            return {"repo_url": url, "branch": branch or "main"}
        except Exception:
            return {"repo_url": "https://github.com/organization/abap_ai.git", "branch": "main"}

    def commit_and_push(self, class_name: str, commit_message: str = "", 
                        target_repo_url: str = "", target_branch: str = "main") -> Dict[str, Any]:
        """Commit changes to Git and push to origin or custom target repository & branch."""
        if not commit_message:
            commit_message = f"feat(abap): generate and verify {class_name.upper()} via web portal"
        target_branch = target_branch.strip() or "main"

        try:
            # Update remote origin URL if a custom repository is specified (and not a sanitized placeholder)
            if target_repo_url and target_repo_url.strip() and "organization" not in target_repo_url:
                clean_url = target_repo_url.strip()
                subprocess.run(["git", "remote", "set-url", "origin", clean_url], cwd=self.repo_root, capture_output=True, text=True)

            # Stage files in src
            subprocess.run(["git", "add", "src/"], cwd=self.repo_root, check=True, capture_output=True, text=True)

            # Check if there are staged changes
            diff_check = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=self.repo_root)
            if diff_check.returncode == 0:
                push_res = subprocess.run(["git", "push", "origin", target_branch], cwd=self.repo_root, capture_output=True, text=True)
                return {
                    "success": True,
                    "committed": False,
                    "pushed": push_res.returncode == 0,
                    "target_repo": target_repo_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Files in src/ are already up to date. Pushed to origin/{target_branch}."
                }

            # Commit
            subprocess.run(["git", "commit", "-m", commit_message], cwd=self.repo_root, check=True, capture_output=True, text=True)

            # Push to designated branch
            push_res = subprocess.run(["git", "push", "origin", target_branch], cwd=self.repo_root, capture_output=True, text=True)
            if push_res.returncode == 0:
                return {
                    "success": True,
                    "committed": True,
                    "pushed": True,
                    "target_repo": target_repo_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Successfully committed and pushed {class_name.upper()} to origin/{target_branch}."
                }
            else:
                return {
                    "success": True,
                    "committed": True,
                    "pushed": False,
                    "target_repo": target_repo_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Committed locally. Push to origin/{target_branch} failed: {push_res.stderr[:200]}"
                }
        except Exception as e:
            return {"success": False, "message": f"Git operation failed: {str(e)}"}
