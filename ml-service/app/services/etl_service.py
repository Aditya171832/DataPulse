
import pandas as pd
import io


def extract_csv(file_content: bytes):
    """
    Extract:
    Read CSV file content into a Pandas DataFrame.
    """

    if not file_content:
        raise ValueError("Uploaded CSV file is empty")

    try:
        df = pd.read_csv(io.BytesIO(file_content))
    except pd.errors.EmptyDataError:
        raise ValueError("CSV file contains no readable data")
    except Exception as error:
        raise ValueError(f"Unable to extract CSV: {str(error)}")

    if df.empty or len(df.columns) == 0:
        raise ValueError("CSV file contains no usable data")

    return df


def transform_data(df: pd.DataFrame):
    """
    Transform:
    Standardize columns, trim whitespace,
    remove duplicate rows and handle missing values.
    """

    original_rows = len(df)
    original_columns = len(df.columns)

    missing_before = int(df.isnull().sum().sum())

    # Standardize column names
    new_columns = []
    used_names = {}

    for column in df.columns:
        name = str(column).strip().lower()
        name = "".join(
            char if char.isalnum() else "_"
            for char in name
        )

        name = "_".join(
            part for part in name.split("_") if part
        )

        if not name:
            name = "column"

        count = used_names.get(name, 0)

        if count:
            final_name = f"{name}_{count + 1}"
        else:
            final_name = name

        used_names[name] = count + 1
        new_columns.append(final_name)

    df.columns = new_columns

    # Trim whitespace from text values
    for column in df.select_dtypes(
        include=["object", "string"]
    ).columns:

        df[column] = df[column].apply(
            lambda value: value.strip()
            if isinstance(value, str)
            else value
        )

    # Remove duplicate rows
    before_duplicates = len(df)
    df = df.drop_duplicates()
    duplicates_removed = before_duplicates - len(df)

    # Fill missing numeric values with mean
    for column in df.select_dtypes(include="number").columns:

        if df[column].isnull().any() and df[column].notna().any():
            df[column] = df[column].fillna(df[column].mean())

    # Fill missing categorical values with mode
    for column in df.columns:

        if df[column].isnull().any():
            modes = df[column].mode(dropna=True)

            if not modes.empty:
                df[column] = df[column].fillna(modes.iloc[0])

    missing_after = int(df.isnull().sum().sum())

    summary = {
        "original_rows": original_rows,
        "transformed_rows": len(df),
        "original_columns": original_columns,
        "transformed_columns": len(df.columns),
        "duplicates_removed": duplicates_removed,
        "missing_values_before": missing_before,
        "missing_values_after": missing_after
    }

    return df, summary


def load_data(df: pd.DataFrame):
    """
    Load:
    Convert transformed DataFrame into CSV output.
    """

    if df.empty:
        raise ValueError("Cannot load an empty dataset")

    csv_output = df.to_csv(index=False)

    return csv_output


def execute_etl(file_content: bytes):
    """
    Execute complete ETL pipeline.
    """

    # Step 1: Extract
    df = extract_csv(file_content)

    extracted_rows = len(df)
    extracted_columns = len(df.columns)

    # Step 2: Transform
    transformed_df, summary = transform_data(df)

    # Step 3: Load
    output_csv = load_data(transformed_df)

    return {
        "success": True,
        "message": "ETL pipeline executed successfully",
        "pipeline": {
            "extract": {
                "status": "SUCCESS",
                "rows": extracted_rows,
                "columns": extracted_columns
            },
            "transform": {
                "status": "SUCCESS",
                "summary": summary
            },
            "load": {
                "status": "SUCCESS",
                "output_format": "CSV",
                "output_size": len(output_csv.encode("utf-8"))
            }
        },
        "columns": transformed_df.columns.tolist(),
        "output_csv": output_csv
    }
