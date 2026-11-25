
import logging

from pathlib import Path

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from starlette.concurrency import run_in_threadpool

from google.genai import errors

from app.services.ai_service import (
    ask_dataset,
    MAX_QUESTION_LENGTH,
)

from app.services.query_engine import MAX_FILE_SIZE


# --------------------------------------------------
# ROUTER CONFIGURATION
# --------------------------------------------------

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Data Assistant"],
)

logger = logging.getLogger(__name__)


# --------------------------------------------------
# AI CHAT ENDPOINT
# --------------------------------------------------

@router.post("/chat")
async def chat_with_dataset(
    file: UploadFile = File(...),
    question: str = Form(...),
):
    """
    Ask a natural-language question about a CSV dataset.

    Gemini generates a structured query plan.
    DuckDB executes the validated analytical operation.
    The response contains an answer, results and
    optional chart data.
    """

    try:

        # ------------------------------------------
        # VALIDATE QUESTION
        # ------------------------------------------

        question = question.strip()

        if not question:

            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty.",
            )

        if len(question) > MAX_QUESTION_LENGTH:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Question cannot exceed "
                    f"{MAX_QUESTION_LENGTH} characters."
                ),
            )

        # ------------------------------------------
        # VALIDATE FILE FORMAT
        # ------------------------------------------

        filename = file.filename or ""

        extension = Path(filename).suffix.lower()

        if extension != ".csv":

            raise HTTPException(
                status_code=400,
                detail="Only CSV datasets are supported.",
            )

        # ------------------------------------------
        # READ AND VALIDATE FILE
        # ------------------------------------------

        file_bytes = await file.read(
            MAX_FILE_SIZE + 1
        )

        if not file_bytes:

            raise HTTPException(
                status_code=400,
                detail="Uploaded dataset is empty.",
            )

        if len(file_bytes) > MAX_FILE_SIZE:

            raise HTTPException(
                status_code=413,
                detail="Dataset exceeds the 20 MB limit.",
            )

        # ------------------------------------------
        # EXECUTE AI ANALYSIS
        # ------------------------------------------

        result = await run_in_threadpool(
            ask_dataset,
            file_bytes,
            question,
        )

        # ------------------------------------------
        # RETURN RESPONSE
        # ------------------------------------------

        return {
            **result,
            "dataset": {
                "filename": filename,
                "file_size": len(file_bytes),
            },
        }

    # ----------------------------------------------
    # HANDLE HTTP ERRORS
    # ----------------------------------------------

    except HTTPException:
        raise

    # ----------------------------------------------
    # HANDLE GEMINI API ERRORS
    # ----------------------------------------------

    except errors.APIError as exc:

        status_code = getattr(exc, "code", None)

        logger.warning(
            "Gemini API request failed with code %s",
            status_code,
        )

        if status_code == 429:

            raise HTTPException(
                status_code=429,
                detail=(
                    "AI service rate limit reached. "
                    "Please try again later."
                ),
            )

        if status_code in (503, 504):

            raise HTTPException(
                status_code=503,
                detail=(
                    "AI service is temporarily unavailable. "
                    "Please try again later."
                ),
            )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to complete the AI request."
            ),
        )

    # ----------------------------------------------
    # HANDLE VALIDATION AND QUERY ERRORS
    # ----------------------------------------------

    except ValueError:

        logger.warning(
            "AI request failed validation."
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to analyze the dataset or "
                "validate the generated query plan."
            ),
        )

    # ----------------------------------------------
    # HANDLE UNEXPECTED ERRORS
    # ----------------------------------------------

    except Exception as exc:

        logger.error(
            "AI analysis failed: %s",
            type(exc).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected error occurred "
                "during AI analysis."
            ),
        )

    # ----------------------------------------------
    # CLOSE UPLOADED FILE
    # ----------------------------------------------

    finally:

        await file.close()
