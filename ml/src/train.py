"""
ChaosBoard Machine Learning Training Pipeline
Models compared:
  1. Logistic Regression (Baseline Linear Model)
  2. Decision Tree (CART Baseline)
  3. Random Forest (Ensemble Learning - Production Model)

Saves:
  - random_forest_model.pkl (Standard Python Pickle)
  - random_forest_model.joblib
  - confusion_matrix.png (High-Res Heatmap)
  - feature_importance.png (Bar Chart)
  - model_comparison.png (Benchmark Comparison)
  - random_forest_exported.json & trained-model-data.ts (Zero-dependency Runtime)
"""

import json
import os
import pickle
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless execution
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier, _tree
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
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

TARGET_COLUMN = "root_cause"

def export_tree(tree, feature_names):
    """Serialize a single scikit-learn DecisionTreeClassifier tree to a JSON-serializable dictionary."""
    tree_ = tree.tree_
    def recurse(node):
        if tree_.feature[node] != _tree.TREE_UNDEFINED:
            name = feature_names[tree_.feature[node]]
            threshold = float(round(tree_.threshold[node], 4))
            left = recurse(tree_.children_left[node])
            right = recurse(tree_.children_right[node])
            return {
                "type": "split",
                "feature": name,
                "threshold": threshold,
                "left": left,
                "right": right,
            }
        else:
            value = tree_.value[node][0]
            class_idx = int(np.argmax(value))
            probabilities = [float(round(v, 4)) for v in (value / np.sum(value))]
            return {
                "type": "leaf",
                "class_idx": class_idx,
                "probabilities": probabilities,
            }
    return recurse(0)

def export_random_forest(rf_model, feature_names, class_names):
    """Serialize the entire Random Forest ensemble to JSON for lightweight zero-dependency TypeScript inference."""
    trees = [export_tree(estimator, feature_names) for estimator in rf_model.estimators_]
    return {
        "model_type": "RandomForestClassifier",
        "n_estimators": len(trees),
        "features": feature_names,
        "classes": list(class_names),
        "trees": trees,
    }

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, "data", "chaos_telemetry.csv")
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Run generate_dataset.py first.")
        sys.exit(1)

    print("=================================================================")
    print("      CHAOSBOARD ML ROOT-CAUSE FAILURE DIAGNOSIS PIPELINE         ")
    print("=================================================================")
    print(f"[1/7] Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)
    print(f"      Total records: {len(df)} | Features: {len(FEATURE_NAMES)} | Classes: {df[TARGET_COLUMN].nunique()}")

    X = df[FEATURE_NAMES]
    y = df[TARGET_COLUMN]
    class_names = sorted(list(y.unique()))

    # Stratified 80/20 train/test split
    print("\n[2/7] Splitting data: 80% Training, 20% Testing (Stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"      Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # Standard scaling for linear models
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Baseline Model 1: Logistic Regression
    print("\n[3/7] Training Model 1: Multinomial Logistic Regression (Linear Baseline)...")
    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(X_train_scaled, y_train)
    y_pred_lr = lr_model.predict(X_test_scaled)
    acc_lr = accuracy_score(y_test, y_pred_lr)
    f1_lr = f1_score(y_test, y_pred_lr, average="macro")
    print(f"      Logistic Regression -> Test Accuracy: {acc_lr*100:.2f}% | Macro F1-Score: {f1_lr*100:.2f}%")

    # 2. Baseline Model 2: Single Decision Tree
    print("\n[4/7] Training Model 2: Single Decision Tree Classifier (CART Baseline)...")
    dt_baseline = DecisionTreeClassifier(max_depth=8, min_samples_leaf=3, random_state=42)
    dt_baseline.fit(X_train, y_train)
    y_pred_dt = dt_baseline.predict(X_test)
    acc_dt = accuracy_score(y_test, y_pred_dt)
    f1_dt = f1_score(y_test, y_pred_dt, average="macro")
    print(f"      Single Decision Tree -> Test Accuracy: {acc_dt*100:.2f}% | Macro F1-Score: {f1_dt*100:.2f}%")

    # 3. Production Model: Random Forest Ensemble
    print("\n[5/7] Training Model 3: Random Forest Ensemble (100 Estimators)...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=1,
    )
    
    # 5-Fold Stratified Cross Validation on Training Set
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf_model, X_train, y_train, cv=cv, scoring="accuracy", n_jobs=1)
    print(f"      5-Fold Cross-Validation Accuracy: {cv_scores.mean()*100:.2f}% (+/- {cv_scores.std()*100:.2f}%)")

    # Fit on full training set and evaluate on unseen holdout test set
    rf_model.fit(X_train, y_train)
    y_pred_rf = rf_model.predict(X_test)
    acc_rf = accuracy_score(y_test, y_pred_rf)
    f1_rf = f1_score(y_test, y_pred_rf, average="macro")
    print(f"      Random Forest Ensemble  -> Test Accuracy: {acc_rf*100:.2f}% | Macro F1-Score: {f1_rf*100:.2f}%")
    print(f"      -> Improvement over Linear Logistic Regression: +{(acc_rf - acc_lr)*100:.2f}%")
    print(f"      -> Improvement over Single Decision Tree       : +{(acc_rf - acc_dt)*100:.2f}%")

    # Classification Report
    print("\n[6/7] Classification Report on Unseen Holdout Test Set:")
    report_str = classification_report(y_test, y_pred_rf, digits=4)
    print(report_str)

    # Feature Importance (Gini Impurity)
    importances = rf_model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    feature_ranking = []
    print("\n[Feature Importance - Gini Impurity Metric Contribution]:")
    for idx in sorted_idx:
        feat = FEATURE_NAMES[idx]
        val = importances[idx]
        feature_ranking.append({"feature": feat, "importance": float(round(val, 4))})
        print(f"      - {feat:<25}: {val*100:.2f}%")

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred_rf, labels=class_names)

    # Generate Visualizations (PNG plots for college report)
    print("\n[7/7] Generating Visualization Plots (PNG) for Academic Report...")

    # Plot 1: Confusion Matrix Heatmap
    plt.figure(figsize=(9, 7))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=[c.replace("_", "\n") for c in class_names],
        yticklabels=[c.replace("_", "\n") for c in class_names],
        cbar=True,
    )
    plt.title("Chaos Telemetry Failure Root-Cause Confusion Matrix\n(Random Forest Ensemble, Test Set N=840)", fontsize=12, pad=15)
    plt.xlabel("Predicted Class", fontsize=11)
    plt.ylabel("True Class", fontsize=11)
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()
    cm_plot_path = os.path.join(models_dir, "confusion_matrix.png")
    plt.savefig(cm_plot_path, dpi=300)
    plt.close()
    print(f"      Saved Confusion Matrix plot to: {cm_plot_path}")

    # Plot 2: Feature Importance Bar Chart
    plt.figure(figsize=(10, 5))
    feats_sorted = [FEATURE_NAMES[i] for i in sorted_idx]
    vals_sorted = [importances[i] * 100 for i in sorted_idx]
    colors = sns.color_palette("viridis", len(feats_sorted))
    plt.barh(feats_sorted[::-1], vals_sorted[::-1], color=colors)
    plt.xlabel("Gini Importance (%)", fontsize=11)
    plt.title("Feature Importance in Root-Cause Diagnosis (Mean Decrease in Impurity)", fontsize=12, pad=15)
    plt.grid(axis="x", linestyle="--", alpha=0.6)
    plt.tight_layout()
    fi_plot_path = os.path.join(models_dir, "feature_importance.png")
    plt.savefig(fi_plot_path, dpi=300)
    plt.close()
    print(f"      Saved Feature Importance plot to: {fi_plot_path}")

    # Plot 3: Model Comparison Benchmark
    plt.figure(figsize=(8, 4.5))
    models_compare = ["Logistic Regression\n(Linear Baseline)", "Decision Tree\n(CART Baseline)", "Random Forest\n(Ensemble - Chosen)"]
    accs = [acc_lr * 100, acc_dt * 100, acc_rf * 100]
    bars = plt.bar(models_compare, accs, color=["#94a3b8", "#64748b", "#3b82f6"], width=0.55)
    plt.ylabel("Test Accuracy (%)", fontsize=11)
    plt.ylim(60, 100)
    plt.title("Model Performance Comparison on Telemetry Holdout Test Set", fontsize=12, pad=15)
    plt.grid(axis="y", linestyle="--", alpha=0.6)
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2.0, yval + 1.0, f"{yval:.2f}%", ha="center", va="bottom", fontweight="bold")
    plt.tight_layout()
    mc_plot_path = os.path.join(models_dir, "model_comparison.png")
    plt.savefig(mc_plot_path, dpi=300)
    plt.close()
    print(f"      Saved Model Comparison plot to: {mc_plot_path}")

    # Save models in standard formats
    pkl_path = os.path.join(models_dir, "random_forest_model.pkl")
    with open(pkl_path, "wb") as f:
        pickle.dump(rf_model, f)
    print(f"      Saved standard Python pickle model to: {pkl_path}")

    joblib_path = os.path.join(models_dir, "random_forest_model.joblib")
    joblib.dump(rf_model, joblib_path)
    print(f"      Saved joblib model to: {joblib_path}")

    # Save scaler and baseline models for viva inspection
    with open(os.path.join(models_dir, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)
    with open(os.path.join(models_dir, "decision_tree_model.pkl"), "wb") as f:
        pickle.dump(dt_baseline, f)
    with open(os.path.join(models_dir, "logistic_regression_model.pkl"), "wb") as f:
        pickle.dump(lr_model, f)

    # Export JSON model for TypeScript 0-dependency runtime inference
    json_model_path = os.path.join(models_dir, "random_forest_exported.json")
    exported_data = export_random_forest(rf_model, FEATURE_NAMES, class_names)
    with open(json_model_path, "w", encoding="utf-8") as f:
        json.dump(exported_data, f, indent=2)
    print(f"      Saved portable JSON forest weights to: {json_model_path}")

    # Also generate TypeScript artifact for apps/server repair domain
    server_model_ts = os.path.join(
        base_dir, "..", "apps", "server", "src", "modules", "repair", "domain", "trained-model-data.ts"
    )
    with open(server_model_ts, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated by ml/src/train.py - Do not edit manually */\n\n")
        f.write("export const TRAINED_FOREST_DATA = ")
        json.dump(exported_data, f)
        f.write(" as const;\n")
    print(f"      Exported pure TypeScript model weights to: {server_model_ts}")

    # Export metrics summary
    summary_path = os.path.join(models_dir, "metrics_summary.json")
    summary = {
        "dataset_samples": len(df),
        "test_samples": len(X_test),
        "logistic_regression": {
            "accuracy": float(round(acc_lr, 4)),
            "macro_f1": float(round(f1_lr, 4)),
        },
        "baseline_decision_tree": {
            "accuracy": float(round(acc_dt, 4)),
            "macro_f1": float(round(f1_dt, 4)),
        },
        "random_forest_ensemble": {
            "accuracy": float(round(acc_rf, 4)),
            "macro_f1": float(round(f1_rf, 4)),
            "cv_mean_accuracy": float(round(cv_scores.mean(), 4)),
            "cv_std_accuracy": float(round(cv_scores.std(), 4)),
        },
        "feature_importances": feature_ranking,
        "classes": class_names,
        "confusion_matrix": cm.tolist(),
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"      Saved evaluation summary to: {summary_path}")

    print("\n=================================================================")
    print("                    TRAINING PIPELINE COMPLETE                    ")
    print("=================================================================")

if __name__ == "__main__":
    main()
