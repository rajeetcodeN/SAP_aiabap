# SAP_aiabap: Autonomous Web-Based Clean ABAP Generator Portal

A centralized, zero-client-installation web application that enables business requesters, functional consultants, and SAP developers to generate Clean ABAP 7.50+ code, run in-memory syntax verification and unit tests against SAP DEV, and push artifacts to GitHub for abapGit pull.

---

## Architecture Overview

In this web-based approach, end users need only a standard web browser (Chrome, Edge, Firefox). All AI processing, SAP ADT communication, and Git serialization are handled centrally by the portal backend.

```text
[ Business Users / SAP Developers ]
(Any Web Browser - Zero Local Installs)
               │
               ▼ HTTPS (Port 8501)
┌─────────────────────────────────────────────────────────────┐
│                   SAP_aiabap Web Portal                     │
│               (Python Streamlit Application)                │
│                                                             │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ User Interface         │    │ Core Engine             │  │
│  │ • Voice/Text Intake    │◄──►│ • Clean ABAP Generator  │  │
│  │ • Context Clarification│    │ • Python SAP ADT Client │  │
│  │ • Conversational Chat  │    │ • abapGit Serializer    │  │
│  │ • Live Status Cards    │    │ • Simulation Fallback   │  │
│  └────────────────────────┘    └────────────┬────────────┘  │
└─────────────────────────────────────────────┼───────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼ HTTP/S                                            ▼ HTTPS
         [ On-Premise SAP DEV ]                                 [ GitHub Repository ]
         (/sap/bc/adt Endpoints)                                (abapGit Sync)
```

---

## Key Capabilities

### 1. Standardized Intake Mask (Voice & Text)
* **Voice Requirement:** Capture business specifications directly through browser microphone input (`st.audio_input`).
* **Text Requirement:** Freeform prompt area for functional logic, business formulas, and boundary criteria.

### 2. SAP Context Clarification
* Interactive fields for SAP technical metadata:
  * **Class Name:** Target object (e.g., `ZCL_ORDER_DISCOUNT`).
  * **Package:** Target development package (e.g., `$TMP` or `ZDEV`).
  * **Database Tables:** Tables and entities accessed (e.g., `VBAK`, `VBAP`).

### 3. Conversational Feedback Loop
* Real-time chat panel allowing developers to ask questions and refine generated code iteratively (e.g., *"Add an exception when amount is negative"*, *"Make threshold configurable via a constant"*).

### 4. Live Code Viewer & SAP Status Cards
* **Real-time Status Dashboard:**
  * **SAP Connectivity:** Live Connected vs Offline Simulation Mode.
  * **Compiler Syntax:** In-memory check status (Valid / Error count).
  * **Unit Tests:** Pass/fail rate and execution time (e.g., `3/3 Passed (100%)`).
  * **SAP State:** Inactive / Active status in the Data Dictionary.
* **Three Tabbed ABAP Views:**
  1. Global Class Definition & Implementation (`.clas.abap`)
  2. Local ABAP Unit Test Class (`.clas.locals_imp.abap`)
  3. abapGit Serialization Metadata (`.clas.xml`)

### 5. Direct SAP ADT REST Integration
* Connects directly to on-premise SAP NetWeaver / S/4HANA application servers:
  * `/sap/bc/adt/discovery`: Handles CSRF token and session cookies.
  * `/sap/bc/adt/syntaxcheck`: Validates syntax in memory without saving drafts to the database.
  * `/sap/bc/adt/abapunit/testruns`: Runs ABAP Unit test suites on the SAP server.
  * `/sap/bc/adt/activation`: Activates objects in the SAP Data Dictionary.

### 6. Dual-Mode Operation (Live SAP vs Offline Simulation)
* **Live SAP Mode:** Engages automatically when `SAP_PASSWORD` is configured and SAP host is reachable.
* **Offline Simulation Mode:** Automatically engages when disconnected from the SAP VPN or when credentials are empty (`SAP_OFFLINE_MODE=true`). Allows building and testing anywhere without a live SAP system.

---

## Deployment & Setup

### Option 1: Docker Deployment (Recommended for Servers)

1. Clone this repository:
   ```bash
   git clone https://github.com/rajeetcodeN/SAP_aiabap.git
   cd SAP_aiabap
   ```

2. Configure environment settings:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your SAP host, credentials, and optional AI API key (Anthropic, Gemini, or OpenAI).

3. Start the container:
   ```bash
   docker compose up -d --build
   ```

4. Open `http://<your-server-ip>:8501` in any browser.

---

### Option 2: Local Python Execution

1. Ensure Python 3.10+ is installed:
   ```powershell
   python --version
   ```

2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

3. Configure environment settings:
   ```powershell
   cp .env.example .env
   ```

4. Run the application:
   ```powershell
   streamlit run app.py
   ```

5. The application will launch automatically in your browser at `http://localhost:8501`.

---

## Environment Configuration Reference (`.env`)

| Variable | Default | Description |
|---|---|---|
| `SAP_URL` | `http://sapdev.company.corp:8000` | URL to on-premise SAP system |
| `SAP_CLIENT` | `100` | SAP Client ID |
| `SAP_USER` | `DEVELOPER` | SAP Developer Username |
| `SAP_PASSWORD` | *(empty)* | SAP Password (leave blank for offline mode) |
| `SAP_LANGUAGE` | `EN` | SAP Logon Language |
| `SAP_ALLOW_SELF_SIGNED` | `true` | Allow self-signed SSL certificates |
| `SAP_OFFLINE_MODE` | `true` | Enable mock simulation mode |
| `ANTHROPIC_API_KEY` | *(empty)* | Optional Claude API key for AI generation |
| `GEMINI_API_KEY` | *(empty)* | Optional Google Gemini API key |
| `OPENAI_API_KEY` | *(empty)* | Optional OpenAI API key |

*(Note: When all AI API keys are empty, the portal uses a built-in intelligent Clean ABAP synthesizer for zero-configuration testing).*

---

## SAP On-Premise Prerequisite Checklist

To connect to live SAP DEV, verify two standard settings in SAP GUI:

1. **Transaction `SICF`:**
   * Path: `/default_host/sap/bc/adt`
   * Ensure service and child nodes (`discovery`, `syntaxcheck`, `abapunit`, `activation`) are active.
2. **Transaction `SU01`:**
   * User requires authorization object `S_DEVELOP` (`OBJTYPE: CLAS`, `ACTVT: 01, 02, 03`).
   * User requires authorization for HTTP ICF communication.
