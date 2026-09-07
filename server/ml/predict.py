from pathlib import Path
import sys
import json
import joblib


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "models" / "intent_model.pkl"
VECTORIZER_PATH = BASE_DIR / "models" / "vectorizer.pkl"


def load_artifacts():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model tapılmadı: {MODEL_PATH}"
        )

    if not VECTORIZER_PATH.exists():
        raise FileNotFoundError(
            f"Vectorizer tapılmadı: {VECTORIZER_PATH}"
        )

    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)

    return model, vectorizer


def predict_intent(message: str):
    message = message.strip()

    if not message:
        raise ValueError("Message boş ola bilməz.")

    model, vectorizer = load_artifacts()

    vector = vectorizer.transform([message])

    predicted_intent = model.predict(vector)[0]

    probabilities = model.predict_proba(vector)[0]

    classes = model.classes_

    ranked = sorted(
        zip(classes, probabilities),
        key=lambda item: item[1],
        reverse=True,
    )

    confidence = float(ranked[0][1])

    alternatives = [
        {
            "intent": intent,
            "confidence": round(float(probability), 4),
        }
        for intent, probability in ranked[:3]
    ]

    result = {
        "message": message,
        "intent": predicted_intent,
        "confidence": round(confidence, 4),
        "alternatives": alternatives,
    }

    return result


def main():
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Usage: python predict.py \"your message\"",
                },
                indent=2,
            )
        )

        sys.exit(1)

    message = " ".join(sys.argv[1:])

    try:
        result = predict_intent(message)

        print(
            json.dumps(
                {
                    "success": True,
                    **result,
                },
                indent=2,
            )
        )

    except Exception as error:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": str(error),
                },
                indent=2,
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()