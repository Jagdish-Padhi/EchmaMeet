"""
Inference CLI for ChaosBoard Root-Cause Failure Diagnosis
Loads the trained Random Forest model and predicts the failure mode from telemetry.
"""

import argparse
import json
import os
import sys
import numpy as np
import joblib

FEATURE_NAMES = [
    "p50_latency_ms",
    "p95_latency_ms",
    "p99_latency_ms",
    "completion_rate",
    "retry_amplification",
    "worker_saturation",
    "max_queue_depth",
    "duplicate_write_rate",
    "breaker_open_fraction",
]

POLICY_RECOMMENDATIONS = {
    "HEALTHY_STEADY_STATE": "No mitigation needed. System operating within acceptable SLA envelopes.",
    "RETRY_STORM": "Add exponential backoff with full jitter (e.g., base=100ms, max=2000ms) and cap retry attempts to 1-2.",
    "MISSING_TIMEOUT_CASCADE": "Set strict bounded upstream timeout (e.g., 500ms) to unpin worker threads before cascade propagates.",
    "UNBOUNDED_QUEUE": "Configure bounded queue capacity with drop-tail or drop-head backpressure policy.",
    "NON_IDEMPOTENT_RETRY": "Enforce idempotency keys and deduplication cache on mutating endpoints.",
    "OVERSENSITIVE_BREAKER": "Relax circuit breaker sensitivity: increase failure threshold percentage and expand observation window.",
    "AVAILABILITY_TRADEOFF": "Enable fallback cache / graceful degradation for partitioned downstream dependency.",
}

def predict(metrics_dict, model_path=None):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if model_path is None:
        pkl_path = os.path.join(base_dir, "models", "random_forest_model.pkl")
        joblib_path = os.path.join(base_dir, "models", "random_forest_model.joblib")
        model_path = pkl_path if os.path.exists(pkl_path) else joblib_path

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}. Run train.py first.")

    if model_path.endswith(".pkl"):
        import pickle
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    else:
        model = joblib.load(model_path)

    # Format DataFrame with feature names
    import pandas as pd
    vector = [float(metrics_dict.get(feat, 0.0)) for feat in FEATURE_NAMES]
    X = pd.DataFrame([vector], columns=FEATURE_NAMES)

    pred_class = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]
    classes = model.classes_

    prob_dict = {cls: float(round(prob, 4)) for cls, prob in zip(classes, probabilities)}
    confidence = float(round(np.max(probabilities), 4))
    recommended_policy = POLICY_RECOMMENDATIONS.get(pred_class, "Investigate service logs.")

    # Top contributing features for this prediction
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    top_features = [
        {"feature": FEATURE_NAMES[i], "importance": float(round(importances[i], 4)), "value": vector[i]}
        for i in sorted_idx[:4]
    ]

    return {
        "predicted_root_cause": pred_class,
        "confidence": confidence,
        "probabilities": prob_dict,
        "recommended_policy": recommended_policy,
        "top_contributing_metrics": top_features,
    }

def main():
    parser = argparse.ArgumentParser(description="Predict root-cause failure from chaos telemetry")
    parser.add_argument("--json", type=str, help="JSON string containing feature metrics")
    parser.add_argument("--p50", type=float, default=25.0)
    parser.add_argument("--p95", type=float, default=55.0)
    parser.add_argument("--p99", type=float, default=85.0)
    parser.add_argument("--completion", type=float, default=1.0)
    parser.add_argument("--retry-amp", type=float, default=1.0)
    parser.add_argument("--saturation", type=float, default=0.3)
    parser.add_argument("--queue-depth", type=int, default=5)
    parser.add_argument("--dup-rate", type=float, default=0.0)
    parser.add_argument("--breaker-open", type=float, default=0.0)

    args = parser.parse_args()

    if args.json:
        metrics = json.loads(args.json)
    else:
        metrics = {
            "p50_latency_ms": args.p50,
            "p95_latency_ms": args.p95,
            "p99_latency_ms": args.p99,
            "completion_rate": args.completion,
            "retry_amplification": args.retry_amp,
            "worker_saturation": args.saturation,
            "max_queue_depth": args.queue_depth,
            "duplicate_write_rate": args.dup_rate,
            "breaker_open_fraction": args.breaker_open,
        }

    result = predict(metrics)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
