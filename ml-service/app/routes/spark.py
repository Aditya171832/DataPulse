import asyncio
import csv
import os
import subprocess
import tempfile

from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException


router = APIRouter(
    prefix="/api/spark",
    tags=["Apache Spark Processing"]
)

BASE_DIR = Path(__file__).resolve().parents[2]

SPARK_PYTHON = (
    BASE_DIR / ".venv-spark35" / "Scripts" / "python.exe"
)

SPARK_SCRIPT = BASE_DIR / "spark_processor.py"

SPARK_TEMP_DIR = BASE_DIR / "spark-temp"

JAVA_HOME = Path(
    r"C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
)


def execute_spark(input_path, output_path):
    env = os.environ.copy()

    env["JAVA_HOME"] = str(JAVA_HOME)
    env["PATH"] = str(JAVA_HOME / "bin") + os.pathsep + env.get("PATH", "")

    env["SPARK_LOCAL_DIRS"] = str(SPARK_TEMP_DIR)
    env["TEMP"] = str(SPARK_TEMP_DIR)
    env["TMP"] = str(SPARK_TEMP_DIR)
    env["SPARK_LOCAL_HOSTNAME"] = "localhost"

    env["PYSPARK_PYTHON"] = str(SPARK_PYTHON)
    env["PYSPARK_DRIVER_PYTHON"] = str(SPARK_PYTHON)

    SPARK_TEMP_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix="datapulse_",
        dir=SPARK_TEMP_DIR
    ) as temp_dir:

        input_file = Path(temp_dir) / "input.csv"
        output_file = Path(temp_dir) / "output.csv"

        input_file.write_bytes(input_path.read_bytes())

        result = subprocess.run(
            [
                str(SPARK_PYTHON),
                str(SPARK_SCRIPT),
                "--input",
                str(input_file),
                "--output",
                str(output_file)
            ],
            cwd=str(BASE_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=180
        )

        if result.returncode != 0:
            print("Spark error:", result.stderr[-3000:])
            raise RuntimeError("Spark processing failed")

        if not output_file.exists():
            raise RuntimeError("Spark output file was not created")

        cleaned_csv = output_file.read_text(encoding="utf-8")

        with output_file.open(
            "r",
            newline="",
            encoding="utf-8"
        ) as file:
            row_count = max(
                sum(1 for _ in csv.reader(file)) - 1,
                0
            )

        return cleaned_csv, row_count


@router.post("/csv")
async def process_csv_with_spark(
    file: UploadFile = File(...)
):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported"
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

        if not SPARK_PYTHON.exists():
            raise RuntimeError("Spark Python environment was not found")

        if not SPARK_SCRIPT.exists():
            raise RuntimeError("Spark processor script was not found")

        if not JAVA_HOME.exists():
            raise RuntimeError("Java 17 installation was not found")

        SPARK_TEMP_DIR.mkdir(parents=True, exist_ok=True)

        # Save uploaded bytes temporarily for Spark processing.
        with tempfile.TemporaryDirectory(
            prefix="datapulse_upload_",
            dir=SPARK_TEMP_DIR
        ) as upload_dir:

            input_path = Path(upload_dir) / "uploaded.csv"
            input_path.write_bytes(content)

            cleaned_csv, row_count = await asyncio.to_thread(
                execute_spark,
                input_path,
                Path(upload_dir) / "unused-output.csv"
            )

        return {
            "success": True,
            "message": "CSV processed successfully using Apache Spark",
            "filename": file.filename,
            "processing_engine": "Apache Spark 3.5.6",
            "rows_processed": row_count,
            "cleaned_csv": cleaned_csv
        }

    except HTTPException:
        raise

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Spark processing timed out"
        )

    except Exception as error:
        print("Spark processing error:", error)

        raise HTTPException(
            status_code=500,
            detail="Spark CSV processing failed"
        )

    finally:
        await file.close()
