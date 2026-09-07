import fs from "fs";
import path from "path";

import * as ort from "onnxruntime-node";

/* =========================================================
   TYPES
========================================================= */

export interface ICSIntentAlternative {
  intent: string;
  confidence: number;
}

export interface ICSIntentPrediction {
  message: string;

  intent: string;

  confidence: number;

  alternatives: ICSIntentAlternative[];

  needsClarification: boolean;
}

interface ICSModelMetadata {
  model_type: string;

  vectorizer: string;

  training_examples: number;

  train_examples: number;

  test_examples: number;

  intent_count: number;

  intents: string[];

  accuracy: number;

  vocabulary_size: number;

  model_classes: string[];

  artifacts?: {
    sklearn_model?: string;

    vectorizer?: string;

    onnx_model?: string;
  };
}

/* =========================================================
   PATHS
========================================================= */

const SERVER_ROOT = path.resolve(
  __dirname,
  "../.."
);

const MODEL_PATH = path.join(
  SERVER_ROOT,
  "ml",
  "models",
  "intent_classifier.onnx"
);

const METADATA_PATH = path.join(
  SERVER_ROOT,
  "ml",
  "models",
  "metadata.json"
);

/* =========================================================
   SETTINGS
========================================================= */

/*
 * Current dataset is still small, so probabilities can be
 * conservative.
 *
 * These thresholds are intentionally not aggressive yet.
 */
const CONFIDENCE_THRESHOLD = 0.18;

const AMBIGUITY_MARGIN = 0.05;

const TOP_ALTERNATIVES = 3;

/* =========================================================
   SERVICE STATE
========================================================= */

let session: ort.InferenceSession | null = null;

let sessionPromise:
  Promise<ort.InferenceSession> | null =
  null;

let metadata:
  ICSModelMetadata | null =
  null;

/* =========================================================
   HELPERS
========================================================= */

const roundConfidence = (
  value: number
): number => {
  return Math.round(
    value * 10000
  ) / 10000;
};

const normalizeMessage = (
  message: string
): string => {
  return message
    .replace(/\s+/g, " ")
    .trim();
};

const fileExists = (
  filePath: string
): boolean => {
  return fs.existsSync(
    filePath
  );
};

/* =========================================================
   METADATA
========================================================= */

const loadMetadata =
  (): ICSModelMetadata => {
    if (metadata) {
      return metadata;
    }

    if (
      !fileExists(
        METADATA_PATH
      )
    ) {
      throw new Error(
        `CS intent metadata file not found: ${METADATA_PATH}`
      );
    }

    const raw =
      fs.readFileSync(
        METADATA_PATH,
        "utf-8"
      );

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(raw);
    } catch {
      throw new Error(
        "CS intent metadata.json contains invalid JSON"
      );
    }

    if (
      typeof parsed !==
        "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        "CS intent metadata.json has invalid structure"
      );
    }

    const candidate =
      parsed as Partial<ICSModelMetadata>;

    if (
      !Array.isArray(
        candidate.model_classes
      )
    ) {
      throw new Error(
        "CS intent metadata is missing model_classes"
      );
    }

    metadata =
      candidate as ICSModelMetadata;

    return metadata;
  };

/* =========================================================
   ONNX SESSION
========================================================= */

const createSession =
  async (): Promise<ort.InferenceSession> => {
    if (
      !fileExists(
        MODEL_PATH
      )
    ) {
      throw new Error(
        `CS intent ONNX model not found: ${MODEL_PATH}`
      );
    }

    return ort.InferenceSession.create(
      MODEL_PATH,
      {
        executionProviders: [
          "cpu",
        ],
      }
    );
  };

const getSession =
  async (): Promise<ort.InferenceSession> => {
    if (session) {
      return session;
    }

    if (!sessionPromise) {
      sessionPromise =
        createSession();
    }

    try {
      session =
        await sessionPromise;

      return session;
    } catch (error) {
      sessionPromise =
        null;

      throw error;
    }
  };

/* =========================================================
   MODEL OUTPUT HELPERS
========================================================= */

const toNumberArray = (
  value: unknown
): number[] => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      Number(item)
    );
  }

  if (
    value instanceof Float32Array ||
    value instanceof Float64Array ||
    value instanceof Int32Array
  ) {
    return Array.from(value);
  }

  if (value instanceof BigInt64Array) {
    return Array.from(value).map(
      (item) => Number(item)
    );
  }

  if (value instanceof BigUint64Array) {
    return Array.from(value).map(
      (item) => Number(item)
    );
  }

  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  if (value instanceof Uint16Array) {
    return Array.from(value);
  }

  if (value instanceof Uint32Array) {
    return Array.from(value);
  }

  if (value instanceof Int8Array) {
    return Array.from(value);
  }

  if (value instanceof Int16Array) {
    return Array.from(value);
  }

  return [];
};

const toStringArray = (
  value: unknown
): string[] => {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      (item) =>
        String(item)
    );
  }

  return [];
};

/* =========================================================
   FIND OUTPUTS

   skl2onnx output names can vary slightly depending on
   converter versions.

   We therefore detect label/probability tensors instead of
   hardcoding one fragile output name.
========================================================= */

const getPredictionOutputs = (
  results: ort.InferenceSession.OnnxValueMapType
): {
  labels: string[];

  probabilities: number[];
} => {
  const modelMetadata =
    loadMetadata();

  const outputEntries =
    Object.entries(results);

  let labels:
    string[] = [];

  let probabilities:
    number[] = [];

  for (
    const [
      outputName,
      tensor,
    ]
    of outputEntries
  ) {
    const lowerName =
      outputName.toLowerCase();

    const data =
      tensor.data;

    /*
     * Probability tensor
     */
    if (
      lowerName.includes(
        "prob"
      )
    ) {
      const values =
        toNumberArray(
          data
        );

      if (
        values.length >
        probabilities.length
      ) {
        probabilities =
          values;
      }

      continue;
    }

    /*
     * Label output
     */
    if (
      lowerName.includes(
        "label"
      )
    ) {
      labels =
        toStringArray(
          data
        );
    }
  }

  /*
   * zipmap=False means probability output should normally be
   * a flat numeric tensor.
   *
   * If label names are not returned as a tensor, use the
   * model classes saved during training.
   */
  if (
    probabilities.length >
      0 &&
    modelMetadata.model_classes
      .length ===
      probabilities.length
  ) {
    labels =
      modelMetadata.model_classes;
  }

  if (
    probabilities.length ===
    0
  ) {
    throw new Error(
      "ONNX intent model did not return probability output"
    );
  }

  if (
    labels.length !==
    probabilities.length
  ) {
    throw new Error(
      `Intent class/probability mismatch. Classes=${labels.length}, probabilities=${probabilities.length}`
    );
  }

  return {
    labels,
    probabilities,
  };
};

/* =========================================================
   PREDICTION
========================================================= */

export const predictCSIntent =
  async (
    message: string
  ): Promise<ICSIntentPrediction> => {
    const cleanedMessage =
      normalizeMessage(
        message
      );

    if (!cleanedMessage) {
      throw new Error(
        "Customer message cannot be empty"
      );
    }

    if (
      cleanedMessage.length >
      2000
    ) {
      throw new Error(
        "Customer message is too long"
      );
    }

    const modelSession =
      await getSession();

    /*
     * Our sklearn -> ONNX pipeline was exported using:
     *
     * StringTensorType([None, 1])
     *
     * Therefore input shape is [1, 1].
     */
    const inputTensor =
      new ort.Tensor(
        "string",
        [cleanedMessage],
        [1, 1]
      );

    const inputNames =
      modelSession.inputNames;

    if (
      inputNames.length ===
      0
    ) {
      throw new Error(
        "ONNX intent model has no input"
      );
    }

    const inputName =
      inputNames[0];

    const results =
      await modelSession.run({
        [inputName]:
          inputTensor,
      });

    const {
      labels,
      probabilities,
    } =
      getPredictionOutputs(
        results
      );

    const ranked =
      labels
        .map(
          (
            intent,
            index
          ) => ({
            intent,

            confidence:
              Number(
                probabilities[
                  index
                ] ||
                  0
              ),
          })
        )
        .sort(
          (a, b) =>
            b.confidence -
            a.confidence
        );

    if (
      ranked.length ===
      0
    ) {
      throw new Error(
        "Intent model returned no predictions"
      );
    }

    const best =
      ranked[0];

    const second =
      ranked[1];

    const bestConfidence =
      best.confidence;

    const secondConfidence =
      second?.confidence ||
      0;

    const confidenceTooLow =
      bestConfidence <
      CONFIDENCE_THRESHOLD;

    const predictionsTooClose =
      (
        bestConfidence -
        secondConfidence
      ) <
      AMBIGUITY_MARGIN;

    return {
      message:
        cleanedMessage,

      intent:
        best.intent,

      confidence:
        roundConfidence(
          bestConfidence
        ),

      alternatives:
        ranked
          .slice(
            0,
            TOP_ALTERNATIVES
          )
          .map(
            (item) => ({
              intent:
                item.intent,

              confidence:
                roundConfidence(
                  item.confidence
                ),
            })
          ),

      needsClarification:
        confidenceTooLow ||
        predictionsTooClose,
    };
  };

/* =========================================================
   MODEL INFO
========================================================= */

export const getCSIntentModelInfo =
  async () => {
    const modelMetadata =
      loadMetadata();

    const modelSession =
      await getSession();

    return {
      loaded: true,

      modelPath:
        MODEL_PATH,

      modelType:
        modelMetadata.model_type,

      vectorizer:
        modelMetadata.vectorizer,

      accuracy:
        modelMetadata.accuracy,

      trainingExamples:
        modelMetadata.training_examples,

      intentCount:
        modelMetadata.intent_count,

      intents:
        modelMetadata.intents,

      inputNames:
        modelSession.inputNames,

      outputNames:
        modelSession.outputNames,

      thresholds: {
        confidence:
          CONFIDENCE_THRESHOLD,

        ambiguityMargin:
          AMBIGUITY_MARGIN,
      },
    };
  };

/* =========================================================
   PRELOAD

   We can call this when the server starts later.
========================================================= */

export const preloadCSIntentModel =
  async (): Promise<void> => {
    await getSession();

    const modelMetadata =
      loadMetadata();

    console.log(
      `[CS Intent] Model loaded successfully. ${modelMetadata.intent_count} intents, accuracy=${modelMetadata.accuracy}`
    );
  };

export default {
  predictCSIntent,

  getCSIntentModelInfo,

  preloadCSIntentModel,
};