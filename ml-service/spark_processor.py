import argparse
import csv
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, trim


BASE_DIR = Path(__file__).resolve().parent


def process_csv(input_file, output_file):
    input_path = Path(input_file)
    output_path = Path(output_file)

    if not input_path.is_absolute():
        input_path = BASE_DIR / input_path

    if not output_path.is_absolute():
        output_path = BASE_DIR / output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)

    spark = SparkSession.builder \
        .master("local[1]") \
        .appName("DataPulseSparkProcessor") \
        .config("spark.ui.enabled", "false") \
        .config(
            "spark.local.dir",
            (BASE_DIR / "spark-temp").as_posix()
        ) \
        .getOrCreate()

    try:
        df = spark.read \
            .option("header", True) \
            .option("inferSchema", True) \
            .csv(input_path.as_posix())

        df = df.toDF(*[
            name.strip().lower().replace(" ", "_")
            for name in df.columns
        ])

        for name, dtype in df.dtypes:
            if dtype == "string":
                df = df.withColumn(name, trim(col(name)))

        df = df.dropDuplicates()

        rows = [
            row.asDict(recursive=True)
            for row in df.collect()
        ]

        with output_path.open(
            "w", newline="", encoding="utf-8"
        ) as file:
            writer = csv.DictWriter(
                file,
                fieldnames=df.columns
            )
            writer.writeheader()
            writer.writerows(rows)

        return len(rows)

    finally:
        spark.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    count = process_csv(args.input, args.output)

    print("DataPulse Spark processing: PASSED")
    print("Rows written:", count)
