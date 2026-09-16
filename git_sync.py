"""
Git Synchronization Utility for abapGit.
Writes generated ABAP files into /src/ matching abapGit conventions
and optionally commits and pushes them to the remote Git repository.
"""

import os
import shutil
import subprocess
from typing import Dict, Any


class GitSync:
    def __init__(self, repo_root: str = None):
        if repo_root is None:
            current_dir = os.path.abspath(os.path.dirname(__file__))
            parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
            # If parent directory has .git or .abapgit.xml (monorepo), use parent; else use current directory
            if os.path.exists(os.path.join(parent_dir, ".git")) or os.path.exists(os.path.join(parent_dir, ".abapgit.xml")):
                self.repo_root = parent_dir
            else:
                self.repo_root = current_dir
        else:
            self.repo_root = os.path.abspath(repo_root)

        self.src_dir = os.path.join(self.repo_root, "src")
        try:
            os.makedirs(self.src_dir, exist_ok=True)
        except Exception:
            # Fallback to local src in current directory
            self.src_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), "src")
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

    def _ensure_abap_sync_repo(self) -> str:
        """Maintains an isolated repository containing ONLY src/ and .abapgit.xml for clean abapGit target repos."""
        sync_repo_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), ".abap_sync_repo")
        os.makedirs(sync_repo_path, exist_ok=True)
        sync_git = os.path.join(sync_repo_path, ".git")
        if not os.path.exists(sync_git):
            subprocess.run(["git", "init", "-b", "main"], cwd=sync_repo_path, capture_output=True, text=True)
            subprocess.run(["git", "config", "user.email", "developer@organization.com"], cwd=sync_repo_path, capture_output=True, text=True)
            subprocess.run(["git", "config", "user.name", "DEVELOPER"], cwd=sync_repo_path, capture_output=True, text=True)

        # Sync .abapgit.xml
        abapgit_src = os.path.join(self.repo_root, ".abapgit.xml")
        abapgit_dest = os.path.join(sync_repo_path, ".abapgit.xml")
        if os.path.exists(abapgit_src):
            shutil.copy2(abapgit_src, abapgit_dest)
        elif not os.path.exists(abapgit_dest):
            with open(abapgit_dest, "w", encoding="utf-8") as f:
                f.write('<?xml version="1.0" encoding="utf-8"?>\n<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">\n <asx:values>\n  <DATA>\n   <MASTER_LANGUAGE>E</MASTER_LANGUAGE>\n   <STARTING_FOLDER>/src/</STARTING_FOLDER>\n   <FOLDER_LOGIC>FULL</FOLDER_LOGIC>\n  </DATA>\n </asx:values>\n</asx:abap>\n')

        # Sync README.md
        readme_path = os.path.join(sync_repo_path, "README.md")
        if not os.path.exists(readme_path):
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write("# Clean ABAP Repository\n\nPure ABAP source artifacts managed via abapGit.\n")

        # Sync src/ folder
        sync_src = os.path.join(sync_repo_path, "src")
        if os.path.exists(sync_src):
            shutil.rmtree(sync_src)
        if os.path.exists(self.src_dir):
            shutil.copytree(self.src_dir, sync_src)
        else:
            os.makedirs(sync_src, exist_ok=True)

        return sync_repo_path

    def commit_and_push(self, class_name: str, commit_message: str = "", 
                        target_repo_url: str = "", target_branch: str = "main",
                        git_token: str = "") -> Dict[str, Any]:
        """Commit changes to Git and push to origin or custom target repository & branch."""
        if not commit_message:
            commit_message = f"feat(abap): generate and verify {class_name.upper()} via web portal"
        target_branch = target_branch.strip() or "main"

        try:
            clean_url = target_repo_url.strip() if target_repo_url else ""
            # If a custom target repo is specified (e.g. abap_code.git), use the isolated clean ABAP repo
            if clean_url and "abap_ai" not in clean_url:
                working_dir = self._ensure_abap_sync_repo()
            else:
                working_dir = self.repo_root

            # Stage files
            subprocess.run(["git", "add", "."], cwd=working_dir, check=True, capture_output=True, text=True)

            # Determine push target destination
            push_target = "origin"

            if clean_url:
                if git_token and git_token.strip() and "github.com" in clean_url:
                    token = git_token.strip()
                    if clean_url.startswith("https://"):
                        push_target = clean_url.replace("https://", f"https://{token}@")
                    else:
                        push_target = f"https://{token}@{clean_url}"
                else:
                    subprocess.run(["git", "remote", "set-url", "origin", clean_url], cwd=working_dir, capture_output=True, text=True)
                    push_target = "origin"

            # Check if there are staged changes
            diff_check = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=working_dir)
            if diff_check.returncode == 0:
                push_res = subprocess.run(["git", "push", push_target, target_branch], cwd=working_dir, capture_output=True, text=True)
                pushed_ok = (push_res.returncode == 0)
                err_msg = push_res.stderr[:200] if push_res.stderr else ""
                if git_token:
                    err_msg = err_msg.replace(git_token, "***")
                return {
                    "success": True,
                    "committed": False,
                    "pushed": pushed_ok,
                    "target_repo": clean_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Files in src/ are already up to date. Pushed to {target_branch}." if pushed_ok else f"Files up to date locally. Push to {target_branch} failed: {err_msg}"
                }

            # Commit
            subprocess.run(["git", "commit", "-m", commit_message], cwd=working_dir, check=True, capture_output=True, text=True)

            # Push to designated branch
            push_res = subprocess.run(["git", "push", push_target, target_branch], cwd=working_dir, capture_output=True, text=True)
            if push_res.returncode == 0:
                return {
                    "success": True,
                    "committed": True,
                    "pushed": True,
                    "target_repo": clean_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Successfully committed and pushed {class_name.upper()} to {target_branch}."
                }
            else:
                err_msg = push_res.stderr[:200] if push_res.stderr else ""
                if git_token:
                    err_msg = err_msg.replace(git_token, "***")
                return {
                    "success": True,
                    "committed": True,
                    "pushed": False,
                    "target_repo": clean_url or self.get_git_config().get("repo_url"),
                    "target_branch": target_branch,
                    "message": f"Committed locally. Push to {target_branch} failed: {err_msg}"
                }
        except Exception as e:
            return {"success": False, "message": f"Git operation failed: {str(e)}"}
