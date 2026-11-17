from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from app.services.anomaly_service import detect_anomalies


router = APIRouter(
    prefix="/api/anomaly",
    tags=["AI/ML Anomaly Detection"]
)


@router.post("/detect")
async def detect_csv_anomalies(
    file: UploadFile = File(...),
    contamination: float = Query(default=0.1, ge=0.01, le=0.5)
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid CSV file."
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV file is empty."
            )

        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File size exceeds the 20 MB limit."
            )

        result = detect_anomalies(content, contamination)
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
        raise HTTPException(
            status_code=500,
            detail=f"Anomaly detection failed: {str(error)}"
        )

    finally:
        await file.close()
