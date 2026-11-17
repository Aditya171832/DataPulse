
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.etl_service import execute_etl

router = APIRouter(
    prefix="/api/etl",
    tags=["ETL Pipeline"]
)


@router.post("/csv")
async def run_csv_etl(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported"
        )

    try:
        content = await file.read()

        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File size cannot exceed 20 MB"
            )

        result = execute_etl(content)

        result["filename"] = file.filename

        return result

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        print("ETL pipeline error:", error)

        raise HTTPException(
            status_code=500,
            detail="ETL pipeline execution failed"
        )

    finally:
        await file.close()
