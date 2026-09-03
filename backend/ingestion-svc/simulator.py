import numpy as np
from datetime import date, datetime, timedelta, timezone

def generate(merchant_id: str, start_date: date, days: int, persona: str, seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    txns = []

    payment_methods = ['upi', 'card', 'netbanking', 'wallet']
    pm_weights = [0.5, 0.3, 0.1, 0.1]

    base_pool = [f"base_cust_{i}" for i in range(15)]
    
    # Pre-calculate persona properties
    viral_jump_day = -1
    viral_mult = 1.0
    if persona == 'viral_growth':
        viral_jump_day = rng.integers(5, max(6, days - 10))
        viral_mult = rng.uniform(3.0, 10.0)
        
    fraud_spike_day = -1
    if persona == 'fraud_ring':
        fraud_spike_day = rng.integers(5, max(6, days - 10))
        
    seasonal_dip_start = -1
    if persona == 'seasonal':
        seasonal_dip_start = rng.integers(10, max(11, days - 10))
        
    fraud_new_custs = []
    
    # Force the start_date to UTC midnight
    current_date = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)

    for day_idx in range(days):
        day_mean = 40.0 * (1.001 ** day_idx)  # healthy base trend
        
        if persona == 'declining':
            day_mean *= (0.985 ** day_idx)
            
        if persona == 'viral_growth' and day_idx >= viral_jump_day:
            day_mean *= viral_mult
            
        if persona == 'seasonal':
            if seasonal_dip_start <= day_idx < seasonal_dip_start + 5:
                day_mean *= 0.70
                
        is_fraud_spike = False
        if persona == 'fraud_ring' and fraud_spike_day <= day_idx < fraud_spike_day + 3:
            day_mean *= rng.uniform(5.0, 8.0)
            is_fraud_spike = True
            
        num_txns = rng.poisson(day_mean)
        
        for _ in range(num_txns):
            # Spread transactions across the day
            sec_offset = rng.integers(0, 86400)
            ts = current_date + timedelta(seconds=int(sec_offset))
            
            status = 'success'
            if rng.random() < 0.03: # 3% natural refund rate
                status = 'refunded'
            elif rng.random() < 0.05: # 5% failed
                status = 'failed'
                
            pm = rng.choice(payment_methods, p=pm_weights)
            
            if is_fraud_spike:
                amt = float(rng.choice([500, 1000, 2000])) + rng.uniform(-5.0, 5.0)
                cust_id = f"fraud_cust_{rng.integers(1000000, 9999999)}"
                fraud_new_custs.append(cust_id)
            else:
                amt = rng.lognormal(mean=6.5, sigma=0.5) # mean ~ 800
                if rng.random() < 0.4:
                    cust_id = rng.choice(base_pool)
                else:
                    cust_id = f"cust_{rng.integers(100000, 999999)}"
                    
            amt = max(0.01, round(float(amt), 2))
            
            txns.append({
                'merchant_id': merchant_id,
                'ts': ts,
                'amount': amt,
                'status': status,
                'payment_method': pm,
                'customer_id': cust_id,
                'currency': 'INR',
                'is_refund': (status == 'refunded'),
                'source': 'simulator'
            })
            
        # Fraud cash-out 3-5 days after spike starts
        if persona == 'fraud_ring' and (fraud_spike_day + 3) <= day_idx <= (fraud_spike_day + 5):
            num_cashouts = int(len(fraud_new_custs) * 0.4 / 3.0) 
            if num_cashouts > 0 and len(fraud_new_custs) > 0:
                for _ in range(num_cashouts):
                    sec_offset = rng.integers(0, 86400)
                    ts = current_date + timedelta(seconds=int(sec_offset))
                    cust_id = rng.choice(fraud_new_custs)
                    status = rng.choice(['refunded', 'chargeback'], p=[0.3, 0.7])
                    amt = float(rng.choice([500, 1000, 2000])) + rng.uniform(-5.0, 5.0)
                    amt = max(0.01, round(amt, 2))
                    pm = rng.choice(payment_methods, p=pm_weights)
                    txns.append({
                        'merchant_id': merchant_id,
                        'ts': ts,
                        'amount': amt,
                        'status': status,
                        'payment_method': pm,
                        'customer_id': cust_id,
                        'currency': 'INR',
                        'is_refund': (status == 'refunded'),
                        'source': 'simulator'
                    })
        
        current_date += timedelta(days=1)
        
    txns.sort(key=lambda x: x['ts'])
    return txns