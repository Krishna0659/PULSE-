# Pulse Backend API

All endpoints should be accessed through `gateway-svc` on Port 8000. Do not connect directly to the underlying microservices from the frontend.

## API Surface

| Method | Path | Proxies To | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/health/all` | (Gateway Aggregation) | No |
| `POST` | `/auth/signup` | `auth-svc` | No (Rate Limited) |
| `POST` | `/auth/login` | `auth-svc` | No (Rate Limited) |
| `GET` | `/auth/me` | `auth-svc` | Yes |
| `POST` | `/merchants` | `ingestion-svc` | Yes (Admin/Analyst) |
| `GET` | `/merchants` | `ingestion-svc` | Yes |
| `GET` | `/merchants/{id}` | `ingestion-svc` | Yes |
| `POST` | `/upload` | `ingestion-svc` | Yes |
| `POST` | `/simulate/start` | `ingestion-svc` | Yes (Admin) |
| `POST` | `/simulate/stop` | `ingestion-svc` | Yes (Admin) |
| `GET` | `/simulate/status/{id}` | `ingestion-svc` | Yes |
| `GET` | `/merchants/{id}/features` | `feature-svc` | Yes |
| `GET` | `/merchants/{id}/anomalies` | `anomaly-svc` | Yes |
| `POST` | `/merchants/{id}/analyze` | `anomaly-svc` | Yes |
| `GET` | `/merchants/{id}/alerts` | `explain-svc` | Yes |
| `POST` | `/merchants/{id}/explain` | `explain-svc` | Yes |
| `POST` | `/alerts/{id}/acknowledge`| `explain-svc` | Yes |
| `POST` | `/alerts/{id}/dismiss` | `explain-svc` | Yes |
| `GET` | `/audit/{entity_type}/{entity_id}` | (Gateway DB Query) | Yes |

### Endpoint Details

* **`POST /merchants/{id}/analyze`**: 
  * When called **without** a `?day=` parameter, the endpoint batch-backfills and scores all days in `features_daily` that do not yet have an existing score in `anomaly_scores`. It returns a summary of the batch operation.
  * When called **with** a `?day=YYYY-MM-DD` parameter, it specifically targets and scores that single day, returning the individual `anomaly_scores` row.

## Architecture & Infrastructure

- **gateway-svc** (8000): BFF / Routing Layer. Validates JWTs, handles rate-limiting, and aggregates health checks. Directly reads `audit_log`.
- **auth-svc** (8001): Issues JWTs and handles user management.
- **ingestion-svc** (8002): Ingests CSVs and runs Monte-Carlo simulation pipelines.
- **feature-svc** (8003): Computes rolling window features (CUSUM, z-scores) continuously.
- **anomaly-svc** (8004): Stratified anomaly detection (Statistical, ML Isolation Forest, and Rule-based routing).
- **explain-svc** (8005): Automates incident analysis using the Anthropic API.