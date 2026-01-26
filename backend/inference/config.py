import json
from pathlib import Path

# resolve paths relative to this file
BASE_DIR = Path(__file__).resolve().parents[1]

# file path mapping
ORD2SIGN_PATH = BASE_DIR / "data" / "ord2sign.json"
TFLITE_MODEL_PATH = str(BASE_DIR / "models" / "asl_model_fp32.tflite")

# constants for ASL --> text model (match the training)
ROWS_PER_FRAME = 543
INPUT_SIZE = 64

# loading ord2sign mapping
with open(ORD2SIGN_PATH, "r") as f:
    ORD2SIGN = {int(k): v for k, v in json.load(f).items()}
