import pandas as pd
from sklearn.ensemble import IsolationForest


def detect_anomalies(file_content: bytes, contamination: float = 0.1):
    from io import BytesIO

    df = pd.read_csv(BytesIO(file_content))

    if len(df) < 5:
        raise ValueError("At least 5 rows are required for anomaly detection.")

    numeric_df = df.select_dtypes(include="number")
    numeric_df = numeric_df.dropna(axis=1, how="all")

    if numeric_df.empty:
        raise ValueError("No usable numerical columns found in the CSV.")

    # Remove columns that contain only one unique value.
    numeric_df = numeric_df.loc[
        :, numeric_df.nunique(dropna=True) > 1
    ]

    if numeric_df.empty:
        raise ValueError("Numerical columns have no variation to analyze.")

    # Fill missing numerical values using column medians.
    numeric_df = numeric_df.fillna(numeric_df.median())

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42
    )

    predictions = model.fit_predict(numeric_df)
    scores = model.score_samples(numeric_df)

    anomaly_rows = []

    for index, prediction in enumerate(predictions):
        if prediction == -1:
            original_row = df.iloc[index].to_dict()

            clean_row = {}

            for key, value in original_row.items():
                if pd.isna(value):
                    clean_row[key] = None
                elif hasattr(value, "item"):
                    clean_row[key] = value.item()
                else:
                    clean_row[key] = value

            anomaly_rows.append({
                "row_number": index + 1,
                "anomaly_score": round(float(-scores[index]), 6),
                "data": clean_row
            })

    anomaly_rows.sort(
        key=lambda item: item["anomaly_score"],
        reverse=True
    )

    return {
        "success": True,
        "algorithm": "Isolation Forest",
        "total_rows": len(df),
        "anomaly_count": len(anomaly_rows),
        "normal_count": len(df) - len(anomaly_rows),
        "numeric_columns_analyzed": list(numeric_df.columns),
        "anomalies": anomaly_rows
    }
