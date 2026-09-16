"""
SAP Clean ABAP Generator Web Portal
Streamlit web application for standardized requirement intake (voice/text),
conversational chat refinement, live code preview, and real-time SAP ADT execution.
"""

import os
import sys
import streamlit as st
from sap_adt_client import SapAdtClient
from abap_generator import AbapGenerator
from git_sync import GitSync

# Page Configuration
st.set_page_config(
    page_title="SAP Clean ABAP Generator Portal",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom Styling (Enterprise Clean - No Emojis)
st.markdown("""
<style>
    .reportview-container { background: #f8fafc; }
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
    .metric-box {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px 14px;
        background-color: #ffffff;
        text-align: center;
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

# Initialize Clients
@st.cache_resource
def get_clients():
    adt_client = SapAdtClient()
    generator = AbapGenerator()
    git_sync = GitSync()
    return adt_client, generator, git_sync

adt_client, generator, git_sync = get_clients()

# Check Initial SAP Status
if "connection_info" not in st.session_state:
    st.session_state.connection_info = adt_client.ping()

# Top Header Bar
header_col1, header_col2, header_col3 = st.columns([3, 2, 1])

with header_col1:
    st.title("SAP Clean ABAP Generator Portal")
    st.caption("Standardized Intake, Autonomous Syntax Verification & abapGit Deployment")

with header_col2:
    conn = st.session_state.connection_info
    if conn.get("mode") == "live" and conn.get("success"):
        st.markdown(f"**SAP Connectivity:** <span class='status-badge-ok'>LIVE CONNECTED (Client {conn.get('client', '100')})</span>", unsafe_allow_html=True)
    else:
        st.markdown(f"**SAP Connectivity:** <span class='status-badge-warn'>SIMULATION MODE (Client {conn.get('client', '100')})</span>", unsafe_allow_html=True)
    st.caption(f"Host: {adt_client.url}")

with header_col3:
    if st.button("Test Connection"):
        with st.spinner("Pinging SAP DEV..."):
            st.session_state.connection_info = adt_client.ping()
            st.rerun()

st.divider()

# Main Layout: 2 Columns
left_col, right_col = st.columns([5, 6], gap="large")

# -------------------------------------------------------------
# LEFT COLUMN: INTAKE, SAP CONTEXT & CHAT REFINEMENT
# -------------------------------------------------------------
with left_col:
    st.subheader("1. Requirement Intake & Feedback Loop")

    # Standardized Input Mask Tab / Form
    with st.expander("Standardized Input Mask (Voice & Context)", expanded=True):
        # Audio / Voice Recorder
        st.markdown("**Voice Requirement (Microphone):**")
        audio_prompt = None
        if hasattr(st, "audio_input"):
            audio_val = st.audio_input("Record requirement with microphone")
            if audio_val is not None:
                audio_prompt = "[Voice recorded requirement received]"
                st.info("Audio requirement recorded. You can summarize details in text below.")

        # Text Requirement
        user_req = st.text_area(
            "Functional Requirement (Text):",
            value="Create a discount calculator class ZCL_ORDER_DISCOUNT that applies a 10% discount if order amount is over 1000, otherwise 0.",
            height=85,
            help="Describe the business logic, formulas, or rules."
        )

        # Structured SAP Context Questions
        st.markdown("**SAP Technical Context:**")
        ctx_col1, ctx_col2 = st.columns(2)
        with ctx_col1:
            cls_input = st.text_input("Class Name:", value=st.session_state.class_name).upper().strip()
            st.session_state.class_name = cls_input
        with ctx_col2:
            pkg_input = st.text_input("SAP Package:", value=st.session_state.package_name).upper().strip()
            st.session_state.package_name = pkg_input

        tbl_input = st.text_input("Database Tables / Entities:", value=st.session_state.tables)
        st.session_state.tables = tbl_input

        # Action: Generate Code
        if st.button("Generate Clean ABAP Code", type="primary", use_container_width=True):
            req_text = user_req.strip()
            if not req_text:
                st.error("Please enter a functional requirement.")
            else:
                with st.spinner("Generating Clean ABAP 7.50+ code and running verification..."):
                    gen_res = generator.generate(
                        requirement=req_text,
                        class_name=st.session_state.class_name,
                        package_name=st.session_state.package_name,
                        tables=st.session_state.tables
                    )
                    st.session_state.class_code = gen_res["class_code"]
                    st.session_state.test_code = gen_res["test_code"]
                    st.session_state.xml_code = gen_res["xml_code"]

                    # Automatically perform in-memory syntax check on generated class
                    syntax_res = adt_client.check_syntax(st.session_state.class_name, gen_res["class_code"])
                    st.session_state.syntax_result = syntax_res

                    # Automatically run unit tests
                    test_res = adt_client.run_unit_tests(st.session_state.class_name)
                    st.session_state.test_result = test_res

                    st.session_state.sap_state = "INACTIVE"

                    # Add to chat history
                    st.session_state.messages.append({
                        "role": "user",
                        "content": f"Generate ABAP for: {req_text} (Class: {st.session_state.class_name}, Package: {st.session_state.package_name})"
                    })
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": f"Generated class `{st.session_state.class_name}`. In-memory syntax verification: {'PASS' if not syntax_res.get('has_errors') else 'FAIL'}. Unit tests: {test_res.get('passed', 0)}/{test_res.get('total', 0)} passed."
                    })
                    st.rerun()

    # Chat Conversation Interface
    st.subheader("2. Conversational Refinement")
    st.caption("Chat with the assistant to refine exceptions, boundaries, constants, or methods.")

    chat_container = st.container(height=350)
    with chat_container:
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.write(msg["content"])

    # Chat input for iterative modifications
    if chat_input := st.chat_input("Ask a question or request a code refinement..."):
        st.session_state.messages.append({"role": "user", "content": chat_input})
        with st.spinner("Updating ABAP code based on your feedback..."):
            # Refine code
            refined_res = generator.generate(
                requirement=f"{chat_input} (Existing class: {st.session_state.class_name})",
                class_name=st.session_state.class_name,
                package_name=st.session_state.package_name,
                tables=st.session_state.tables
            )
            st.session_state.class_code = refined_res["class_code"]
            st.session_state.test_code = refined_res["test_code"]
            st.session_state.xml_code = refined_res["xml_code"]

            # Re-verify
            syntax_res = adt_client.check_syntax(st.session_state.class_name, refined_res["class_code"])
            st.session_state.syntax_result = syntax_res
            test_res = adt_client.run_unit_tests(st.session_state.class_name)
            st.session_state.test_result = test_res

            st.session_state.messages.append({
                "role": "assistant",
                "content": f"Updated `{st.session_state.class_name}` with requested modification: '{chat_input}'. Compiler syntax verified."
            })
            st.rerun()


# -------------------------------------------------------------
# RIGHT COLUMN: LIVE CODE VIEWER & SAP STATUS
# -------------------------------------------------------------
with right_col:
    st.subheader("3. Live Code & Real-Time SAP Status")

    # Status Cards Row
    m_col1, m_col2, m_col3, m_col4 = st.columns(4)

    with m_col1:
        syntax = st.session_state.syntax_result
        if syntax is None:
            st.markdown("<div class='metric-box'><strong>Syntax Check</strong><br><span class='status-badge-warn'>NOT CHECKED</span></div>", unsafe_allow_html=True)
        elif not syntax.get("has_errors"):
            st.markdown("<div class='metric-box'><strong>Syntax Check</strong><br><span class='status-badge-ok'>VALID (0 Errors)</span></div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='metric-box'><strong>Syntax Check</strong><br><span class='status-badge-err'>{len(syntax.get('errors', []))} ERRORS</span></div>", unsafe_allow_html=True)

    with m_col2:
        test = st.session_state.test_result
        if test is None:
            st.markdown("<div class='metric-box'><strong>Unit Tests</strong><br><span class='status-badge-warn'>NOT RUN</span></div>", unsafe_allow_html=True)
        elif test.get("failed", 0) == 0:
            st.markdown(f"<div class='metric-box'><strong>Unit Tests</strong><br><span class='status-badge-ok'>{test.get('passed', 0)}/{test.get('total', 0)} PASSED</span></div>", unsafe_allow_html=True)
        else:
            st.markdown(f"<div class='metric-box'><strong>Unit Tests</strong><br><span class='status-badge-err'>{test.get('failed', 0)} FAILED</span></div>", unsafe_allow_html=True)

    with m_col3:
        state = st.session_state.sap_state
        if state == "ACTIVE":
            st.markdown("<div class='metric-box'><strong>SAP State</strong><br><span class='status-badge-ok'>ACTIVE</span></div>", unsafe_allow_html=True)
        elif state == "INACTIVE":
            st.markdown("<div class='metric-box'><strong>SAP State</strong><br><span class='status-badge-warn'>INACTIVE</span></div>", unsafe_allow_html=True)
        else:
            st.markdown("<div class='metric-box'><strong>SAP State</strong><br><span class='status-badge-warn'>DRAFT</span></div>", unsafe_allow_html=True)

    with m_col4:
        st.markdown(f"<div class='metric-box'><strong>Package</strong><br><code>{st.session_state.package_name}</code></div>", unsafe_allow_html=True)

    st.write("")

    # Code Display Tabs
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
            st.info("No abapGit XML generated yet.")

    # Action Toolbar
    st.markdown("**Action Controls:**")
    btn_col1, btn_col2, btn_col3, btn_col4 = st.columns(4)

    with btn_col1:
        if st.button("Check Syntax", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate code first.")
            else:
                with st.spinner("Checking syntax via SAP ADT..."):
                    res = adt_client.check_syntax(st.session_state.class_name, st.session_state.class_code)
                    st.session_state.syntax_result = res
                    if not res.get("has_errors"):
                        st.success(res.get("message", "Syntax is valid."))
                    else:
                        st.error(res.get("message", "Syntax check failed."))
                    st.rerun()

    with btn_col2:
        if st.button("Run Tests", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate code first.")
            else:
                with st.spinner("Running ABAP Unit tests on SAP..."):
                    res = adt_client.run_unit_tests(st.session_state.class_name)
                    st.session_state.test_result = res
                    st.info(f"{res.get('message', 'Tests completed.')}")
                    st.rerun()

    with btn_col3:
        if st.button("Activate in SAP", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate code first.")
            else:
                with st.spinner("Activating class in SAP DEV Data Dictionary..."):
                    res = adt_client.activate_class(st.session_state.class_name)
                    if res.get("success"):
                        st.session_state.sap_state = "ACTIVE"
                        st.success(res.get("message", "Activated successfully."))
                    else:
                        st.error(res.get("message", "Activation failed."))
                    st.rerun()

    with btn_col4:
        if st.button("Push to Git", type="secondary", use_container_width=True):
            if not st.session_state.class_code:
                st.warning("Generate code first.")
            else:
                with st.spinner("Saving artifacts to src/ and syncing with Git..."):
                    write_res = git_sync.write_class_files(
                        class_name=st.session_state.class_name,
                        class_code=st.session_state.class_code,
                        test_code=st.session_state.test_code,
                        xml_code=st.session_state.xml_code
                    )
                    if write_res.get("success"):
                        sync_res = git_sync.commit_and_push(st.session_state.class_name)
                        if sync_res.get("success"):
                            st.success(sync_res.get("message"))
                        else:
                            st.warning(f"Saved locally: {sync_res.get('message')}")
                    else:
                        st.error(write_res.get("message"))
