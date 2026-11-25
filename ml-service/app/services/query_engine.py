
from io import BytesIO
import json
from typing import Any

import duckdb
import pandas as pd


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_RESULT_ROWS = 100

AGGREGATIONS = {
    "count": "COUNT",
    "sum": "SUM",
    "average": "AVG",
    "mean": "AVG",
    "median": "MEDIAN",
    "min": "MIN",
    "max": "MAX",
}

FILTER_OPERATORS = {
    "eq": "=",
    "ne": "!=",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
}


# --------------------------------------------------
# LOAD DATASET
# --------------------------------------------------

def load_dataset(file_bytes: bytes) -> pd.DataFrame:
    if not file_bytes:
        raise ValueError("Dataset is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("Dataset exceeds the 20 MB limit.")

    try:
        df = pd.read_csv(BytesIO(file_bytes))
    except pd.errors.EmptyDataError:
        raise ValueError("CSV file contains no data.")
    except Exception as exc:
        raise ValueError("Unable to read CSV dataset.") from exc

    df.columns = [str(col).strip() for col in df.columns]

    normalized = [col.casefold() for col in df.columns]

    if len(normalized) != len(set(normalized)):
        raise ValueError("Dataset contains duplicate column names.")

    if df.empty:
        raise ValueError("Dataset contains no records.")

    return df


# --------------------------------------------------
# JSON SERIALIZATION
# --------------------------------------------------

def serialize_records(df: pd.DataFrame) -> list:
    return json.loads(
        df.to_json(
            orient="records",
            date_format="iso"
        )
    )


# --------------------------------------------------
# VALIDATE COLUMN
# --------------------------------------------------

def resolve_column(
    df: pd.DataFrame,
    column: str
) -> str:

    if not isinstance(column, str):
        raise ValueError("A valid column is required.")

    matches = [
        col for col in df.columns
        if col.casefold() == column.strip().casefold()
    ]

    if len(matches) != 1:
        raise ValueError(f"Column not found: {column}")

    return matches[0]


def quote_identifier(column: str) -> str:
    return '"' + column.replace('"', '""') + '"'


# --------------------------------------------------
# DATASET DESCRIPTION
# --------------------------------------------------

def describe_dataset(df: pd.DataFrame) -> dict:

    columns = []

    for column in df.columns:

        columns.append({
            "name": column,
            "data_type": str(df[column].dtype),
            "missing_values": int(df[column].isna().sum()),
            "unique_values": int(df[column].nunique()),
            "is_numeric": bool(
                pd.api.types.is_numeric_dtype(df[column])
            ),
        })

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "duplicate_rows": int(df.duplicated().sum()),
        "columns": columns,
    }


# --------------------------------------------------
# VALIDATE AGGREGATION
# --------------------------------------------------

def aggregation_expression(
    df: pd.DataFrame,
    aggregation: str,
    column: str | None
) -> str:

    if aggregation not in AGGREGATIONS:
        raise ValueError("Unsupported aggregation.")

    function = AGGREGATIONS[aggregation]

    if aggregation == "count" and not column:
        return "COUNT(*)"

    actual_column = resolve_column(df, column)

    numeric_operations = {
        "sum", "average", "mean", "median"
    }

    if aggregation in numeric_operations:
        if not pd.api.types.is_numeric_dtype(
            df[actual_column]
        ):
            raise ValueError(
                f"Column '{actual_column}' must be numeric."
            )

    return (
        f"{function}("
        f"{quote_identifier(actual_column)})"
    )


# --------------------------------------------------
# EXECUTE STRUCTURED QUERY
# --------------------------------------------------

def execute_query(
    df: pd.DataFrame,
    plan: dict[str, Any]
) -> dict:

    if not isinstance(plan, dict):
        raise ValueError("Invalid query plan.")

    operation = plan.get("operation", "")

    # Dataset structure
    if operation == "describe_dataset":
        return {
            "success": True,
            "operation": operation,
            "result": describe_dataset(df),
            "chart": None,
        }

    # Missing values
    if operation == "missing_values":

        records = [
            {
                "column": column,
                "missing_values": int(df[column].isna().sum()),
            }
            for column in df.columns
        ]

        return {
            "success": True,
            "operation": operation,
            "result": records,
            "chart": None,
        }

    # Duplicate records
    if operation == "duplicates":

        return {
            "success": True,
            "operation": operation,
            "result": {
                "duplicate_rows": int(
                    df.duplicated().sum()
                )
            },
            "chart": None,
        }

    # Validate result limit
    limit = plan.get("limit", 10)

    if type(limit) is not int or limit < 1:
        raise ValueError("Limit must be a positive integer.")

    limit = min(limit, MAX_RESULT_ROWS)

    connection = duckdb.connect(
        database=":memory:",
        config={
            "enable_external_access": "false",
            "threads": "2",
            "memory_limit": "512MB",
        }
    )

    try:
        connection.register("dataset", df)

        # ------------------------------------------
        # SINGLE AGGREGATIONS
        # ------------------------------------------

        if operation in AGGREGATIONS:

            expression = aggregation_expression(
                df,
                operation,
                plan.get("column"),
            )

            query = f"""
                SELECT {expression} AS value
                FROM dataset
            """

            result = connection.execute(query).df()

            return {
                "success": True,
                "operation": operation,
                "result": serialize_records(result),
                "chart": None,
            }

        # ------------------------------------------
        # GROUP BY
        # ------------------------------------------

        if operation == "group_by":

            group_column = resolve_column(
                df,
                plan.get("group_by"),
            )

            aggregation = plan.get(
                "aggregation", "count"
            )

            expression = aggregation_expression(
                df,
                aggregation,
                plan.get("column"),
            )

            group_identifier = quote_identifier(
                group_column
            )

            query = f"""
                SELECT
                    {group_identifier} AS category,
                    {expression} AS value
                FROM dataset
                GROUP BY {group_identifier}
                ORDER BY value DESC NULLS LAST
                LIMIT ?
            """

            result = connection.execute(
                query,
                [limit]
            ).df()

            records = serialize_records(result)

            return {
                "success": True,
                "operation": operation,
                "result": records,
                "chart": {
                    "type": "bar",
                    "x_key": "category",
                    "y_key": "value",
                    "data": records,
                },
            }

        # ------------------------------------------
        # FILTER RECORDS
        # ------------------------------------------

        if operation == "filter":

            column = resolve_column(
                df,
                plan.get("column"),
            )

            operator = plan.get("operator", "eq")

            if operator not in FILTER_OPERATORS:
                raise ValueError(
                    "Unsupported filter operator."
                )

            value = plan.get("value")

            if not isinstance(
                value,
                (str, int, float, bool)
            ):
                raise ValueError(
                    "Invalid filter value."
                )

            identifier = quote_identifier(column)

            sql_operator = FILTER_OPERATORS[operator]

            query = f"""
                SELECT *
                FROM dataset
                WHERE {identifier} {sql_operator} ?
                LIMIT ?
            """

            result = connection.execute(
                query,
                [value, limit]
            ).df()

            return {
                "success": True,
                "operation": operation,
                "result": serialize_records(result),
                "chart": None,
            }

        # ------------------------------------------
        # SORT AND RANK
        # ------------------------------------------

        if operation == "sort":

            column = resolve_column(
                df,
                plan.get("column"),
            )

            direction = plan.get(
                "direction", "desc"
            )

            if direction not in {"asc", "desc"}:
                raise ValueError(
                    "Invalid sorting direction."
                )

            identifier = quote_identifier(column)

            query = f"""
                SELECT *
                FROM dataset
                ORDER BY {identifier}
                {direction.upper()} NULLS LAST
                LIMIT ?
            """

            result = connection.execute(
                query,
                [limit]
            ).df()

            return {
                "success": True,
                "operation": operation,
                "result": serialize_records(result),
                "chart": None,
            }

        raise ValueError(
            f"Unsupported operation: {operation}"
        )

    finally:
        connection.close()


# --------------------------------------------------
# MAIN ENTRY POINT
# --------------------------------------------------

def analyze_dataset(
    file_bytes: bytes,
    plan: dict[str, Any]
) -> dict:

    df = load_dataset(file_bytes)

    return execute_query(df, plan)
