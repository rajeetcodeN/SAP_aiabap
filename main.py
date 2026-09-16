"""
FastAPI Backend for SAP Clean ABAP Portal.
Exposes REST endpoints for code generation, in-memory syntax verification,
ABAP Unit testing, Data Dictionary activation, and abapGit synchronization.
Serves compiled React frontend static assets for unified single-container deployment.
"""

import os
import sys
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Load environment variables from .env
def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k:
                        os.environ[k] = v
_load_env()

from sap_adt_client import SapAdtClient
from abap_generator import AbapGenerator
from git_sync import GitSync

app = FastAPI(
    title="SAP Clean ABAP Generator API",
    description="REST API for autonomous ABAP code generation and SAP DEV ADT integration",
    version="2.0.0"
)

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Clients
adt_client = SapAdtClient()
generator = AbapGenerator()
git_sync = GitSync()


# -------------------------------------------------------------
# Request & Response Data Models
# -------------------------------------------------------------
class ClarifyRequest(BaseModel):
    requirement: str
    object_type: str = "class"
    class_name: str = ""

class GenerateRequest(BaseModel):
    requirement: str
    class_name: str = "ZCL_ORDER_DISCOUNT"
    package_name: str = "$TMP"
    tables: str = "VBAK, VBAP"
    object_type: str = "class"
    test_scenarios: str = ""
    clarification_answers: Dict[str, str] = {}

class SyntaxCheckRequest(BaseModel):
    class_name: str
    source_code: str

class UnitTestRequest(BaseModel):
    class_name: str

class AtcCheckRequest(BaseModel):
    object_name: str
    object_type: str = "CLAS"

class ActivateRequest(BaseModel):
    class_name: str
    transport_id: str = ""
    auto_release: bool = False

class GitPushRequest(BaseModel):
    class_name: str
    class_code: str
    test_code: str = ""
    xml_code: str = ""
    files: list = []
    target_repo_url: str = ""
    target_branch: str = "main"

class RefineRequest(BaseModel):
    prompt: str
    class_name: str
    package_name: str = "$TMP"
    tables: str = "VBAK, VBAP"
    object_type: str = "class"
    test_scenarios: str = ""
    clarification_answers: Dict[str, str] = {}

class CreateTransportRequest(BaseModel):
    description: str
    target_system: str = ""

class ReleaseTransportRequest(BaseModel):
    transport_id: str

class WriteSourceRequest(BaseModel):
    class_name: str
    source_code: str

class AbapGitPullRequest(BaseModel):
    repo_url: str = ""
    package: str = "$TMP"

class ProgramWriteRequest(BaseModel):
    program_name: str
    source_code: str

class TightLoopRequest(BaseModel):
    requirement: str
    class_name: str = "ZCL_ORDER_DISCOUNT"
    package_name: str = "$TMP"
    object_type: str = "class"
    tables: str = "VBAK, VBAP"
    test_scenarios: str = ""
    clarification_answers: Dict[str, str] = {}
    target_repo_url: str = ""
    target_branch: str = "main"
    max_retries: int = 3

class SapConfigRequest(BaseModel):
    url: Optional[str] = None
    client: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    offline_mode: Optional[bool] = None

class GitConfigUpdateRequest(BaseModel):
    repo_url: str
    branch: str = "main"


# -------------------------------------------------------------
# REST API Endpoints
# -------------------------------------------------------------
@app.get("/api/status")
def get_system_status():
    """Returns SAP DEV connection telemetry and active mode."""
    ping_res = adt_client.ping()
    abapgit_res = adt_client.check_abapgit_installed()
    return {
        "status": "online",
        "sap_connection": ping_res,
        "ai_provider": "gemini" if os.getenv("GEMINI_API_KEY") else ("claude" if os.getenv("ANTHROPIC_API_KEY") else "synthesizer"),
        "abapgit_installed": abapgit_res.get("installed", False)
    }

@app.post("/api/orchestrate/clarify")
def clarify_requirement(req: ClarifyRequest):
    """Orchestrator Stage 1: Disambiguate requirements, formulate edge cases and architectural questions."""
    if not req.requirement.strip():
        raise HTTPException(status_code=400, detail="Requirement text cannot be empty.")
    return generator.analyze_and_clarify(req.requirement, req.object_type, req.class_name)

@app.post("/api/generate")
def generate_abap(req: GenerateRequest):
    """Generates Clean ABAP artifacts, runs syntax check, unit tests, and ATC analysis."""
    if not req.requirement.strip():
        raise HTTPException(status_code=400, detail="Requirement text cannot be empty.")

    # 1. Synthesize Clean ABAP code
    gen_res = generator.generate(
        requirement=req.requirement,
        class_name=req.class_name,
        package_name=req.package_name,
        tables=req.tables,
        object_type=req.object_type,
        test_scenarios=req.test_scenarios,
        clarification_answers=req.clarification_answers
    )

    # 2. In-memory syntax check
    syntax_res = adt_client.check_syntax(req.class_name, gen_res.get("class_code", ""))

    # 3. ABAP Unit tests
    test_res = adt_client.run_unit_tests(req.class_name)

    # 4. ATC static analysis
    atc_type_map = {"class": "CLAS", "report": "PROG", "interface": "INTF",
                    "function_module": "FUGR", "cds_view": "DDLS", "badi": "CLAS"}
    atc_res = adt_client.run_atc_check(req.class_name, atc_type_map.get(req.object_type, "CLAS"))

    return {
        "class_name": req.class_name.upper(),
        "package_name": req.package_name.upper(),
        "object_type": req.object_type,
        "class_code": gen_res.get("class_code", ""),
        "test_code": gen_res.get("test_code", ""),
        "xml_code": gen_res.get("xml_code", ""),
        "files": gen_res.get("files", []),
        "explanation": gen_res.get("explanation", ""),
        "syntax": syntax_res,
        "unit_tests": test_res,
        "atc": atc_res,
        "state": "INACTIVE"
    }

@app.post("/api/refine")
def refine_abap(req: RefineRequest):
    """Refines existing ABAP code based on a conversational prompt."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Refinement prompt cannot be empty.")

    refined_res = generator.generate(
        requirement=f"{req.prompt} (Refining existing class {req.class_name})",
        class_name=req.class_name,
        package_name=req.package_name,
        tables=req.tables,
        object_type=req.object_type,
        test_scenarios=req.test_scenarios
    )

    syntax_res = adt_client.check_syntax(req.class_name, refined_res.get("class_code", ""))
    test_res = adt_client.run_unit_tests(req.class_name)
    atc_res = adt_client.run_atc_check(req.class_name)

    return {
        "class_name": req.class_name.upper(),
        "package_name": req.package_name.upper(),
        "object_type": req.object_type,
        "class_code": refined_res.get("class_code", ""),
        "test_code": refined_res.get("test_code", ""),
        "xml_code": refined_res.get("xml_code", ""),
        "files": refined_res.get("files", []),
        "explanation": f"Updated {req.class_name.upper()} based on prompt: '{req.prompt}'.",
        "syntax": syntax_res,
        "unit_tests": test_res,
        "atc": atc_res,
        "state": "INACTIVE"
    }

@app.post("/api/syntax-check")
def check_syntax(req: SyntaxCheckRequest):
    """Runs on-demand in-memory syntax check against /sap/bc/adt/syntaxcheck."""
    return adt_client.check_syntax(req.class_name, req.source_code)

@app.post("/api/unit-tests")
def run_unit_tests(req: UnitTestRequest):
    """Runs on-demand ABAP Unit test execution on /sap/bc/adt/abapunit/testruns."""
    return adt_client.run_unit_tests(req.class_name)

@app.post("/api/atc-check")
def run_atc_check(req: AtcCheckRequest):
    """Runs ATC static analysis via /sap/bc/adt/atc/runs."""
    return adt_client.run_atc_check(req.object_name, req.object_type)

@app.post("/api/activate")
def activate_class(req: ActivateRequest):
    """Activates the class in SAP DEV Data Dictionary via /sap/bc/adt/activation."""
    return adt_client.activate_class(req.class_name, req.transport_id, req.auto_release)

@app.get("/api/sap/config")
def get_sap_config():
    """Returns current SAP connection parameters and mode."""
    return {
        "url": adt_client.url,
        "client": adt_client.client,
        "user": adt_client.user,
        "has_password": bool(adt_client.password),
        "offline_mode": adt_client.offline_mode,
        "mode": "offline_simulation" if adt_client.offline_mode else "live"
    }

@app.post("/api/sap/connect")
def update_sap_connection(req: SapConfigRequest):
    """Updates and validates SAP connection credentials and mode."""
    if req.url is not None:
        adt_client.url = req.url.rstrip("/")
    if req.client is not None:
        adt_client.client = req.client
    if req.user is not None:
        adt_client.user = req.user
    if req.password is not None and req.password.strip():
        adt_client.password = req.password
        adt_client.session.auth = (adt_client.user, adt_client.password)
    if req.offline_mode is not None:
        adt_client.offline_mode = req.offline_mode
    elif not adt_client.password:
        adt_client.offline_mode = True

    ping_res = adt_client.ping()
    return {
        "success": ping_res.get("success", False),
        "ping": ping_res,
        "config": {
            "url": adt_client.url,
            "client": adt_client.client,
            "user": adt_client.user,
            "offline_mode": adt_client.offline_mode,
            "mode": "offline_simulation" if adt_client.offline_mode else "live"
        }
    }

@app.post("/api/sap/ping")
def ping_sap():
    """Directly tests SAP ADT connectivity."""
    return adt_client.ping()

@app.get("/api/git/config")
def get_git_config():
    """Returns current active Git repository destination."""
    return git_sync.get_git_config()

@app.post("/api/git/config")
def update_git_config(req: GitConfigUpdateRequest):
    """Updates target Git remote repository URL and branch."""
    clean_url = req.repo_url.strip()
    if "rajeetcodeN" in clean_url:
        clean_url = clean_url.replace("rajeetcodeN", "organization")
    if clean_url and "organization" not in clean_url:
        import subprocess
        subprocess.run(["git", "remote", "set-url", "origin", clean_url], cwd=git_sync.repo_root, capture_output=True, text=True)
    return {"success": True, "repo_url": clean_url, "branch": req.branch}

@app.post("/api/git-push")
def push_to_git(req: GitPushRequest):
    """Serializes artifacts to src/ matching abapGit schema and pushes to designated GitHub repo & branch."""
    if req.files:
        write_res = git_sync.write_object_files(req.class_name, req.files)
    else:
        write_res = git_sync.write_class_files(
            class_name=req.class_name,
            class_code=req.class_code,
            test_code=req.test_code,
            xml_code=req.xml_code
        )
    if not write_res.get("success"):
        raise HTTPException(status_code=500, detail=write_res.get("message"))

    push_res = git_sync.commit_and_push(
        class_name=req.class_name,
        target_repo_url=req.target_repo_url,
        target_branch=req.target_branch
    )
    return push_res

# --- Transport Management --- #

@app.post("/api/transport/create")
def create_transport(req: CreateTransportRequest):
    """Creates a new workbench transport request via /sap/bc/adt/cts/transportrequests."""
    return adt_client.create_transport(req.description, req.target_system)

@app.get("/api/transport/list")
def list_transports():
    """Lists open transport requests for the current user."""
    return adt_client.list_transports()

@app.post("/api/transport/release")
def release_transport(req: ReleaseTransportRequest):
    """Releases a transport request via /sap/bc/adt/cts/transportrequests/{id}/newreleasejobs."""
    return adt_client.release_transport(req.transport_id)

# --- Direct ADT Write & abapGit Pull --- #

@app.post("/api/write-to-sap")
def write_to_sap(req: WriteSourceRequest):
    """Direct ADT write: push source code into SAP class buffer without Git round-trip."""
    return adt_client.write_class_source(req.class_name, req.source_code)

@app.get("/api/abapgit/status")
def abapgit_status():
    """Check if abapGit (ZABAPGIT) is installed in SAP DEV."""
    return adt_client.check_abapgit_installed()

@app.post("/api/abapgit/pull")
def abapgit_pull(req: AbapGitPullRequest):
    """Trigger abapGit pull from GitHub into SAP DEV."""
    return adt_client.trigger_abapgit_pull(req.repo_url, req.package)

# --- Classical SE38 Programs --- #

@app.get("/api/program/{program_name}")
def get_program_source(program_name: str):
    """Retrieve SE38 program source code from SAP DEV."""
    return adt_client.get_program_source(program_name)

@app.post("/api/program/write")
def write_program_source(req: ProgramWriteRequest):
    """Write source code to SE38 program buffer in SAP DEV."""
    return adt_client.write_program_source(req.program_name, req.source_code)

# --- Tight-Loop Orchestrator: Generate -> Commit -> SAP Sync -> Auto-Verify & Self-Heal --- #

@app.post("/api/orchestrate/tight-loop")
def execute_tight_loop(req: TightLoopRequest):
    """
    Executes the automated tight loop:
    Generate -> Commit to Git -> Programmatic SAP Sync -> Compile & Test -> Self-Heal Retry Loop.
    """
    if not req.requirement.strip():
        raise HTTPException(status_code=400, detail="Requirement text cannot be empty.")

    audit_trail = []
    current_requirement = req.requirement
    error_feedback = ""
    final_result = None

    for iteration in range(1, req.max_retries + 1):
        step_log = {"iteration": iteration}

        # 1. Generate abapGit files (with compiler feedback if retry)
        gen_res = generator.generate(
            requirement=current_requirement,
            class_name=req.class_name,
            package_name=req.package_name,
            tables=req.tables,
            object_type=req.object_type,
            test_scenarios=req.test_scenarios,
            clarification_answers=req.clarification_answers,
            error_feedback=error_feedback
        )
        step_log["generated"] = {
            "class_name": req.class_name,
            "files": gen_res.get("files", []),
            "class_code_len": len(gen_res.get("class_code", ""))
        }

        # 2. Serialize and Commit to Git
        if gen_res.get("files"):
            git_write = git_sync.write_object_files(req.class_name, gen_res["files"])
        else:
            git_write = git_sync.write_class_files(
                class_name=req.class_name,
                class_code=gen_res.get("class_code", ""),
                test_code=gen_res.get("test_code", ""),
                xml_code=gen_res.get("xml_code", "")
            )

        git_push = git_sync.commit_and_push(
            class_name=req.class_name,
            commit_message=f"feat(abap): tight-loop iteration {iteration} for {req.class_name.upper()}",
            target_repo_url=req.target_repo_url,
            target_branch=req.target_branch
        )
        step_log["git"] = {"write": git_write, "push": git_push}

        # 3. Programmatic sync to SAP (abapGit pull + ADT buffer sync)
        sync_res = adt_client.sync_object_to_sap(
            object_name=req.class_name,
            object_type=req.object_type,
            source_code=gen_res.get("class_code", ""),
            test_code=gen_res.get("test_code", ""),
            repo_url=req.target_repo_url,
            package=req.package_name
        )
        step_log["sap_sync"] = sync_res

        # 4. Automated Verification: Syntax check
        syntax_res = adt_client.check_syntax(req.class_name, gen_res.get("class_code", ""))
        step_log["syntax"] = syntax_res

        # 5. Automated Verification: ABAP Unit tests
        test_res = adt_client.run_unit_tests(req.class_name, gen_res.get("test_code", ""))
        step_log["unit_tests"] = test_res

        # 6. ATC Static Analysis
        atc_type_map = {"class": "CLAS", "report": "PROG", "interface": "INTF"}
        atc_res = adt_client.run_atc_check(req.class_name, atc_type_map.get(req.object_type, "CLAS"))
        step_log["atc"] = atc_res

        audit_trail.append(step_log)
        final_result = {
            "success": True,
            "completed_iteration": iteration,
            "class_name": req.class_name.upper(),
            "package_name": req.package_name.upper(),
            "object_type": req.object_type,
            "class_code": gen_res.get("class_code", ""),
            "test_code": gen_res.get("test_code", ""),
            "xml_code": gen_res.get("xml_code", ""),
            "files": gen_res.get("files", []),
            "syntax": syntax_res,
            "unit_tests": test_res,
            "atc": atc_res,
            "audit_trail": audit_trail,
            "message": f"Tight loop succeeded on iteration {iteration}."
        }

        # Check for errors that require self-healing retry
        has_syntax_errors = syntax_res.get("has_errors", False)
        tests_failed = test_res.get("failed", 0) > 0

        if not has_syntax_errors and not tests_failed:
            step_log["status"] = "PASSED"
            break
        else:
            step_log["status"] = "FAILED"
            # Build compiler & test failure feedback for next iteration
            feedback_parts = []
            if has_syntax_errors:
                err_msgs = [f"Line {e.get('line')}: {e.get('message')}" for e in syntax_res.get("errors", [])]
                feedback_parts.append("Compiler Syntax Errors:\n" + "\n".join(err_msgs))
            if tests_failed:
                failed_cases = [f"{t.get('name')}: {t.get('failure_message', 'Assertion failed')}" for t in test_res.get("test_cases", []) if t.get("status") == "FAILED"]
                feedback_parts.append("Unit Test Failures:\n" + "\n".join(failed_cases))
            error_feedback = "\n\n".join(feedback_parts)
            step_log["error_feedback"] = error_feedback

    if final_result and audit_trail[-1].get("status") == "FAILED":
        final_result["success"] = False
        final_result["message"] = f"Tight loop stopped after {req.max_retries} iterations with unresolved errors."

    return final_result


# -------------------------------------------------------------
# Static Asset Serving (Compiled React Frontend)
# -------------------------------------------------------------
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    def frontend_placeholder():
        return {
            "message": "SAP Clean ABAP Generator API is running.",
            "documentation": "/docs",
            "frontend_status": "Build frontend in web-app/frontend to serve static UI."
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

