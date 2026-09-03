// Shared domain constants derived directly from the Pulse backend schema
// (db/migrations/001_init.sql + anomaly-svc/classifier + explain-svc).

// Anomaly classifications — exact enum from anomaly_scores.classification
export const CLASSIFICATIONS = {
  normal: {
    label: "Normal",
    color: "#0E76FF",
    tone: "cobalt",
    blurb: "Behaviour is inside the learned baseline. No action needed.",
  },
  breakout: {
    label: "Breakout",
    color: "#00E676",
    tone: "safe",
    blurb: "Sustained, healthy growth beyond baseline — a genuine expansion.",
  },
  distress: {
    label: "Distress",
    color: "#FFB300",
    tone: "caution",
    blurb: "A quiet, sustained decline — volume and repeat customers slipping.",
  },
  fraud_pattern: {
    label: "Fraud Pattern",
    color: "#F44336",
    tone: "critical",
    blurb: "New-customer spike followed by refunds/chargebacks — a cash-out signature.",
  },
  seasonal_dip: {
    label: "Seasonal Dip",
    color: "#64D2C9",
    tone: "seasonal",
    blurb: "A dip that matches known seasonal rhythm — expected, not a threat.",
  },
  insufficient_data: {
    label: "Insufficient Data",
    color: "#6B7280",
    tone: "grey",
    blurb: "Not enough history yet to judge. Keep the data flowing.",
  },
};

export const classificationMeta = (c) =>
  CLASSIFICATIONS[c] || CLASSIFICATIONS.insufficient_data;

// Recommended actions — exact enum from alerts.recommended_action
export const ACTIONS = {
  capital_outreach: { label: "Capital Outreach", color: "#FFB300" },
  risk_review: { label: "Risk Review", color: "#F44336" },
  growth_upsell: { label: "Growth Upsell", color: "#00E676" },
  no_action: { label: "No Action", color: "#6B7280" },
};

export const actionMeta = (a) => ACTIONS[a] || ACTIONS.no_action;

// Simulator personas — exact set validated in ingestion-svc
export const PERSONAS = [
  { id: "healthy", label: "Healthy", desc: "Steady baseline with a gentle upward drift." },
  { id: "declining", label: "Declining", desc: "A slow, compounding fade in daily volume." },
  { id: "viral_growth", label: "Viral Growth", desc: "A sudden multi-fold jump that sustains." },
  { id: "fraud_ring", label: "Fraud Ring", desc: "New-customer spike, then a refund/chargeback cash-out." },
  { id: "seasonal", label: "Seasonal", desc: "A temporary dip that recovers on its own." },
];

export const ROLES = [
  { id: "merchant", label: "Merchant", desc: "See only your own business — plain-English alerts." },
  { id: "analyst", label: "Risk / Capital Analyst", desc: "Multi-merchant matrix, patterns, full audit trail." },
  { id: "admin", label: "Admin", desc: "Full platform access and merchant management." },
];

export const ALERT_STATUS = {
  open: { label: "Open", color: "#0E76FF" },
  acknowledged: { label: "Acknowledged", color: "#00E676" },
  dismissed: { label: "Dismissed", color: "#6B7280" },
  actioned: { label: "Actioned", color: "#FFB300" },
};
