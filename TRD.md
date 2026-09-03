# Technical Requirements Document (TRD)

**Project Name:** PULSE  
**Document Version:** 1.0  

---

## 1. Executive Summary
PULSE is an AI-powered merchant health monitoring platform. It ingests transaction data to compute statistical and machine-learning features, identifies anomalies (e.g., fraud rings, distress, breakouts), and utilizes an LLM (Anthropic Claude) to generate human-readable explanations and recommended actions for merchants.

---

## 2. System Architecture

The system follows an asynchronous, event-driven microservices architecture. The backend is split into five distinct, loosely coupled services communicating via HTTP/REST and orchestrated via an API Gateway.

### Microservices Overview:
1. **Gateway Service (`gateway-svc`)**: Acts as the single entry point for the frontend, routing requests to the appropriate downstream microservice.
2. **Auth Service (`auth-svc`)**: Handles user registration, phone-based OTP 2FA, JWT generation, and session validation using Redis.
3. **Ingestion Service (`ingestion-svc`)**: Manages CSV uploads and live transaction simulations (Monte Carlo), piping data into the pipeline.
4. **Feature Service (`feature-svc`)**: Responsible for feature engineering. It computes rolling metrics (velocity, ticket size, repeat rate, refund rate) required by the ML models.
5. **Anomaly Service (`anomaly-svc`)**: The machine learning layer. It applies statistical anomaly detection (Z-scores, CUSUM) and ML models (Isolation Forest) to classify the health of the trading day.
6. **Explain Service (`explain-svc`)**: Integrates with the Anthropic API (Claude) to convert raw ML features and classifications into a plain-English, auditable explanation and action plan.

---

## 3. Technology Stack

### 3.1 Frontend (Client Application)
- **Core Framework**: React 18
- **Routing**: React Router DOM (v6)
- **Styling**: Tailwind CSS (Utility-first CSS)
- **Animations**: Framer Motion (Scroll-linked animations, parallax effects, micro-interactions)
- **Data Visualization**: Recharts (for live anomaly engine and stream charts)
- **Icons**: Lucide React
- **Build Tool / Serving**: Nginx (used in production Docker container)

### 3.2 Backend (Microservices)
- **Language**: Python 3.9+
- **Framework**: FastAPI (High-performance, async REST framework)
- **Server**: Uvicorn (ASGI web server implementation)
- **Data Validation**: Pydantic
- **Machine Learning**: Scikit-Learn (Isolation Forest), Pandas, NumPy
- **LLM Integration**: Anthropic Python SDK (Claude API)
- **Authentication**: PyJWT, Passlib (Bcrypt hashing)

### 3.3 Databases & Infrastructure
- **Relational Database**: PostgreSQL (Stores users, merchants, transactions, and audit logs)
- **Database Driver**: `asyncpg` (Asynchronous PostgreSQL client for Python)
- **Cache & Session Management**: Redis (Stores active sessions, handles token revocation)
- **Redis Driver**: `redis.asyncio`
- **Containerization**: Docker, Docker Compose (for local orchestration and microservice networking)

---

## 4. Functional Requirements

### 4.1 Authentication & Security
- **REQ-1**: Merchants must register and authenticate via Phone Number, Password, and SMS OTP.
- **REQ-2**: The system must secure API routes using short-lived JWT access tokens.
- **REQ-3**: The system must enforce role-based access control (RBAC), distinguishing between `merchant`, `analyst`, and `admin`.

### 4.2 Data Ingestion
- **REQ-4**: The system must accept bulk historical transaction data via CSV upload (up to 50 MB).
- **REQ-5**: The system must support live Monte Carlo simulations mapping to 5 distinct merchant personas (healthy, declining, viral_growth, fraud_ring, seasonal).

### 4.3 Anomaly Detection & ML
- **REQ-6**: The system must calculate rolling statistical baselines using Z-scores and CUSUM algorithms.
- **REQ-7**: An Isolation Forest model must classify incoming transaction blocks into one of 5 severity states.

### 4.4 AI Explanations
- **REQ-8**: The Explain Service must pass the ML classification and trailing metrics to Claude.
- **REQ-9**: The LLM output must be constrained to a short, plain-English paragraph and exactly one bounded recommended action. (The system must *never* automate money movement).

---

## 5. Non-Functional Requirements

### 5.1 Performance & Scalability
- **PERF-1**: The API Gateway must process standard requests in under 100ms.
- **PERF-2**: Microservices must operate asynchronously to prevent I/O blocking during LLM generation (which can take 2-5 seconds).
- **SCAL-1**: Services must be stateless (outside of Redis sessions) to allow horizontal scaling via Docker replicas.

### 5.2 User Interface & Experience
- **UX-1**: The frontend must utilize an "Awwwards-level" premium design system, prioritizing dark mode, glassmorphism, dynamic cursor interactions, and layout stability.
- **UX-2**: Scroll-linked animations and pin-scroll storytelling must be hardware-accelerated for 60fps performance on modern browsers.

---

## 6. Development & Deployment Environments

- **Local Development**: Orchestrated entirely via `docker-compose.yml`, spinning up all 5 Python services, the React frontend, PostgreSQL, and Redis simultaneously.
- **Version Control**: Git / GitHub.
- **Environment Variables**: Managed via local `.env` files (e.g., `POSTGRES_USER`, `REDIS_URL`, `ANTHROPIC_API_KEY`).
