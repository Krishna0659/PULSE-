import pandas as pd
import math
from datetime import date
from sklearn.ensemble import IsolationForest

def compute_ml_anomaly_score(history_df: pd.DataFrame, target_day: date):
    cols = [
        'velocity_7d_change_pct', 'ticket_size_stddev', 'refund_ratio',
        'repeat_customer_rate', 'new_customer_conc', 'failed_txn_ratio'
    ]
    
    target_row = history_df[history_df['day'] == target_day]
    if target_row.empty:
        return None
    
    df = history_df.copy()
    train_df = df[df['day'] < target_day].copy()
    train_df = train_df.dropna(subset=cols)
    
    if len(train_df) < 14:
        return None
        
    target_row = target_row.iloc[0]
    if target_row[cols].isna().any():
        return None
        
    clf = IsolationForest(contamination='auto', random_state=42)
    clf.fit(train_df[cols])
    
    target_df = pd.DataFrame([target_row[cols]])
    raw = float(clf.decision_function(target_df)[0])
    
    # FIXED sigmoid transform: maps raw ~0 to 0.5.
    # We tune the scaling constant to * 10 so healthy data stays ~0.3 - 0.6
    try:
        ml_score = 1.0 / (1.0 + math.exp(raw * 10.0))
    except OverflowError:
        ml_score = 0.0 if raw > 0 else 1.0
        
    return float(max(0.0, min(1.0, ml_score)))