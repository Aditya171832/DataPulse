
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
import re

router = APIRouter(prefix="/api/clean", tags=["Data Cleaning"])


def standardize_column_name(name):
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = name.strip("_")
    return name or "column"


@router.post("/csv")
async def clean_csv(
    file: UploadFile = File(...),
    remove_duplicates: bool = True,
    trim_whitespace: bool = True,
    standardize_columns: bool = True,
    missing_strategy: str = "none"
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    allowed_strategies = [
        "none",
        "drop_rows",
        "fill_mean",
        "fill_median",
        "fill_mode"
    ]

    if missing_strategy not in allowed_strategies:
        raise HTTPException(
            status_code=400,
            detail="Invalid missing value strategy"
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="CSV file is empty"
            )

        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File size cannot exceed 20 MB"
            )

        df = pd.read_csv(io.BytesIO(content))

        if df.empty or len(df.columns) == 0:
            raise HTTPException(
                status_code=400,
                detail="CSV contains no data"
            )

        original_rows = len(df)
        original_columns = len(df.columns)

        missing_before = int(df.isnull().sum().sum())
        duplicates_removed = 0

        # Remove extra whitespace from text values
        if trim_whitespace:
            for column in df.select_dtypes(include=["object", "string"]).columns:
                df[column] = df[column].apply(
                    lambda value: value.strip()
                    if isinstance(value, str)
                    else value
                )

        # Standardize column names
        if standardize_columns:
            new_columns = []
            used_names = {}

            for column in df.columns:
                base_name = standardize_column_name(str(column))
                count = used_names.get(base_name, 0)

                if count == 0:
                    new_name = base_name
                else:
                    new_name = f"{base_name}_{count + 1}"

                used_names[base_name] = count + 1
                new_columns.append(new_name)

            df.columns = new_columns

        # Remove duplicate rows
        if remove_duplicates:
            before = len(df)
            df = df.drop_duplicates()
            duplicates_removed = before - len(df)

        # Handle missing values
        if missing_strategy == "drop_rows":
            df = df.dropna()

        elif missing_strategy == "fill_mean":
            for column in df.select_dtypes(include="number").columns:
                if df[column].notna().any():
                    df[column] = df[column].fillna(df[column].mean())

        elif missing_strategy == "fill_median":
            for column in df.select_dtypes(include="number").columns:
                if df[column].notna().any():
                    df[column] = df[column].fillna(df[column].median())

        elif missing_strategy == "fill_mode":
            for column in df.columns:
                modes = df[column].mode(dropna=True)

                if not modes.empty:
                    df[column] = df[column].fillna(modes.iloc[0])

        missing_after = int(df.isnull().sum().sum())

        cleaned_csv = df.to_csv(index=False)

        return {
            "success": True,
            "message": "Dataset cleaned successfully",
            "filename": file.filename,
            "cleaning_summary": {
                "original_rows": original_rows,
                "cleaned_rows": len(df),
                "original_columns": original_columns,
                "cleaned_columns": len(df.columns),
                "duplicates_removed": duplicates_removed,
                "missing_values_before": missing_before,
                "missing_values_after": missing_after,
                "missing_strategy": missing_strategy,
                "rows_removed": original_rows - len(df)
            },
            "cleaned_columns": df.columns.tolist(),
            "cleaned_csv": cleaned_csv
        }

    except HTTPException:
        raise

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="CSV file contains no readable data"
        )

    except Exception as error:
        print("CSV cleaning error:", error)

        raise HTTPException(
            status_code=400,
            detail="Could not clean the CSV file"
        )
