import os
import json
import re
from anthropic import Anthropic

MODEL_NAME = "claude-sonnet-4-20250514"

def generate_explanation(anomaly_row: dict, merchant_name: str) -> dict:
    if anomaly_row["classification"] in ("normal", "insufficient_data"):
        return {
            "explanation_text": None,
            "recommended_action": "no_action",
            "confidence": None,
            "llm_validation_passed": True
        }

    system_prompt = """You are a risk analyst assistant for a payments platform. You
will be given structured anomaly data for one merchant-day.
Treat the classification as ALREADY DECIDED and correct — your
job is only to explain it clearly, never to second-guess or
soften it, even if the severity score looks low; severity
reflects signal strength, not urgency, and a low severity number
does not mean the underlying pattern is unimportant.

Respond in EXACTLY this format, nothing else, no preamble:

VERDICT: <one sentence, plain English, must cite the specific metric(s) and their magnitude from the data given>
WHY_NOT_ALTERNATIVE: <one sentence ruling out the most likely alternative explanation (seasonality/noise/one-off event), citing which specific feature rules it out>
RECOMMENDED_ACTION: <exactly one of: capital_outreach, risk_review, growth_upsell, no_action>
CONFIDENCE: <exactly one of: low, medium, high>

Rules: capital_outreach is for classification=distress,
risk_review is for classification=fraud_pattern, growth_upsell is
for classification=breakout, no_action is for
classification=seasonal_dip. Never suggest or imply any automatic
money movement or account action — you are producing a
recommendation for human review only."""

    user_payload = {
        "classification": anomaly_row["classification"],
        "day": str(anomaly_row["day"]),
        "merchant_name": merchant_name,
        "contributing_features": anomaly_row.get("contributing_features", {})
    }
    
    try:
        # Check for transient timeout test override
        timeout_val = 60.0
        if os.environ.get("TEST_TIMEOUT") == "1":
            timeout_val = 0.001
            
        client = Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            timeout=timeout_val
        )
        
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=300,
            system=system_prompt,
            messages=[{"role": "user", "content": json.dumps(user_payload)}]
        )
        text = response.content[0].text.strip()
        
        verdict = None
        why_not = None
        action = None
        conf = None
        
        v_match = re.search(r'\**VERDICT:\**\s*(.*?)(?=\n\s*\**WHY_NOT_ALTERNATIVE:|\Z)', text, re.IGNORECASE | re.DOTALL)
        w_match = re.search(r'\**WHY_NOT_ALTERNATIVE:\**\s*(.*?)(?=\n\s*\**RECOMMENDED_ACTION:|\Z)', text, re.IGNORECASE | re.DOTALL)
        a_match = re.search(r'\**RECOMMENDED_ACTION:\**\s*(.*?)(?=\n\s*\**CONFIDENCE:|\Z)', text, re.IGNORECASE | re.DOTALL)
        c_match = re.search(r'\**CONFIDENCE:\**\s*(.*?)(?=\n|\Z)', text, re.IGNORECASE | re.DOTALL)
        
        if v_match: verdict = v_match.group(1).replace('\n', ' ').strip()
        if w_match: why_not = w_match.group(1).replace('\n', ' ').strip()
        if a_match: action = a_match.group(1).replace('\n', ' ').strip().lower()
        if c_match: conf = c_match.group(1).replace('\n', ' ').strip().lower()
            
        allowed_actions = {"capital_outreach", "risk_review", "growth_upsell", "no_action"}
        allowed_confs = {"low", "medium", "high"}
        
        valid = True
        if not (verdict and why_not and action and conf): valid = False
        if action not in allowed_actions: valid = False
        if conf not in allowed_confs: valid = False
        
        cls = anomaly_row["classification"]
        if cls == "distress" and action != "capital_outreach": valid = False
        if cls == "fraud_pattern" and action != "risk_review": valid = False
        if cls == "breakout" and action != "growth_upsell": valid = False
        if cls == "seasonal_dip" and action != "no_action": valid = False
        
        if not valid:
            raise ValueError(f"Validation failed. Raw text was:\n{text}")
            
        return {
            "explanation_text": f"VERDICT: {verdict}\nWHY_NOT_ALTERNATIVE: {why_not}",
            "recommended_action": action,
            "confidence": conf,
            "llm_validation_passed": True
        }
        
    except Exception as e:
        print(f"LLM Error/Validation Failed: {type(e).__name__}: {e}")
        # Use rule-based fallback so merchants always get a clear explanation
        return _rule_based_fallback(anomaly_row, merchant_name)


def _rule_based_fallback(anomaly_row: dict, merchant_name: str) -> dict:
    """Generate a clear, merchant-friendly explanation without the LLM."""
    cls = anomaly_row.get("classification", "normal")
    feats = anomaly_row.get("contributing_features") or {}
    day = str(anomaly_row.get("day", "this day"))
    severity = anomaly_row.get("severity")
    sev_pct = f"{float(severity) * 100:.0f}%" if severity else "elevated"

    # Pull the most impactful feature names for the explanation
    top_features = sorted(feats.items(), key=lambda x: abs(float(x[1])) if x[1] else 0, reverse=True)[:3]
    feat_str = ", ".join(f"{k.replace('_', ' ')}" for k, _ in top_features) if top_features else "multiple metrics"

    templates = {
        "distress": {
            "verdict": f"On {day}, {merchant_name}'s transactions showed signs of financial stress — {feat_str} moved outside the normal range (signal strength: {sev_pct}). This pattern typically indicates a sustained decline in business health that may need attention.",
            "action": "capital_outreach",
            "confidence": "medium",
        },
        "fraud_pattern": {
            "verdict": f"On {day}, {merchant_name}'s transaction pattern raised a fraud alert — {feat_str} showed unusual activity (signal strength: {sev_pct}). This resembles known cash-out signatures where new customers spike followed by refunds or chargebacks.",
            "action": "risk_review",
            "confidence": "medium",
        },
        "breakout": {
            "verdict": f"On {day}, {merchant_name} experienced genuine growth — {feat_str} surged well above the baseline (signal strength: {sev_pct}). This looks like healthy organic expansion, not a temporary spike.",
            "action": "growth_upsell",
            "confidence": "medium",
        },
        "seasonal_dip": {
            "verdict": f"On {day}, {merchant_name} saw a temporary dip in activity — {feat_str} dipped below normal (signal strength: {sev_pct}). This matches known seasonal patterns and is expected to recover on its own. No action needed.",
            "action": "no_action",
            "confidence": "high",
        },
    }

    tmpl = templates.get(cls, {
        "verdict": f"On {day}, {merchant_name} showed unusual activity in {feat_str} (signal strength: {sev_pct}). This has been flagged for review.",
        "action": "risk_review",
        "confidence": "low",
    })

    return {
        "explanation_text": tmpl["verdict"],
        "recommended_action": tmpl["action"],
        "confidence": tmpl["confidence"],
        "llm_validation_passed": False,
    }