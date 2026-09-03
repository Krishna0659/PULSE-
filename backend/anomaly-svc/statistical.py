import pandas as pd
import numpy as np
from datetime import date

def compute_zscores(history_df: pd.DataFrame, target_day: date) -> dict:
    features = [
        'velocity_7d_avg', 'avg_ticket_size', 'ticket_size_stddev',
        'refund_ratio', 'chargeback_ratio', 'repeat_customer_rate',
        'new_customer_conc', 'failed_txn_ratio'
    ]
    res = {}
    
    # Locate target row
    target_row = history_df[history_df['day'] == target_day]
    if target_row.empty:
        return {f: None for f in features}
    target_row = target_row.iloc[0]

    # Baseline is everything strictly before target_day, up to 90 days back
    baseline_df = history_df[history_df['day'] < target_day].tail(90)

    for f in features:
        if f not in baseline_df.columns:
            res[f] = None
            continue
            
        valid_vals = baseline_df[f].dropna()
        if len(valid_vals) < 14:
            res[f] = None
            continue
            
        stddev = valid_vals.std(ddof=1)
        if pd.isna(stddev) or stddev == 0:
            res[f] = None
            continue
            
        target_val = target_row.get(f)
        if pd.isna(target_val) or target_val is None:
            res[f] = None
            continue
            
        mean = valid_vals.mean()
        z = (float(target_val) - float(mean)) / float(stddev)
        res[f] = float(z)

    return res

def compute_sustained_flags(zscore_history: list[dict], target_day_index: int) -> dict:
    features = [
        'velocity_7d_avg', 'avg_ticket_size', 'ticket_size_stddev',
        'refund_ratio', 'chargeback_ratio', 'repeat_customer_rate',
        'new_customer_conc', 'failed_txn_ratio'
    ]
    flags = {}
    for f in features:
        flags[f] = False
        
        # We need at least 3 days to check for sustained flags
        if len(zscore_history) < 3:
            continue
            
        z0 = zscore_history[-3].get(f)
        z1 = zscore_history[-2].get(f)
        z2 = zscore_history[-1].get(f)
        
        if z0 is None or z1 is None or z2 is None:
            continue
            
        # Check |z| > 2 for all 3 days
        if abs(z0) > 2 and abs(z1) > 2 and abs(z2) > 2:
            # Check same sign
            if (z0 > 0 and z1 > 0 and z2 > 0) or (z0 < 0 and z1 < 0 and z2 < 0):
                flags[f] = True
                
    return flags

def compute_cusum(history_df: pd.DataFrame, target_day: date) -> dict:
    # CUSUM needs raw daily signal (txn_count)
    df = history_df[history_df['day'] <= target_day].copy()
    df = df.sort_values('day')
    
    if len(df) < 14:
        return {
            "mu0": None, "sigma0": None, "k": None, "h": None,
            "c_pos": None, "c_neg": None,
            "distress_flag": None, "breakout_flag": None
        }
        
    baseline = df.iloc[:14]
    mu0 = baseline['txn_count'].mean()
    sigma0 = baseline['txn_count'].std(ddof=1)
    
    if pd.isna(sigma0):
        sigma0 = 0.0
        
    k = 0.5 * sigma0
    h = 5.0 * sigma0
    
    c_pos = 0.0
    c_neg = 0.0
    
    # Walk forward from the end of the baseline period (index 14 onwards)
    walk_df = df.iloc[14:]
    for idx, row in walk_df.iterrows():
        val = float(row['txn_count'])
        c_pos = max(0.0, c_pos + (val - mu0 - k))
        c_neg = min(0.0, c_neg + (val - mu0 + k))
        
    distress_flag = bool(c_neg < -h)
    breakout_flag = bool(c_pos > h)
    
    return {
        "mu0": float(mu0) if pd.notna(mu0) else None,
        "sigma0": float(sigma0),
        "k": float(k),
        "h": float(h),
        "c_pos": float(c_pos),
        "c_neg": float(c_neg),
        "distress_flag": distress_flag,
        "breakout_flag": breakout_flag
    }