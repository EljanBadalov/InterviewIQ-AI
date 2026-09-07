from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.pipeline import Pipeline

from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR / "data" / "intents.csv"

MODEL_DIR = BASE_DIR / "models"

MODEL_PATH = MODEL_DIR / "intent_model.pkl"

VECTORIZER_PATH = MODEL_DIR / "vectorizer.pkl"

ONNX_PIPELINE_PATH = MODEL_DIR / "intent_classifier.onnx"

METADATA_PATH = MODEL_DIR / "metadata.json"


def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset tapılmadı: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    required_columns = {
        "text",
        "intent",
    }

    if not required_columns.issubset(df.columns):
        raise ValueError(
            "intents.csv mütləq 'text' və 'intent' sütunlarına sahib olmalıdır."
        )

    df = df[
        [
            "text",
            "intent",
        ]
    ].copy()

    df["text"] = (
        df["text"]
        .astype(str)
        .str.strip()
    )

    df["intent"] = (
        df["intent"]
        .astype(str)
        .str.strip()
    )

    df = df[
        (df["text"] != "")
        & (df["intent"] != "")
    ]

    df = df.drop_duplicates(
        subset=[
            "text",
            "intent",
        ]
    )

    if df.empty:
        raise ValueError(
            "Dataset boşdur."
        )

    return df


def validate_dataset(
    df: pd.DataFrame,
) -> None:
    intent_counts = (
        df["intent"]
        .value_counts()
        .sort_index()
    )

    print("\nDataset summary")
    print("-" * 50)

    print(
        f"Total examples: {len(df)}"
    )

    print(
        f"Total intents: {df['intent'].nunique()}"
    )

    print("\nExamples per intent:")

    for intent, count in intent_counts.items():
        print(
            f"  {intent}: {count}"
        )

    min_count = int(
        intent_counts.min()
    )

    if min_count < 5:
        raise ValueError(
            "Hər intent üçün ən azı 5 nümunə olmalıdır."
        )


def build_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        lowercase=True,

        # IMPORTANT:
        # skl2onnx hazırda strip_accents='unicode'
        # conversion-ını dəstəkləmir.
        strip_accents=None,

        analyzer="word",

        ngram_range=(1, 2),

        min_df=1,

        max_df=0.98,

        sublinear_tf=True,

        max_features=12000,
    )


def build_model() -> LogisticRegression:
    return LogisticRegression(
        max_iter=3000,

        class_weight="balanced",

        random_state=42,
    )


def export_to_onnx(
    vectorizer: TfidfVectorizer,
    model: LogisticRegression,
) -> None:
    print(
        "\nExporting complete TF-IDF + Logistic Regression pipeline to ONNX..."
    )

    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                vectorizer,
            ),
            (
                "classifier",
                model,
            ),
        ]
    )

    initial_types = [
        (
            "input",
            StringTensorType(
                [None, 1]
            ),
        )
    ]

    options = {
        id(model): {
            "zipmap": False,
        }
    }

    onnx_model = convert_sklearn(
        pipeline,

        initial_types=initial_types,

        target_opset=17,

        options=options,
    )

    with open(
        ONNX_PIPELINE_PATH,
        "wb",
    ) as file:
        file.write(
            onnx_model.SerializeToString()
        )

    print(
        f"\nONNX model saved to:\n{ONNX_PIPELINE_PATH}"
    )


def save_metadata(
    df: pd.DataFrame,
    model: LogisticRegression,
    vectorizer: TfidfVectorizer,
    accuracy: float,
    train_count: int,
    test_count: int,
) -> None:
    metadata = {
        "model_type": "LogisticRegression",

        "vectorizer": "TfidfVectorizer",

        "training_examples": int(
            len(df)
        ),

        "train_examples": int(
            train_count
        ),

        "test_examples": int(
            test_count
        ),

        "intent_count": int(
            df["intent"].nunique()
        ),

        "intents": sorted(
            [
                str(intent)
                for intent in df["intent"]
                .unique()
                .tolist()
            ]
        ),

        "accuracy": float(
            accuracy
        ),

        "vocabulary_size": int(
            len(
                vectorizer.vocabulary_
            )
        ),

        "model_classes": [
            str(item)
            for item in model.classes_
        ],

        "artifacts": {
            "sklearn_model": MODEL_PATH.name,

            "vectorizer": VECTORIZER_PATH.name,

            "onnx_model": ONNX_PIPELINE_PATH.name,
        },
    }

    METADATA_PATH.write_text(
        json.dumps(
            metadata,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"\nMetadata saved to:\n{METADATA_PATH}"
    )


def train() -> None:
    print(
        "\nLoading dataset..."
    )

    df = load_dataset()

    validate_dataset(
        df
    )

    X = df["text"]

    y = df["intent"]

    print(
        "\nSplitting dataset..."
    )

    (
        X_train,
        X_test,
        y_train,
        y_test,
    ) = train_test_split(
        X,

        y,

        test_size=0.20,

        random_state=42,

        stratify=y,
    )

    print(
        f"Train examples: {len(X_train)}"
    )

    print(
        f"Test examples: {len(X_test)}"
    )

    print(
        "\nTraining TF-IDF vectorizer..."
    )

    vectorizer = build_vectorizer()

    X_train_vectorized = (
        vectorizer.fit_transform(
            X_train
        )
    )

    X_test_vectorized = (
        vectorizer.transform(
            X_test
        )
    )

    print(
        f"Vocabulary size: {len(vectorizer.vocabulary_)}"
    )

    print(
        "\nTraining Logistic Regression model..."
    )

    model = build_model()

    model.fit(
        X_train_vectorized,
        y_train,
    )

    print(
        "\nEvaluating model..."
    )

    predictions = model.predict(
        X_test_vectorized
    )

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    print(
        f"\nAccuracy: {accuracy:.4f}"
    )

    print(
        "\nClassification report:\n"
    )

    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0,
        )
    )

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "\nSaving sklearn artifacts..."
    )

    joblib.dump(
        model,
        MODEL_PATH,
    )

    joblib.dump(
        vectorizer,
        VECTORIZER_PATH,
    )

    print(
        f"\nModel saved to:\n{MODEL_PATH}"
    )

    print(
        f"\nVectorizer saved to:\n{VECTORIZER_PATH}"
    )

    export_to_onnx(
        vectorizer,
        model,
    )

    save_metadata(
        df=df,

        model=model,

        vectorizer=vectorizer,

        accuracy=accuracy,

        train_count=len(
            X_train
        ),

        test_count=len(
            X_test
        ),
    )

    print(
        "\nTraining + ONNX export completed successfully."
    )

    print(
        "\nGenerated artifacts:"
    )

    print(
        f"- {MODEL_PATH}"
    )

    print(
        f"- {VECTORIZER_PATH}"
    )

    print(
        f"- {ONNX_PIPELINE_PATH}"
    )

    print(
        f"- {METADATA_PATH}"
    )


if __name__ == "__main__":
    train()