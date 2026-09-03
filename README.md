# ⚡ PULSE

**AI-powered Merchant Health Monitoring Platform**

Pulse watches the *shape* of trading behaviour — velocity, ticket size, repeat-customer rate, refund rate — rather than just daily totals. It flags a turn weeks before it shows on a standard dashboard, distinguishing a real breakout from a fraud ring when both look like revenue growth. 

It recommends, never moves money: every alert requires a human decision.

---

## 🎯 What it Serves

Independent merchants who self-onboard to monitor their own business health. They are non-technical operators — shopkeepers, SME founders, D2C sellers — who upload or stream transaction data and rely on Pulse to tell them when something is wrong, why, and what to do.

### Key Principles
- **Verdict over data**: Every output is a decision aid, not a raw metric.
- **Explainability is the product**: The *why* is as important as the *what*.
- **Recommend, never act**: Pulse proposes; humans decide.
- **Early, not reactive**: Signal weeks before a dashboard would show it.
- **Trust through transparency**: Every score has an audit trail a user can open and follow.

---

## 🏗️ Architecture

Pulse is built on a robust, asynchronous microservice architecture using React, Python FastAPI, PostgreSQL, and Redis.

```mermaid
graph TD
    Client([Client Browser]) --> |HTTP / React| FE[Frontend Application]
    FE --> |REST API| GW[API Gateway Service]
    
    GW --> Auth[Auth Service]
    GW --> Ingest[Ingestion Service]
    GW --> Feature[Feature Service]
    GW --> Anomaly[Anomaly Service]
    GW --> Explain[Explain Service]
    
    Ingest --> DB[(PostgreSQL)]
    Auth --> DB
    Feature --> DB
    Anomaly --> DB
    Explain --> DB
    
    Auth -.-> |Sessions| Cache[(Redis Cache)]
```

---

## 🧭 How it Works

Pulse abstracts away complex machine learning models into simple, actionable insights. Here is the lifecycle of a merchant's data inside Pulse:

```mermaid
sequenceDiagram
    participant M as Merchant
    participant P as Pulse Platform
    participant ML as Anomaly Engine
    participant AI as Claude LLM
    
    M->>P: 1. Sign up & Verify (OTP 2FA)
    M->>P: 2. Upload CSV / Start Live Simulation
    P->>P: 3. Compute Statistical Features
    P->>ML: 4. Analyze Data (IsolationForest, Z-Scores)
    ML-->>P: 5. Classify (Healthy, Viral, Fraud, Distress, Seasonal)
    P->>AI: 6. Generate Plain-English Explanation
    AI-->>P: 7. Verdict & Recommended Action
    P-->>M: 8. Dashboard Alert & Audit Trail
```

---

## 🚀 Getting Started

The easiest way to run the entire Pulse stack locally is using **Docker Compose**.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed
- Make sure ports `3000` (Frontend), `8000-8005` (Backend services), `5432` (PostgreSQL), and `6379` (Redis) are available on your host machine.

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Krishna0659/PULSE-.git
   cd PULSE-
   ```

2. **Set up environment variables:**
   Copy the example environment files for the backend.
   ```bash
   cd backend
   cp .env.example .env
   ```
   > **Note:** Make sure to open the `.env` file and add your `ANTHROPIC_API_KEY` to enable the Explain Service!

3. **Start the stack using Docker Compose:**
   Navigate back to the project root and spin up the containers:
   ```bash
   cd ..
   docker-compose up --build -d
   ```
   *This process might take a few minutes the first time as it builds the Docker images.*

4. **Access the application:**
   - **Frontend UI:** [http://localhost:3000](http://localhost:3000)
   - **API Gateway:** [http://localhost:8000](http://localhost:8000)

5. **Stop the stack:**
   When you're finished, you can gracefully stop the containers:
   ```bash
   docker-compose down
   ```

---

## 📂 Repository Structure

- `/frontend` - React, Tailwind CSS, Framer Motion, Recharts
- `/backend` - Python FastAPI Microservices
  - `/auth-svc` - Authentication, Phone OTP, Session Management
  - `/ingestion-svc` - CSV Parsing & Transaction Simulation
  - `/feature-svc` - Feature engineering & metric computation
  - `/anomaly-svc` - ML Classification (IsolationForest, CUSUM)
  - `/explain-svc` - LLM-powered explanations (Anthropic Claude)
  - `/gateway-svc` - Unified API Gateway routing requests
- `docker-compose.yml` - Container orchestration for local development
