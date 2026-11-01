# Machine Learning Evaluation Report: Distributed Failure Root-Cause Diagnosis

## 1. Problem Statement & Mathematical Formulation

- **Task:** Multi-Class Supervised Classification on Telemetry Metrics
- **Total Dataset Samples:** 4200 (840 test holdout)
- **Classes (7):** AVAILABILITY_TRADEOFF, HEALTHY_STEADY_STATE, MISSING_TIMEOUT_CASCADE, NON_IDEMPOTENT_RETRY, OVERSENSITIVE_BREAKER, RETRY_STORM, UNBOUNDED_QUEUE

## 2. Model Performance Benchmark

| Model Architecture                     | Test Accuracy | Macro F1-Score | 5-Fold Cross Validation | Notes                                 |
| -------------------------------------- | ------------- | -------------- | ----------------------- | ------------------------------------- |
| **Baseline Decision Tree (CART)**      | 97.26%        | 97.24%         | N/A                     | Prone to overfitting on network noise |
| **Random Forest Ensemble (100 Trees)** | **98.69%**    | **98.69%**     | **98.60% (±0.45%)**     | **State of the Art (Low Variance)**   |

## 3. Feature Importance Analysis (Gini Impurity Contribution)

| Telemetry Feature       | Metric Description              | Gini Importance |
| ----------------------- | ------------------------------- | --------------- |
| `completion_rate`       | Distributed Telemetry Dimension | **16.69%**      |
| `breaker_open_fraction` | Distributed Telemetry Dimension | **16.23%**      |
| `duplicate_write_rate`  | Distributed Telemetry Dimension | **15.20%**      |
| `max_queue_depth`       | Distributed Telemetry Dimension | **13.11%**      |
| `p99_latency_ms`        | Distributed Telemetry Dimension | **12.99%**      |
| `retry_amplification`   | Distributed Telemetry Dimension | **8.89%**       |
| `worker_saturation`     | Distributed Telemetry Dimension | **7.30%**       |
| `p95_latency_ms`        | Distributed Telemetry Dimension | **7.08%**       |
| `p50_latency_ms`        | Distributed Telemetry Dimension | **2.50%**       |

## 4. Confusion Matrix (Test Set Holdout)

| Actual \ Predicted    | `AVAILABI` | `HEALTHY_` | `MISSING_` | `NON_IDEM` | `OVERSENS` | `RETRY_ST` | `UNBOUNDE` |
| --------------------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| **`AVAILABILITY_TR`** | 118        | 0          | 1          | 0          | 0          | 1          | 0          |
| **`HEALTHY_STEADY_`** | 0          | 120        | 0          | 0          | 0          | 0          | 0          |
| **`MISSING_TIMEOUT`** | 0          | 0          | 116        | 0          | 0          | 0          | 4          |
| **`NON_IDEMPOTENT_`** | 0          | 0          | 0          | 120        | 0          | 0          | 0          |
| **`OVERSENSITIVE_B`** | 1          | 0          | 0          | 0          | 119        | 0          | 0          |
| **`RETRY_STORM`**     | 0          | 0          | 0          | 0          | 0          | 120        | 0          |
| **`UNBOUNDED_QUEUE`** | 0          | 0          | 4          | 0          | 0          | 0          | 116        |
