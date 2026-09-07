from pathlib import Path
from typing import List

import joblib

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "models" / "intent_model.pkl"
VECTORIZER_PATH = BASE_DIR / "models" / "vectorizer.pkl"


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="InterviewIQ CS Intent API",
    description="Customer Service intent classification service",
    version="1.0.0",
)


# =========================================================
# REQUEST / RESPONSE MODELS
# =========================================================

class PredictRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
    )


class IntentAlternative(BaseModel):
    intent: str
    confidence: float


class PredictResponse(BaseModel):
    success: bool
    message: str
    intent: str
    confidence: float
    alternatives: List[IntentAlternative]
    needs_clarification: bool


# =========================================================
# LOAD MODEL ONCE
# =========================================================

if not MODEL_PATH.exists():
    raise RuntimeError(
        f"Intent model not found: {MODEL_PATH}"
    )

if not VECTORIZER_PATH.exists():
    raise RuntimeError(
        f"Vectorizer not found: {VECTORIZER_PATH}"
    )


model = joblib.load(MODEL_PATH)

vectorizer = joblib.load(
    VECTORIZER_PATH
)


# =========================================================
# SETTINGS
# =========================================================

CONFIDENCE_THRESHOLD = 0.20

AMBIGUITY_MARGIN = 0.05


# =========================================================
# PREDICT
# =========================================================

def predict_message(message: str):
    cleaned_message = message.strip()

    if not cleaned_message:
        raise ValueError(
            "Message cannot be empty."
        )

    vector = vectorizer.transform(
        [cleaned_message]
    )

    probabilities = (
        model.predict_proba(vector)[0]
    )

    classes = model.classes_

    ranked = sorted(
        zip(
            classes,
            probabilities,
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    best_intent = str(
        ranked[0][0]
    )

    best_confidence = float(
        ranked[0][1]
    )

    second_confidence = (
        float(ranked[1][1])
        if len(ranked) > 1
        else 0.0
    )

    alternatives = [
        {
            "intent": str(intent),
            "confidence": round(
                float(probability),
                4,
            ),
        }
        for intent, probability
        in ranked[:3]
    ]

    confidence_too_low = (
        best_confidence
        < CONFIDENCE_THRESHOLD
    )

    predictions_too_close = (
        best_confidence
        - second_confidence
        < AMBIGUITY_MARGIN
    )

    needs_clarification = (
        confidence_too_low
        or predictions_too_close
    )

    return {
        "success": True,

        "message": cleaned_message,

        "intent": best_intent,

        "confidence": round(
            best_confidence,
            4,
        ),

        "alternatives": alternatives,

        "needs_clarification":
            needs_clarification,
    }


# =========================================================
# ROUTES
# =========================================================

@app.get("/")
def root():
    return {
        "success": True,
        "service": "InterviewIQ CS Intent API",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
        "model_loaded": True,
        "intent_count": len(
            model.classes_
        ),
    }


@app.post(
    "/predict",
    response_model=PredictResponse,
)
def predict(
    payload: PredictRequest,
):
    try:
        return predict_message(
            payload.message
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )