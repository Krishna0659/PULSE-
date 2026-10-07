# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Independent merchants who self-onboard to monitor their own business health. They are non-technical operators — shopkeepers, SME founders, D2C sellers — who upload or stream transaction data and rely on Pulse to tell them when something is wrong, why, and what to do. Secondary users are analysts and admins inside the Pulse team who monitor the full merchant portfolio, create merchant accounts, and validate alerts.

## Product Purpose

Pulse is an AI-powered merchant health monitoring platform. It ingests transaction data (CSV upload or live simulation), computes rolling statistical and ML features, classifies each trading day as healthy, declining, growing virally, running a fraud ring, or seasonal, and surfaces a plain-English explanation with one bounded recommended action. The merchant never needs to interpret a model — Pulse gives a verdict with evidence and a next step.

## Positioning

Pulse watches the *shape* of trading behaviour — velocity, ticket size, repeat-customer rate, refund rate — rather than just daily totals. This lets it flag a turn weeks before it shows on a standard dashboard, and distinguish a real breakout from a fraud ring when both look like revenue growth. It recommends, never moves money: every alert requires a human decision.

## Operating Context

- Pre-launch / MVP stage: actively preparing for first real external merchants.
- Merchants self-onboard: sign up, verify phone via SMS OTP, upload a CSV or run a simulation, then watch their dashboard.
- Analysts and admins access a broader view of all merchants in the system.
- The system runs as a local microservices stack (5 Python FastAPI services + React frontend) today; Docker Compose for production.
- Audit trail is a first-class feature: every action is logged and visible per entity.

## Capabilities and Constraints

- Auth: phone-number + password + SMS OTP 2FA; JWT sessions; logout with Redis revocation.
- Data ingestion: CSV upload (max 50 MB) or Monte Carlo simulation (5 personas: healthy, declining, viral_growth, fraud_ring, seasonal).
- Detection: statistical z-scores + CUSUM + IsolationForest ML + rule-based classifier → single 0–1 severity score + classification label.
- Explanation: Anthropic Claude generates a short auditable paragraph citing the specific features that drove the verdict.
- Recommendations: one of four bounded actions (no automatic money movement).
- Full audit log per merchant, alert, anomaly score, and transaction.
- Public registration restricted to the 'merchant' role; analyst/admin accounts require admin creation.

## Brand Commitments

Product name: **Pulse**. Voice is confident, direct, and plain — no jargon, no hedging. Alerts explain themselves in language a merchant can read and trust, not log files.

## Evidence on Hand

- Full working backend codebase (5 FastAPI microservices).
- React frontend with Tailwind CSS, Framer Motion, Recharts, Lucide icons.
- Pages: Home (landing), HowToUse, ResearchReport, auth (Signup/Login/ForgotPassword), Dashboard.
- No real customer testimonials or case studies yet (pre-launch). Do not fabricate them.

## Product Principles

1. **Verdict over data** — every output is a decision aid, not a raw metric.
2. **Explainability is the product** — the why is as important as the what.
3. **Recommend, never act** — Pulse proposes; humans decide.
4. **Early, not reactive** — signal weeks before a dashboard would show it.
5. **Trust through transparency** — every score has an audit trail a user can open and follow.

## Accessibility & Inclusion

No specific accessibility requirement established yet. Target standard WCAG 2.1 AA as baseline.