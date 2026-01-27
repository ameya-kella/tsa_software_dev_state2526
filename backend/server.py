from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import numpy as np
import uuid
import subprocess
import tempfile
import os
import logging

import whisper

from backend.inference.predictor import LiveASLPredictor
from backend.inference.sentence import generate_sentence_from_words
from backend.inference.config import TFLITE_MODEL_PATH, ORD2SIGN
from backend.inference.text_to_gloss import english_to_asl_keywords

# ------------------------------------------------------------------------------
# Setup
# ------------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("asl-backend")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock this down in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Models
# ------------------------------------------------------------------------------

whisper_model = whisper.load_model("base")
predictor = LiveASLPredictor(TFLITE_MODEL_PATH, ORD2SIGN)

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

def append_word(words: list[str], sign: str, confidence: float | None):
    """Append sign if valid and not a duplicate of the last one."""
    if confidence is None:
        return
    if sign in ("—", "TV"):
        return
    if not words or sign != words[-1]:
        words.append(sign)

# ------------------------------------------------------------------------------
# WebSocket Endpoint
# ------------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("WebSocket connected")

    # 🔒 Per-connection state
    recognized_words: list[str] = []

    try:
        while True:
            data = await ws.receive_json()

            # ----------------------------------
            # Heartbeat ping from client
            # ----------------------------------
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
                continue

            # ----------------------------------
            # Landmark inference
            # ----------------------------------
            landmarks = np.array(data.get("landmarks", []), dtype=np.float32)
            if landmarks.size == 0:
                continue

            generate_sentence = bool(data.get("generate_sentence", False))

            sign, confidence, top5 = predictor.update(landmarks)
            append_word(recognized_words, sign, confidence)

            sentence = ""
            if generate_sentence:
                logger.info("Generating sentence from words: %s", recognized_words)
                sentence = generate_sentence_from_words(recognized_words)
                recognized_words.clear()

            # ----------------------------------
            # Normalize payload
            # ----------------------------------
            response = {
                "current_sign": str(sign),
                "confidence": float(confidence) if confidence is not None else None,
                "top5": (
                    [[s, float(c)] for s, c in top5]
                    if top5 is not None
                    else None
                ),
                "recognized_words": recognized_words,
                "generated_sentence": sentence,
            }

            await ws.send_json(response)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        recognized_words.clear()

    except Exception as e:
        logger.exception("WebSocket error: %s", e)
        recognized_words.clear()
        await ws.close()

# ------------------------------------------------------------------------------
# REST: Audio Transcription
# ------------------------------------------------------------------------------

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"{uid}.webm")
        wav_path = os.path.join(tmpdir, f"{uid}.wav")

        with open(input_path, "wb") as f:
            f.write(await file.read())

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ar", "16000",
                "-ac", "1",
                wav_path,
            ],
            check=True,
        )

        result = whisper_model.transcribe(wav_path, language="en")

    return {"text": result["text"]}

# ------------------------------------------------------------------------------
# REST: English → ASL-style Gloss
# ------------------------------------------------------------------------------

@app.post("/convert_to_asl_style")
async def convert_to_asl_style(text: str):
    try:
        asl_style = english_to_asl_keywords(text)
        return {"asl_style": asl_style}
    except Exception as e:
        logger.exception("ASL conversion error")
        return {"error": str(e)}
