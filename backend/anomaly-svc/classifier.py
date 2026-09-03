from datetime import date

def is_known_seasonal_period(target_day: date) -> bool:
    # Hackathon stub: in production this would pull from a real holiday API
    # 2026 simulated data: Diwali approx Nov 8, plus some standard GST deadlines
    known_dates = [
        date(2026, 11, 8),
        date(2026, 10, 20),
        date(2026, 9, 20),
        date(2026, 8, 20)
    ]
    for kd in known_dates:
        if abs((target_day - kd).days) <= 2:
            return True
    return False

def classify(zscores: dict, sustained_flags: dict, cusum: dict, ml_score, days_of_history: int, target_day: date) -> dict:
    if days_of_history < 14:
        return {
            "classification": "insufficient_data",
            "severity": 0.0,
            "reasoning": "fewer than 14 days of history"
        }

    z_ncc = zscores.get("new_customer_conc")
    z_rcr = zscores.get("repeat_customer_rate")
    z_tss = zscores.get("ticket_size_stddev")

    # Priority 1: Fraud Pattern
    if (sustained_flags.get("new_customer_conc") is True and
        z_ncc is not None and z_ncc > 2 and
        z_rcr is not None and z_rcr < -1.5 and
        z_tss is not None and z_tss > 1.5):
        classification = "fraud_pattern"
        reasoning = "sustained_flags.new_customer_conc=True, z_ncc>2, z_rcr<-1.5, z_tss>1.5"

    # Priority 2: Distress (ML override removed, explicit seasonal check added)
    elif cusum.get("distress_flag") is True:
        if is_known_seasonal_period(target_day):
            classification = "seasonal_dip"
            reasoning = "cusum.distress_flag=True, but matches is_known_seasonal_period"
        else:
            classification = "distress"
            reasoning = "cusum.distress_flag=True"

    # Priority 3: Breakout
    elif cusum.get("breakout_flag") is True and sustained_flags.get("repeat_customer_rate") is not True:
        classification = "breakout"
        reasoning = "cusum.breakout_flag=True, sustained_flags.repeat_customer_rate!=True"

    # Priority 4: ML-based Fallback Distress
    elif ml_score is not None and ml_score > 0.7:
        classification = "distress"
        reasoning = f"anomalous by ML score ({ml_score:.3f}>0.7), no clear statistical pattern matched, recommend human review"

    # Fallback: Normal
    else:
        classification = "normal"
        reasoning = "no anomalous patterns detected"

    if classification in ("normal", "insufficient_data"):
        severity = 0.0
    else:
        flag_ratio = sum(1 for v in sustained_flags.values() if v is True) / len(sustained_flags) if sustained_flags else 0.0
        ml_val = ml_score if ml_score is not None else 0.5
        sev = (ml_val + flag_ratio) / 2.0
        
        # 50% severity reduction for known seasonal_dip
        if classification == "seasonal_dip":
            sev *= 0.5
            
        severity = max(0.0, min(1.0, sev))

    return {
        "classification": classification,
        "severity": float(severity),
        "reasoning": reasoning
    }