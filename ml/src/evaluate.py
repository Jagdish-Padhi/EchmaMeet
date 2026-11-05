"""
Evaluation and Academic Metrics Report Generator
Produces a markdown summary of model performance, confusion matrix, and feature importances for college submission.
"""

import json
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    summary_path = os.path.join(base_dir, "models", "metrics_summary.json")

    if not os.path.exists(summary_path):
        print(f"Metrics summary not found at {summary_path}. Run train.py first.")
        sys.exit(1)

    with open(summary_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    classes = data["classes"]
    cm = data["confusion_matrix"]
    importances = data["feature_importances"]
    rf = data["random_forest_ensemble"]
    dt = data["baseline_decision_tree"]

    out = []
    out.append("# Machine Learning Evaluation Report: Distributed Failure Root-Cause Diagnosis")
    out.append("")
    out.append("## 1. Problem Statement & Mathematical Formulation")
    out.append("- **Task:** Multi-Class Supervised Classification on Telemetry Metrics")
    out.append(f"- **Total Dataset Samples:** {data['dataset_samples']} ({data['test_samples']} test holdout)")
    out.append(f"- **Classes ({len(classes)}):** {', '.join(classes)}")
    out.append("")
    out.append("## 2. Model Performance Benchmark")
    out.append("| Model Architecture | Test Accuracy | Macro F1-Score | 5-Fold Cross Validation | Notes |")
    out.append("|---|---|---|---|---|")
    out.append(f"| **Baseline Decision Tree (CART)** | {dt['accuracy']*100:.2f}% | {dt['macro_f1']*100:.2f}% | N/A | Prone to overfitting on network noise |")
    out.append(f"| **Random Forest Ensemble (100 Trees)** | **{rf['accuracy']*100:.2f}%** | **{rf['macro_f1']*100:.2f}%** | **{rf['cv_mean_accuracy']*100:.2f}% (±{rf['cv_std_accuracy']*100:.2f}%)** | **State of the Art (Low Variance)** |")
    out.append("")
    out.append("## 3. Feature Importance Analysis (Gini Impurity Contribution)")
    out.append("| Telemetry Feature | Metric Description | Gini Importance |")
    out.append("|---|---|---|")
    for feat in importances:
        out.append(f"| `{feat['feature']}` | Distributed Telemetry Dimension | **{feat['importance']*100:.2f}%** |")
    out.append("")
    out.append("## 4. Confusion Matrix (Test Set Holdout)")
    header = "| Actual \\ Predicted | " + " | ".join([f"`{c[:8]}`" for c in classes]) + " |"
    out.append(header)
    out.append("|---" * (len(classes) + 1) + "|")
    for i, row in enumerate(cm):
        row_str = f"| **`{classes[i][:15]}`** | " + " | ".join(str(val) for val in row) + " |"
        out.append(row_str)

    report_path = os.path.join(base_dir, "EVALUATION_REPORT.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

    print(f"Generated academic evaluation report at: {report_path}")
    print("\n" + "\n".join(out[:25]))

if __name__ == "__main__":
    main()
