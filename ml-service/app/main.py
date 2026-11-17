from fastapi import FastAPI
from datetime import datetime, timezone

from app.routes.profile import router as profile_router
from app.routes.clean import router as clean_router
from app.routes.etl import router as etl_router
from app.routes.spark import router as spark_router
from app.routes.anomaly import router as anomaly_router


app = FastAPI(
    title="DataPulse ML Service",
    description="Data processing, profiling, cleaning, ETL, Spark and AI/ML anomaly detection service for DataPulse",
    version="1.0.0"
)

app.include_router(profile_router)
app.include_router(clean_router)
app.include_router(etl_router)
app.include_router(spark_router)
app.include_router(anomaly_router)


@app.get("/")
def home():
    return {
        "success": True,
        "message": "Welcome to DataPulse ML Service",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {
        "success": True,
        "service": "DataPulse ML Service",
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
