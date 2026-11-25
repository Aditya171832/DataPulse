
from fastapi import FastAPI
from datetime import datetime, timezone

from app.routes.profile import router as profile_router
from app.routes.clean import router as clean_router
from app.routes.etl import router as etl_router
from app.routes.spark import router as spark_router
from app.routes.anomaly import router as anomaly_router
from app.routes.ai_chat import router as ai_chat_router


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="DataPulse ML Service",
    description=(
        "Data processing, profiling, cleaning, ETL, "
        "Spark, AI/ML anomaly detection and intelligent "
        "dataset assistant for DataPulse"
    ),
    version="1.0.0",
)


# --------------------------------------------------
# REGISTER ROUTERS
# --------------------------------------------------

app.include_router(profile_router)

app.include_router(clean_router)

app.include_router(etl_router)

app.include_router(spark_router)

app.include_router(anomaly_router)

app.include_router(ai_chat_router)


# --------------------------------------------------
# HOME ENDPOINT
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "success": True,
        "message": "Welcome to DataPulse ML Service",
        "version": "1.0.0",
    }


# --------------------------------------------------
# HEALTH CHECK ENDPOINT
# --------------------------------------------------

@app.get("/health")
def health_check():

    return {
        "success": True,
        "service": "DataPulse ML Service",
        "status": "healthy",
        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),
    }
