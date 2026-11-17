
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io

router = APIRouter(prefix="/api/profile", tags=["CSV Profiling"])


@router.post("/csv")
async def profile_csv(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="CSV file is empty"
            )

        numeric_columns = df.select_dtypes(
            include="number"
        ).columns.tolist()

        categorical_columns = df.select_dtypes(
            exclude="number"
        ).columns.tolist()

        column_info = []

        for column in df.columns:
            column_info.append({
                "name": column,
                "data_type": str(df[column].dtype),
                "missing_values": int(df[column].isnull().sum()),
                "unique_values": int(df[column].nunique())
            })

        numeric_stats = {}

        for column in numeric_columns:
            numeric_stats[column] = {
                "mean": float(df[column].mean()),
                "min": float(df[column].min()),
                "max": float(df[column].max()),
                "median": float(df[column].median())
            }

        categorical_stats = {}

        for column in categorical_columns:
            categorical_stats[column] = {
                "unique_values": int(df[column].nunique()),
                "top_values": {
                    str(key): int(value)
                    for key, value in
                    df[column].value_counts().head(5).items()
                }
            }

        return {
            "success": True,
            "filename": file.filename,
            "total_rows": int(len(df)),
            "total_columns": int(len(df.columns)),
            "duplicate_rows": int(df.duplicated().sum()),
            "columns": column_info,
            "numeric_statistics": numeric_stats,
            "categorical_statistics": categorical_stats
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process CSV file: {str(error)}"
        )
