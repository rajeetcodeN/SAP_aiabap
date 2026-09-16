"""
SAP Clean ABAP Generator Web Portal
Streamlit web application featuring:
1. ABAP Generator Workbench (Voice/Text Intake, Chat Refinement, Live Code Editor)
2. Dedicated Test & Syntax Inspector (Detailed test execution, diagnostics, re-run controls)
3. In-App User Guide & Architecture Documentation
"""

import os
import sys

# Load .env file if present
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

import streamlit as st
from sap_adt_client import SapAdtClient
from abap_generator import AbapGenerator
from git_sync import GitSync

# Page Configuration
st.set_page_config(
    page_title="SAP Clean ABAP Generator Portal",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Clean UI - Zero Emojis)
st.markdown("""
<style>
    .status-badge-ok {
        background-color: #ecfdf5;
        color: #065f46;
        padding: 4px 10px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
        border: 1px solid #a7f3d0;
        display: inline-block;
    }
    .status-badge-warn {
        background-color: #fffbeb;
        color: #92400e;
        padding: 4px 10px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
        border: 1px solid #fde68a;
        display: inline-block;
    }
    .status-badge-err {
        background-color: #fef2f2;
        color: #991b1b;
        padding: 4px 10px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
        border: 1px solid #fecaca;
        display: inline-block;
    }
    .metric-card {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px 16px;
        background-color: #ffffff;
        text-align: center;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .test-pass-row {
        background-color: #f0fdf4;
        border-left: 4px solid #22c55e;
        padding: 8px 12px;
        margin-bottom: 6px;
        border-radius: 2px;
    }
    .test-fail-row {
        background-color: #fef2f2;
        border-left: 4px solid #ef4444;
        padding: 8px 12px;
        margin-bottom: 6px;
        border-radius: 2px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session State
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Welcome to the SAP Clean ABAP Generator Portal. You can dictate or type your business requirement on the left, configure target SAP package and class name, and generate modern ABAP with automated syntax checks and unit tests."
        }
    ]

if "class_name" not in st.session_state:
    st.session_state.class_name = "ZCL_ORDER_DISCOUNT"

if "package_name" not in st.session_state:
    st.session_state.package_name = "$TMP"

if "tables" not in st.session_state:
    st.session_state.tables = "VBAK, VBAP"

if "class_code" not in st.session_state:
    st.session_state.class_code = ""

if "test_code" not in st.session_state:
    st.session_state.test_code = ""

if "xml_code" not in st.session_state:
    st.session_state.xml_code = ""

if "sap_state" not in st.session_state:
    st.session_state.sap_state = "UNCHECKED"

if "syntax_result" not in st.session_state:
    st.session_state.syntax_result = None

if "test_result" not in st.session_state:
    st.session_state.test_result = None

# Initialize Backend Clients
@st.cache_resource
def get_clients():
    adt_client = SapAdtClient()
    generator = AbapGenerator()
    git_sync = GitSync()
    return adt_client, generator, git_sync

adt_client, generator, git_sync = get_clients()

if "connection_info" not in st.session_state:
    st.session_state.connection_info = adt_client.ping()

# -------------------------------------------------------------
# SIDEBAR NAVIGATION
# -------------------------------------------------------------
st.sidebar.title("SAP_aiabap")
st.sidebar.caption("Clean ABAP Platform")

nav_choice = st.sidebar.radio(
    "Navigation Menu",
    [
        "ABAP Generator Workbench",
        "Test & Syntax Inspector",
        "User Guide & Architecture"
    ]
)

st.sidebar.divider()
st.sidebar.markdown("**System Status**")
conn = st.session_state.connection_info
if conn.get("mode") == "live" and conn.get("success"):
    st.sidebar.markdown(f"Status: <span class='status-badge-ok'>LIVE CONNECTED</span>", unsafe_allow_html=True)
else:
    st.sidebar.markdown(f"Status: <span class='status-badge-warn'>OFFLINE SIMULATION</span>", unsafe_allow_html=True)

st.sidebar.caption(f"Target Client: {conn.get('client', '100')}")
st.sidebar.caption(f"Active Class: {st.session_state.class_name}")
st.sidebar.caption(f"Package: {st.session_state.package_name}")

if st.sidebar.button("Refresh SAP Connection"):
    with st.spinner("Pinging SAP DEV..."):
        st.session_state.connection_info = adt_client.ping()
        st.rerun()

st.sidebar.divider()
st.sidebar.caption("SAP DEV Endpoint: /sap/bc/adt")
st.sidebar.caption("Clean ABAP 7.50+ Enforced")


# =============================================================
# PAGE 1: ABAP GENERATOR WORKBENCH
# =============================================================
if nav_choice == "ABAP Generator Workbench":
    st.title("SAP Clean ABAP Generator Workbench")
    st.caption("Standardized Intake, Autonomous Syntax Verification & abapGit Deployment")

    # Metrics Summary Row
    m_col1, m_col2, m_col3, m_col4 = st.columns(4)
    with m_col1:
        if conn.get("mode") == "live" and conn.get("success"):
            st.markdown("<div class='metric-card'><strong>SAP Host</strong><br><span class='status-badge-ok'>LIVE CONNECTED</span></div>", unsafe_allow_html=True)
        else:
            st.markdown("<div class='metric-card'><strong>SAP Host</strong><br><span class='status-badge-warn'>SIMULATION MODE</span></div>", unsafe_allow_html=True)

    with m_col2:
        syntax = st.session_state.syntax_result
        if syntax is None:
            st.markdown("<div class='metric-card'><strong>Syntax Check</strong><br><span class='status-badge-warn'>NOT CHECKED</span></div>", unsafe_allow_html=True)
        elif not syntax.get("has_errors"):
            st.markdown("<div class='metric-card'><strong>Syntax Check</strong><br><span class='status-badge-ok'>VALID (0 Errors)</span></div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='metric-card'><strong>Syntax Check</strong><br><span class='status-badge-err'>{len(syntax.get('errors', []))} ERRORS</span></div>", unsafe_allow_html=True)

    with m_col3:
        test = st.session_state.test_result
        if test is None:
            st.markdown("<div class='metric-card'><strong>Unit Tests</strong><br><span class='status-badge-warn'>NOT RUN</span></div>", unsafe_allow_html=True)
        elif test.get("failed", 0) == 0:
            st.markdown(f"<div class='metric-card'><strong>Unit Tests</strong><br><span class='status-badge-ok'>{test.get('passed', 0)}/{test.get('total', 0)} PASSED (100%)</span></div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='metric-card'><strong>Unit Tests</strong><br><span class='status-badge-err'>{test.get('failed', 0)} FAILED</span></div>", unsafe_allow_html=True)

    with m_col4:
        state = st.session_state.sap_state
        if state == "ACTIVE":
            st.markdown("<div class='metric-card'><strong>SAP State</strong><br><span class='status-badge-ok'>ACTIVE</span></div>", unsafe_allow_html=True)
        elif state == "INACTIVE":
            st.markdown("<div class='metric-card'><strong>SAP State</strong><br><span class='status-badge-warn'>INACTIVE</span></div>", unsafe_allow_html=True)
        else:
            st.markdown("<div class='metric-card'><strong>SAP State</strong><br><span class='status-badge-warn'>DRAFT</span></div>", unsafe_allow_html=True)

    st.divider()

    # Split Workspace Layout
    left_col, right_col = st.columns([5, 6], gap="large")

    # Left: Intake & Feedback Loop
    with left_col:
        st.subheader("1. Requirement Intake & Parameters")

        with st.expander("Standardized Intake Form (Voice & Context)", expanded=True):
            st.markdown("**Voice Requirement (Microphone):**")
            if hasattr(st, "audio_input"):
                audio_val = st.audio_input("Record requirement with microphone")
                if audio_val is not None:
                    st.info("Audio requirement recorded. You can summarize details in text below.")

            user_req = st.text_area(
                "Business Logic & Requirement (Text):",
                value="Create a discount calculator class ZCL_ORDER_DISCOUNT that applies a 10% discount if order amount is over 1000, otherwise 0.",
                height=90,
                help="Describe functional requirements, calculation formulas, and boundary rules."
            )

            st.markdown("**SAP Technical Context:**")
            ctx_c1, ctx_c2 = st.columns(2)
            with ctx_c1:
                cls_input = st.text_input("Class Name:", value=st.session_state.class_name).upper().strip()
                st.session_state.class_name = cls_input
            with ctx_c2:
                pkg_input = st.text_input("SAP Package:", value=st.session_state.package_name).upper().strip()
                st.session_state.package_name = pkg_input

            tbl_input = st.text_input("Database Tables / CDS Views:", value=st.session_state.tables)
            st.session_state.tables = tbl_input

            if st.button("Generate Clean ABAP Code", type="primary", use_container_width=True):
                req_text = user_req.strip()
                if not req_text:
                    st.error("Please enter a requirement.")
                else:
                    with st.spinner("Synthesizing Clean ABAP 7.50+ code and verifying against SAP..."):
                        gen_res = generator.generate(
                            requirement=req_text,
                            class_name=st.session_state.class_name,
                            package_name=st.session_state.package_name,
                            tables=st.session_state.tables
                        )
                        st.session_state.class_code = gen_res["class_code"]
                        st.session_state.test_code = gen_res["test_code"]
                        st.session_state.xml_code = gen_res["xml_code"]

                        # In-memory syntax check
                        syntax_res = adt_client.check_syntax(st.session_state.class_name, gen_res["class_code"])
                        st.session_state.syntax_result = syntax_res

                        # Run unit tests
                        test_res = adt_client.run_unit_tests(st.session_state.class_name)
                        st.session_state.test_result = test_res

                        st.session_state.sap_state = "INACTIVE"

                        st.session_state.messages.append({
                            "role": "user",
                            "content": f"Generate ABAP for: {req_text} (Class: {st.session_state.class_name})"
                        })
                        st.session_state.messages.append({
                            "role": "assistant",
                            "content": f"Generated `{st.session_state.class_name}`. In-memory syntax check: {'PASS' if not syntax_res.get('has_errors') else 'FAIL'}. Unit tests: {test_res.get('passed', 0)}/{test_res.get('total', 0)} passed."
                        })
                        st.rerun()

        # Conversational Chat Panel
        st.subheader("2. Conversational Refinement")
        st.caption("Chat with the assistant to iteratively adjust boundaries, exceptions, and constants.")

        chat_box = st.container(height=320)
        with chat_box:
            for msg in st.session_state.messages:
                with st.chat_message(msg["role"]):
                    st.write(msg["content"])

        if chat_prompt := st.chat_input("Request a change (e.g., 'Change discount to 15%', 'Add exception for negative amount')..."):
            st.session_state.messages.append({"role": "user", "content": chat_prompt})
            with st.spinner("Updating ABAP code based on your request..."):
                refined_res = generator.generate(
                    requirement=f"{chat_prompt} (Existing class: {st.session_state.class_name})",
                    class_name=st.session_state.class_name,
                    package_name=st.session_state.package_name,
                    tables=st.session_state.tables
                )
                st.session_state.class_code = refined_res["class_code"]
                st.session_state.test_code = refined_res["test_code"]
                st.session_state.xml_code = refined_res["xml_code"]

                syntax_res = adt_client.check_syntax(st.session_state.class_name, refined_res["class_code"])
                st.session_state.syntax_result = syntax_res

                test_res = adt_client.run_unit_tests(st.session_state.class_name)
                st.session_state.test_result = test_res

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": f"Updated `{st.session_state.class_name}`: {chat_prompt}. Syntax and unit tests re-verified."
                })
                st.rerun()

    # Right: Live Code & Execution Toolbar
    with right_col:
        st.subheader("3. Live Code & Execution Actions")

        # Dedicated Action Controls
        act_c1, act_c2, act_c3, act_c4 = st.columns(4)

        with act_c1:
            if st.button("Re-run Syntax Check", use_container_width=True):
                if not st.session_state.class_code:
                    st.warning("Generate code first.")
                else:
                    with st.spinner("Checking syntax via /sap/bc/adt/syntaxcheck..."):
                        res = adt_client.check_syntax(st.session_state.class_name, st.session_state.class_code)
                        st.session_state.syntax_result = res
                        st.rerun()

        with act_c2:
            if st.button("Re-run Unit Tests", use_container_width=True):
                if not st.session_state.class_code:
                    st.warning("Generate code first.")
                else:
                    with st.spinner("Executing tests via /sap/bc/adt/abapunit..."):
                        res = adt_client.run_unit_tests(st.session_state.class_name)
                        st.session_state.test_result = res
                        st.rerun()

        with act_c3:
            if st.button("Activate in SAP DEV", use_container_width=True):
                if not st.session_state.class_code:
                    st.warning("Generate code first.")
                else:
                    with st.spinner("Activating class in SAP Data Dictionary..."):
                        res = adt_client.activate_class(st.session_state.class_name)
                        if res.get("success"):
                            st.session_state.sap_state = "ACTIVE"
                            st.success(res.get("message"))
                        else:
                            st.error(res.get("message"))
                        st.rerun()

        with act_c4:
            if st.button("Push to Git", use_container_width=True):
                if not st.session_state.class_code:
                    st.warning("Generate code first.")
                else:
                    with st.spinner("Serializing to src/ and pushing to GitHub..."):
                        w_res = git_sync.write_class_files(
                            class_name=st.session_state.class_name,
                            class_code=st.session_state.class_code,
                            test_code=st.session_state.test_code,
                            xml_code=st.session_state.xml_code
                        )
                        if w_res.get("success"):
                            c_res = git_sync.commit_and_push(st.session_state.class_name)
                            if c_res.get("success"):
                                st.success(c_res.get("message"))
                            else:
                                st.warning(c_res.get("message"))
                        else:
                            st.error(w_res.get("message"))

        # Visual Syntax Status Banner
        if st.session_state.syntax_result:
            s_res = st.session_state.syntax_result
            if not s_res.get("has_errors"):
                st.success(f"[PASS] {s_res.get('message', 'Syntax is valid.')}")
            else:
                st.error(f"[FAIL] {s_res.get('message', 'Syntax errors found.')}")

        # Visual Test Status Banner
        if st.session_state.test_result:
            t_res = st.session_state.test_result
            if t_res.get("failed", 0) == 0:
                st.info(f"[TESTS PASSED] {t_res.get('passed', 0)} of {t_res.get('total', 0)} unit tests passed.")
            else:
                st.error(f"[TESTS FAILED] {t_res.get('failed', 0)} of {t_res.get('total', 0)} unit tests failed.")

        # Tabbed Code View
        tab1, tab2, tab3 = st.tabs([
            f"Global Class ({st.session_state.class_name.lower()}.clas.abap)",
            "Local Unit Tests (locals_imp.abap)",
            "abapGit Metadata (.clas.xml)"
        ])

        with tab1:
            if st.session_state.class_code:
                st.code(st.session_state.class_code, language="abap", line_numbers=True)
            else:
                st.info("No code generated yet. Enter requirements on the left and click 'Generate Clean ABAP Code'.")

        with tab2:
            if st.session_state.test_code:
                st.code(st.session_state.test_code, language="abap", line_numbers=True)
            else:
                st.info("No test class generated yet.")

        with tab3:
            if st.session_state.xml_code:
                st.code(st.session_state.xml_code, language="xml", line_numbers=True)
            else:
                st.info("No abapGit XML metadata generated yet.")


# =============================================================
# PAGE 2: TEST & SYNTAX INSPECTOR
# =============================================================
elif nav_choice == "Test & Syntax Inspector":
    st.title("SAP Test & Syntax Inspector")
    st.caption("Detailed diagnostics, compiler message analysis, and execution traces from /sap/bc/adt")

    insp_col1, insp_col2 = st.columns(2)

    with insp_col1:
        st.subheader("In-Memory Syntax Diagnostics")
        if st.button("Run In-Memory Syntax Check Now", type="primary", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate or load ABAP code first.")
            else:
                with st.spinner("Contacting SAP DEV /sap/bc/adt/syntaxcheck..."):
                    st.session_state.syntax_result = adt_client.check_syntax(
                        st.session_state.class_name, st.session_state.class_code
                    )
                    st.rerun()

        syn = st.session_state.syntax_result
        if syn is None:
            st.info("No syntax check has been executed yet. Click above to run.")
        elif not syn.get("has_errors"):
            st.markdown(f"<div class='test-pass-row'><strong>[SYNTAX VALID]</strong> {syn.get('message')}<br><small>Verified against SAP 7.50+ compiler specifications.</small></div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='test-fail-row'><strong>[SYNTAX ERRORS]</strong> {syn.get('message')}</div>", unsafe_allow_html=True)
            errors = syn.get("errors", [])
            for err in errors:
                st.error(f"Line {err.get('line', '0')}: {err.get('message', 'Error')}")

    with insp_col2:
        st.subheader("ABAP Unit Test Suite Execution")
        if st.button("Run ABAP Unit Test Suite Now", type="primary", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate or load ABAP code first.")
            else:
                with st.spinner("Executing test runs on SAP DEV /sap/bc/adt/abapunit/testruns..."):
                    st.session_state.test_result = adt_client.run_unit_tests(st.session_state.class_name)
                    st.rerun()

        tst = st.session_state.test_result
        if tst is None:
            st.info("No unit tests have been executed yet. Click above to run.")
        else:
            total = tst.get("total", 0)
            passed = tst.get("passed", 0)
            failed = tst.get("failed", 0)
            duration = tst.get("duration_ms", 0)

            st.write(f"**Test Target:** `{st.session_state.class_name}` | **Duration:** {duration} ms")
            st.progress(passed / total if total > 0 else 1.0)

            test_cases = tst.get("test_cases", [])
            for tc in test_cases:
                tc_name = tc.get("name", "test_case")
                tc_status = tc.get("status", "UNKNOWN")
                tc_dur = tc.get("duration_ms", 0)
                if tc_status == "PASSED":
                    st.markdown(f"<div class='test-pass-row'><strong>[PASSED]</strong> <code>{tc_name}</code> ({tc_dur} ms)</div>", unsafe_allow_html=True)
                else:
                    st.markdown(f"<div class='test-fail-row'><strong>[FAILED]</strong> <code>{tc_name}</code></div>", unsafe_allow_html=True)

    st.divider()
    st.subheader("Active Source Code Buffer")
    if st.session_state.class_code:
        st.code(st.session_state.class_code, language="abap", line_numbers=True)
    else:
        st.info("No code loaded in current session buffer.")


# =============================================================
# PAGE 3: USER GUIDE & ARCHITECTURE
# =============================================================
elif nav_choice == "User Guide & Architecture":
    st.title("System Guide, Architecture & Boundaries")
    st.caption("Complete operational and technical manual for the SAP Clean ABAP Generator Portal")

    guide_tab1, guide_tab2, guide_tab3, guide_tab4, guide_tab5 = st.tabs([
        "1. End-to-End Workflow",
        "2. Connecting to SAP DEV",
        "3. Capabilities & Boundaries",
        "4. Clean ABAP Standards",
        "5. abapGit & CTS Transports"
    ])

    with guide_tab1:
        st.subheader("1. End-to-End System Lifecycle")
        st.markdown("""
The platform bridges business requirements directly to your SAP DEV system while maintaining strict quality gates:

1. **Intake:** Business users or functional consultants dictate voice requirements via microphone or type text prompts into the standardized input mask.
2. **Technical Scope:** SAP experts specify the target class name, development package (`$TMP` or `ZDEV`), and referenced database tables.
3. **AI Generation:** The engine generates Clean ABAP 7.50+ code, corresponding `CL_AUNIT_ASSERT` test suites, and abapGit XML serialization.
4. **Autonomous In-Memory Check:** The backend calls `/sap/bc/adt/syntaxcheck` on the SAP server to compile the code in memory.
5. **ABAP Unit Test Execution:** The backend calls `/sap/bc/adt/abapunit/testruns` to run all test cases on the application server.
6. **Conversational Feedback:** Reviewers can request changes in plain language; the code updates and re-verifies automatically.
7. **Human Approval Gate:** Activation in SAP DEV requires a deliberate button click by the developer.
8. **abapGit Synchronization:** Changes are pushed to GitHub, allowing standard `ZABAPGIT` transaction in SAP GUI to pull code into the package.
        """)

    with guide_tab2:
        st.subheader("2. Connecting to Your On-Premise SAP DEV System")
        st.markdown("""
No custom transports or basis modifications are needed on your SAP system. Only verify two standard settings:

#### Step 1: Transaction SICF (SAP GUI)
* Path: `/default_host/sap/bc/adt`
* Ensure the service and child nodes (`discovery`, `syntaxcheck`, `abapunit`, `activation`, `oo/classes`) are **Active**.

#### Step 2: Transaction SU01 (SAP GUI)
* Ensure your technical or developer user has authorization object `S_DEVELOP`:
  * `OBJTYPE`: `CLAS`, `PROG`, `INTF`
  * `ACTVT`: `01` (Create), `02` (Change), `03` (Display)
* Ensure authorization object `S_RFC_ADM` or `S_ICF` for HTTP REST connectivity.

#### Step 3: Workstation / Server Configuration (`.env`)
Set your connection details in `.env`:
```env
SAP_URL=http://sapdev.company.corp:8000
SAP_CLIENT=100
SAP_USER=DEVELOPER
SAP_PASSWORD=YOUR_PASSWORD
SAP_LANGUAGE=EN
SAP_ALLOW_SELF_SIGNED=true
SAP_OFFLINE_MODE=false
```
*(Note: If `SAP_OFFLINE_MODE=true` is set, the portal automatically simulates all ADT endpoints so you can test disconnected without network access).*
        """)

    with guide_tab3:
        st.subheader("3. Capabilities Matrix (What It CAN DO vs CANNOT DO)")
        cap_c1, cap_c2 = st.columns(2)

        with cap_c1:
            st.markdown("#### What the Platform CAN DO")
            st.markdown("""
* **Generate Clean ABAP 7.50+:** Inline declarations (`DATA(...) = ...`), constructor expressions (`VALUE #()`, `COND #()`), string templates, table expressions.
* **In-Memory Syntax Validation:** Checks code against the real SAP compiler without saving uncompiled drafts to the database.
* **Automated Unit Testing:** Executes test classes and measures pass rates, failure traces, and execution times.
* **Dual-Mode Operation:** Operates seamlessly connected to live SAP or in full offline simulation mode.
* **Dictionary Activation:** Activates inactive classes in SAP DEV upon user confirmation.
* **abapGit Version Control:** Formats files to standard abapGit schema and pushes directly to GitHub.
            """)

        with cap_c2:
            st.markdown("#### What It CANNOT DO (Strict Safety Boundaries)")
            st.markdown("""
* **CANNOT Touch QA or Production:** Restricted strictly to the development client configured in `.env`.
* **CANNOT Release Transports Automatically:** Releasing Workbench Transport Requests (`SE09`/`SE10`) to transport code to QA/PROD requires manual review and release in SAP GUI.
* **CANNOT Bypass SAP Security:** Operates strictly under the authenticated user's SAP developer profile.
* **CANNOT Execute Arbitrary OS Commands:** Communicates exclusively over standard HTTP REST `/sap/bc/adt`.
* **CANNOT Activate Without Approval:** The system never activates code in the SAP Dictionary without an explicit button click by the developer.
            """)

    with guide_tab4:
        st.subheader("4. Clean ABAP 7.50+ Coding Standards Applied")
        st.markdown("""
The code generator strictly enforces modern SAP guidelines:

* **Inline Declarations:** `DATA(total_amount) = calculate_total( ).` instead of top-level `DATA:` blocks.
* **Constructor Expressions:** `rv_discount = COND #( WHEN iv_amount > 1000 THEN '10.00' ELSE '0.00' ).` instead of verbose `IF-ELSE` blocks.
* **String Templates:** `|Order total: { lv_amount }|` instead of legacy `CONCATENATE`.
* **Table Expressions:** `DATA(ls_item) = lt_items[ vbeln = iv_vbeln ].` instead of `READ TABLE ... WITH KEY`.
* **Fail Fast Exceptions:** Uses `CX_STATIC_CHECK` / `CX_NO_CHECK` instead of returning arbitrary `sy-subrc` integer codes.
* **Automated ABAP Unit Tests:** Always implements local test classes (`FOR TESTING`) using `cl_aunit_assert=>assert_equals` and `assert_bound`.
        """)

    with guide_tab5:
        st.subheader("5. abapGit Synchronization & CTS Transport Flow")
        st.markdown("""
How code moves from this portal into your SAP transport landscape:

```text
[ Web Portal (Push to Git) ] ──> [ GitHub Repository (src/) ]
                                               │
                                               ▼ Transaction ZABAPGIT
                                  [ Pull into SAP Package (DEV) ]
                                               │
                                               ▼ Eclipse / SAP GUI
                                     [ Activate & Test ]
                                               │
                                               ▼ Transaction SE09 / SE10
                                  [ Manual CTS Transport Release ]
                                               │
                                               ▼ STMS
                                     [ Import into QA & PROD ]
```
1. Click **Push to Git** in the portal to serialize the class into `src/`.
2. Open transaction `ZABAPGIT` in SAP GUI and click **Pull** to import the files into your package.
3. Once verified in SAP DEV, an authorized developer releases the CTS Workbench Transport Request in transaction `SE09`/`SE10`.
        """)
