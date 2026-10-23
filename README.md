# Natural Language SQL Agent

An intelligent, production-ready **Text-to-SQL AI Agent** built with **LangGraph**, **Groq LLM** (`openai/gpt-oss-120b`), **SQLAlchemy 2.0**, **FastAPI**, **PostgreSQL Checkpointing**, and **Clerk Multi-Tenant Authentication**, accompanied by a modern **React 19** analytics dashboard.

The agent translates natural language questions into database queries, enforces dialect-specific SQL and strict read-only security policies, executes queries across multiple engines (**SQLite**, **MySQL**, **PostgreSQL**), recovers from syntax and runtime execution errors via an automated two-tier retry loop, generates dynamic data visualizations and business insights, and preserves conversation state across sessions using cloud **PostgreSQL Checkpointing**.

---

## 🌟 Key Features

* **Multi-Tenant User Authentication**: Full user authentication powered by **Clerk** (`clerk-backend-api` on FastAPI and `@clerk/react` on the frontend). Each user has private, isolated database connections and conversation histories.
* **Encrypted Credential Storage at Rest**: Database connection URLs and uploaded file paths are securely encrypted before storage using **Fernet symmetric encryption** (`cryptography.fernet`).
* **Multi-Database Connectivity & Auto-Restoration**: Connect dynamically to **SQLite** (via validated file uploads), **MySQL**, and **PostgreSQL**. The backend registers active engines per `connection_id` and restores connections on-demand from the application database.
* **Dialect-Aware SQL Generation**: Detects the target engine's SQL dialect (`sqlite`, `mysql`, `postgresql`) at runtime and instructs the LLM to generate pure, dialect-compliant queries (e.g., standardizing on `LIMIT` rather than `TOP`).
* **Two-Tier Self-Correction Architecture**:
  1. *Pre-Execution Guardrails*: Strips markdown fences, verifies `SELECT` statements, and strictly blocks destructive operations (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `CREATE`, `REPLACE`, `GRANT`, `REVOKE`).
  2. *Runtime Execution Error Recovery*: If a database error occurs during query execution (e.g., column mismatch, type error, or syntax glitch), the runtime error and schema are fed back to the LLM to re-generate corrected SQL (up to `MAX_RETRIES = 2`).
* **Cloud PostgreSQL State Checkpointing**: Replaces local file checkpoints with **`langgraph-checkpoint-postgres`** using connection pooling (`psycopg_pool.ConnectionPool`), delivering scalable multi-turn memory compatible with serverless cloud databases like **Neon**.
* **Full Conversation Lifecycle Management**:
  * Paginated conversation history sidebar.
  * Real-time conversation switching with automatic connection re-binding.
  * In-place conversation renaming (`PATCH /conversations/{thread_id}`).
  * Conversation deletion (`DELETE /conversations/{thread_id}`), which cleans both application metadata and LangGraph checkpoint state.
* **Automated Data Visualizations**: AI data analyzer evaluates query results and formats chart payloads (Bar, Line, Pie, Scatter) rendered in the UI with **Chart.js**.
* **Automated Business Insights**: AI business analyst synthesizes actionable, bulleted takeaways summarizing key trends, anomalies, and findings.
* **Interactive React 19 Frontend**:
  * Glassmorphism dark-theme UI with responsive layouts.
  * Interactive schema explorer with table schema inspection and live table row previews.
  * Chat workspace with collapsible SQL preview, copy-to-clipboard, interactive result tables, and chart displays.
* **Robust File Upload Security**: Uploaded SQLite databases are validated for file format, size limits (up to 50 MiB), and verified using SQLite `PRAGMA quick_check` before registration.

---

## 🛠️ Tech Stack

### Backend
* **Python 3.10+**
* **FastAPI** & **Uvicorn**: Async web framework with lifespan management and CORS middleware.
* **LangGraph** & **LangChain Core**: AI workflow state machine with conditional routing and message reducers.
* **Groq (`langchain-groq`)**: Fast LLM inference using `openai/gpt-oss-120b` (compatible with Google Gemini or Meta Llama).
* **LangGraph PostgreSQL Checkpointer (`langgraph-checkpoint-postgres`)**: Cloud state persistence using `psycopg_pool.ConnectionPool`.
* **SQLAlchemy 2.0**: ORM for application metadata and raw query execution across heterogeneous databases.
* **Clerk Backend API (`clerk-backend-api`)**: Server-side session verification, bearer token parsing, and authorized party enforcement.
* **Cryptography (`cryptography.fernet`)**: Symmetric encryption for sensitive database credentials.
* **Database Drivers**:
  * `psycopg` (v3) & `psycopg2-binary`: PostgreSQL driver and connection pooling.
  * `PyMySQL`: MySQL driver.
  * `sqlite3`: Native SQLite support with PRAGMA quick-check verification.

### Frontend
* **React 19** & **Vite 8**: Frontend library and build tooling.
* **@clerk/react**: Authentication hooks (`useAuth`), `<SignInButton />`, `<SignUpButton />`, and `<UserButton />`.
* **Chart.js** & **react-chartjs-2**: Dynamic client-side chart rendering.
* **Lucide React**: Clean iconography.
* **Vanilla CSS**: Responsive design system and theme variables.

---

## 📐 Architecture & Workflow

The agent operates as a stateful `StateGraph` in LangGraph with dual validation and execution recovery loops.

### Agent Flow Diagram

```mermaid
flowchart TD
    Start(["User Prompt / Question"]) --> GenSQL["Generate SQL Node<br/><i>(Dialect-aware prompt)</i>"]
    GenSQL --> ValSQL["Validate SQL Node<br/><i>(Read-only & safety filter)</i>"]
    ValSQL --> ValRoute{"Validate Router"}

    ValRoute -->|"valid"| ExecSQL["Execute SQL Node<br/><i>(Run on database engine)</i>"]
    ValRoute -->|"invalid, retries < max"| RetrySQL["Retry SQL Node<br/><i>(Re-prompt with error)</i>"]
    ValRoute -->|"invalid, max retries reached"| FailedNode["Failed Node"]

    ExecSQL --> ExecRoute{"Execute Router"}
    ExecRoute -->|"query success"| AnalyzeNode["Analyze Result Node"]
    ExecRoute -->|"runtime error, retries < max"| RetrySQL
    ExecRoute -->|"runtime error, max retries reached"| FailedNode

    RetrySQL --> ValSQL
    FailedNode --> EndNode(["End / Fallback Message"])

    AnalyzeNode --> ChartNode["Chart Generator Node"]
    ChartNode --> InsightNode["Insight Generator Node"]
    InsightNode --> AnswerNode["Answer Query Node"]
    AnswerNode --> EndNode
```

### LangGraph Workflow Stages

1. **`generate_sql`**: Inspects target database dialect (`SQLite`, `MySQL`, `PostgreSQL`) and schema, incorporates multi-turn conversation history, and prompts the LLM for pure SQL.
2. **`validate_sql`**: Cleans markdown code blocks, strips SQL comments, verifies query starts with `SELECT`, and blocks destructive keywords.
3. **`validate_route`**: Checks safety validation; routes to `execute_sql` if valid, `retry_sql` if attempts remain, or `failed` if `MAX_RETRIES` is reached.
4. **`execute_sql`**: Executes query on the selected database engine via SQLAlchemy. Captures returned rows as dictionaries, or intercepts SQL execution exceptions.
5. **`execute_route`**: Checks execution outcome; routes to `analyze` if rows were returned, or back to `retry_sql` with the error message if execution failed.
6. **`retry_sql`**: Increments retry counter and re-prompts LLM with the database dialect, schema, previous invalid query, and the exact database error message.
7. **`analyze`**: Evaluates result set to decide if a chart is beneficial and determines chart type (bar, line, pie, scatter).
8. **`chart`**: Extracts labels and numerical series arrays for Chart.js payloads.
9. **`insights`**: AI business analyst crafts 3-5 concise bullet points highlighting key business trends and outliers.
10. **`answer_query`**: Produces a natural language answer summarizing results and appends messages to state history.
11. **`failed`**: Returns a polite failure explanation to the client without terminating the server.

---

## 💾 Multi-Tenant Storage & Persistence Architecture

The project separates **Application Metadata**, **LangGraph Checkpoints**, and **User Target Databases**:

```
                       ┌────────────────────────────────────────────────────────┐
                       │                     FastAPI Server                     │
                       └──────────────┬───────────────────┬─────────────────────┘
                                      │                   │
                     Clerk User ID    │                   │   LangGraph Thread ID
                                      ▼                   ▼
    ┌───────────────────────────────────┐               ┌───────────────────────────────────────┐
    │     Application Database (Neon)   │               │   LangGraph Checkpoint Database (Neon)│
    │  - database_connections (Encrypted│               │  - checkpoints                        │
    │  - conversations (Title, Owner)   │               │  - checkpoint_blobs                   │
    └───────────────────────────────────┘               │  - checkpoint_writes                  │
                                                        └───────────────────────────────────────┘
                                      │
                     Connection ID    ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                     Target Databases (Per User)                  │
    │  • Uploaded SQLite (.sqlite files in backend/uploads/)           │
    │  • Remote MySQL Servers                                          │
    │  • Remote PostgreSQL Servers                                     │
    └──────────────────────────────────────────────────────────────────┘
```

1. **Application Database (`app_database.py`)**:
   * Uses SQLAlchemy ORM connecting to `APP_DATABASE_URL` (PostgreSQL / Neon).
   * **`database_connections` table**: Stores connection metadata (`id`, `owner_id`, `name`, `db_type`, `encrypted_url`, `created_at`).
   * **`conversations` table**: Tracks threads per user (`thread_id`, `owner_id`, `connection_id`, `title`, `created_at`, `updated_at`).
2. **Credential Encryption (`Fernet`)**:
   * Connection strings and filesystem paths are encrypted before storing in `database_connections.encrypted_url`.
   * Credentials are only decrypted in-memory during active engine connection restoration.
3. **LangGraph State Checkpointer (`graph.py`)**:
   * Utilizes `PostgresSaver` backed by a `psycopg_pool.ConnectionPool` (`LANGGRAPH_CHECKPOINT_URL`).
   * Automatically initializes checkpoint schema tables (`checkpointer.setup()`).

---

## 📂 Project Structure

```
natural-language-sql-agent/
├── backend/
│   ├── analyzer.py               # Evaluates results and selects chart types
│   ├── api.py                    # FastAPI application, auth middleware, and REST routes
│   ├── app_database.py           # Application DB models (User connections & conversations)
│   ├── auth.py                   # Clerk authentication dependency (require_user)
│   ├── chart_generator.py        # Generates X/Y data series for Chart.js
│   ├── config.py                 # Configuration settings (MAX_RETRIES = 2)
│   ├── database.py               # SQLAlchemy DatabaseManager (engine pool & auto-restore)
│   ├── formatter.py              # Text and output formatting utilities
│   ├── graph.py                  # LangGraph StateGraph & PostgresSaver setup
│   ├── insight_generator.py      # Business insight synthesis node
│   ├── llm.py                    # Groq ChatGroq LLM initialization (openai/gpt-oss-120b)
│   ├── main.py                   # CLI test runner entrypoint
│   ├── models.py                 # Pydantic schemas (ChatRequest, ConnectRequest, etc.)
│   ├── nodes.py                  # Graph node implementations
│   ├── retry_generator.py        # Error-aware & dialect-aware query correction
│   ├── routes.py                 # Conditional edge routers (validate_route, execute_route)
│   ├── sql_generator.py          # Dialect-aware SQL generator prompt
│   ├── sql_validator.py          # SQL cleaner & read-only AST safety validation
│   ├── state.py                  # GraphState TypedDict definition
│   └── uploads/                  # Upload directory for user SQLite database files
├── database/
│   └── Chinook.sqlite            # Sample SQLite database for testing
├── frontend/
│   ├── public/                   # Static web assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChartRenderer.jsx       # Chart.js dynamic chart component
│   │   │   ├── ChatWorkspace.jsx       # Conversation messages, SQL viewer, & data tables
│   │   │   ├── ConnectionPanel.jsx     # Connection form (upload, credentials, saved DBs)
│   │   │   ├── ConversationSidebar.jsx # Sidebar: history list, rename, delete, new chat
│   │   │   └── SchemaExplorer.jsx      # Interactive schema browser & row previewer
│   │   ├── App.css               # Main application layout styles
│   │   ├── App.jsx               # Dashboard, Clerk authentication gates, & tab views
│   │   ├── index.css             # Theme variables & glassmorphism styling
│   │   └── main.jsx              # React DOM entry point wrapped with ClerkProvider
│   ├── package.json              # Frontend scripts and dependencies
│   └── vite.config.js            # Vite configuration
├── init_app_db.py                # Database migration script to initialize app tables
├── .env                          # Root environment variables
├── .gitignore                    # Git ignore file
├── requirements.txt              # Python dependencies
└── README.md                     # Project documentation
```

---

## ⚡ Prerequisites & Setup

### Prerequisites
* **Python**: 3.10 or higher
* **Node.js**: 18.0 or higher
* **npm**: 9.0 or higher
* **PostgreSQL / Neon Database**: A PostgreSQL database for application records and LangGraph checkpoints (e.g. from [Neon](https://neon.tech)).
* **Clerk Account**: Free account from [Clerk.com](https://clerk.com) for authentication.
* **Groq API Key**: Free API key from [Groq Console](https://console.groq.com) (or Google Gemini API key if using Gemini).

---

### 1. Environment Configuration

#### Project Root `.env` (Backend Configuration)
Create a `.env` file in the project root:

```env
# Application Database (PostgreSQL / Neon)
APP_DATABASE_URL="postgresql+psycopg://username:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# LangGraph Checkpoints (PostgreSQL / Neon)
LANGGRAPH_CHECKPOINT_URL="postgresql://username:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Fernet Key for encrypting database credentials (32 url-safe base64-encoded bytes)
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
CONNECTION_ENCRYPTION_KEY="your-generated-fernet-key-here"

# LLM API Key (Groq)
GROQ_API_KEY="gsk_your_groq_api_key_here"

# (Optional) Google Gemini API Key
GOOGLE_API_KEY="your_google_api_key_here"
```

#### Backend `.env` (`backend/.env`)
Create `backend/.env` for Clerk configuration:

```env
CLERK_SECRET_KEY="sk_test_your_clerk_secret_key"
CLERK_PUBLISHABLE_KEY="pk_test_your_clerk_publishable_key"
CLERK_AUTHORIZED_PARTIES="http://localhost:5173"
# (Optional) CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\n..."
```

#### Frontend `.env` (`frontend/.env`)
Create `frontend/.env` for the React application:

```env
VITE_CLERK_PUBLISHABLE_KEY="pk_test_your_clerk_publishable_key"
VITE_API_BASE_URL="http://localhost:8000"
```

---

### 2. Backend Setup

```bash
# 1. Create and activate a Python virtual environment
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Initialize the Application Database Tables (database_connections & conversations)
python init_app_db.py
```

---

### 3. Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install frontend dependencies
npm install
```

---

## 🚀 Running the Application

### 1. Start the Backend API

```bash
# From the project root (with .venv active):
cd backend
uvicorn api:app --reload --port 8000
```
The FastAPI backend will start at `http://localhost:8000`. You can explore the interactive OpenAPI documentation at `http://localhost:8000/docs`.

### 2. Start the Frontend Dashboard

```bash
# In a separate terminal, navigate to the frontend directory:
cd frontend
npm run dev
```
The application will open at `http://localhost:5173`.

---

## 📡 API Endpoints Reference

All secured endpoints require the header:
```
Authorization: Bearer <clerk_session_token>
```

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/connect` | Connect and securely save a MySQL or PostgreSQL database. |
| `POST` | `/upload-sqlite` | Upload, validate (`PRAGMA quick_check`), and register a `.sqlite`/`.db` file. |
| `GET` | `/connections` | List all saved database connections for the authenticated user. |
| `GET` | `/tables?connection_id={id}` | List table names for the selected database. |
| `GET` | `/schema?connection_id={id}` | Retrieve full table and column schema dictionary. |
| `GET` | `/preview/{table_name}?connection_id={id}` | Preview up to 10 sample rows from a specific table. |
| `POST` | `/chat` | Execute a natural language question through the LangGraph agent. |
| `GET` | `/conversations` | List conversation histories for the authenticated user (paginated). |
| `GET` | `/conversations/{thread_id}/messages` | Retrieve full message history and database status for a thread. |
| `PATCH` | `/conversations/{thread_id}` | Rename a conversation title. |
| `DELETE` | `/conversations/{thread_id}` | Delete a conversation and purge its LangGraph checkpoint state. |

---

### API Usage Examples

#### 1. Upload SQLite Database (`POST /upload-sqlite`)
```bash
curl -X POST "http://localhost:8000/upload-sqlite" \
  -H "Authorization: Bearer <YOUR_CLERK_TOKEN>" \
  -F "file=@database/Chinook.sqlite"
```
**Response:**
```json
{
  "success": true,
  "connection_id": "b3f021ad-1a84-48f8-b613-2df82479e008",
  "message": "SQLite database uploaded and saved successfully."
}
```

#### 2. Connect Remote Database (`POST /connect`)
```bash
curl -X POST "http://localhost:8000/connect" \
  -H "Authorization: Bearer <YOUR_CLERK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "db_type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "postgres",
    "password": "yourpassword",
    "database": "sales_db"
  }'
```

#### 3. Execute Chat Query (`POST /chat`)
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Authorization: Bearer <YOUR_CLERK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the top 5 genres by total track count?",
    "connection_id": "b3f021ad-1a84-48f8-b613-2df82479e008",
    "thread_id": "0b15da07-9b43-41ea-bfcf-6d654b4231b4"
  }'
```

**Response:**
```json
{
  "thread_id": "0b15da07-9b43-41ea-bfcf-6d654b4231b4",
  "question": "What are the top 5 genres by total track count?",
  "sql": "SELECT Genre.Name, COUNT(Track.TrackId) AS TrackCount FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY Genre.Name ORDER BY TrackCount DESC LIMIT 5;",
  "result": [
    { "Name": "Rock", "TrackCount": 1297 },
    { "Name": "Latin", "TrackCount": 579 },
    { "Name": "Metal", "TrackCount": 374 },
    { "Name": "Alternative & Punk", "TrackCount": 332 },
    { "Name": "Jazz", "TrackCount": 130 }
  ],
  "answer": "The top 5 genres by total track count are Rock (1,297 tracks), Latin (579 tracks), Metal (374 tracks), Alternative & Punk (332 tracks), and Jazz (130 tracks).",
  "analysis": {
    "generate_chart": true,
    "chart_type": "bar",
    "generate_insights": true
  },
  "chart": {
    "type": "bar",
    "title": "TrackCount by Name",
    "x_label": "Name",
    "y_label": "TrackCount",
    "x": ["Rock", "Latin", "Metal", "Alternative & Punk", "Jazz"],
    "y": [1297, 579, 374, 332, 130]
  },
  "insights": "• Rock represents the dominant genre in the collection with over 1,200 tracks.\n• Latin holds second place with roughly half the catalog volume of Rock.\n• The top three genres collectively account for over 60% of the top 5 catalogue.",
  "messages": [ ... ]
}
```

---

## 🛡️ Error Handling & Two-Tier Self-Correction

The agent employs a resilient two-tier self-correction mechanism to guarantee safe and accurate query resolution:

1. **Safety & Syntax Verification (`validate_sql`)**:
   - Cleans backticks and markdown fences.
   - Rejects queries containing destructive keywords (`DROP`, `DELETE`, `UPDATE`, `INSERT`, etc.).
   - Ensures queries begin with a valid `SELECT` statement.
2. **Runtime Database Error Feedback (`execute_sql`)**:
   - If a query fails execution against the database engine (for example, column mismatch or SQL syntax error), the exception message is captured in `state["error"]`.
   - The workflow routes to `retry_node`, feeding the database schema, previous broken query, and the exact database error back into the LLM.
   - The LLM receives clear instructions to correct the syntax according to the specific dialect rules.
3. **Graceful Degradation (`failed_node`)**:
   - If a valid query cannot be produced within `MAX_RETRIES = 2`, the agent outputs a user-friendly explanation with details of the failure without crashing the service.

---

## 🔒 Security Best Practices

* **Read-Only Enforcement**: Blocks mutating and administrative SQL commands via regex and AST parsing.
* **Dialect Escaping**: Relies on SQLAlchemy URL composition and parameterized identifier inspection.
* **Encrypted Credentials**: All connection URLs and SQLite file paths are encrypted at rest with Fernet keys.
* **File Upload Protections**: Enforces maximum upload sizes (50 MiB) and performs a SQLite PRAGMA quick check to reject corrupt files.
* **Multi-Tenant Isolation**: Every database connection and chat conversation is scoped strictly to the authenticated Clerk user identity (`sub` claim).

---

## 🔮 Future Roadmap

* [ ] Add support for Microsoft SQL Server, Oracle, and Snowflake.
* [ ] Semantic schema indexing (vector embeddings) for large enterprise databases with hundreds of tables.
* [ ] PDF and CSV report export for charts and synthesized business insights.
* [ ] Fine-grained user role permissions and team-shared database connections.

---

## 👤 Author

Developed as an advanced Natural Language SQL Agent project using **Python**, **LangGraph**, **Groq**, **PostgreSQL**, and **React**.
