from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, JSONResponse
import hashlib
from fastapi import Response, Request
import math
import re

import numpy as np
import uuid
import subprocess
import tempfile
import os
import logging
import whisper
import shutil

## CHANGE THESE FROM "SCRIPTS" TO "INFERENCE" ****************************
from backend.scripts.predictor import LiveASLPredictor
from backend.scripts.sentence import generate_sentence_from_words

from backend.inference.config import TFLITE_MODEL_PATH, ORD2SIGN
from backend.inference.text_to_gloss import english_to_asl_keywords

from pydantic import BaseModel

import nltk

# Setup
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

# Models
whisper_model = whisper.load_model("base")
predictor = LiveASLPredictor(TFLITE_MODEL_PATH, ORD2SIGN)
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SIGN_VIDEO_DIR = BASE_DIR / "data" / "sample_videos_preprocessed"
VIDEO_CACHE_DIR = "backend/video_cache"

os.makedirs(VIDEO_CACHE_DIR, exist_ok=True)


@app.on_event("startup")
def download_nltk():
    nltk.download('punkt')
    nltk.download('averaged_perceptron_tagger_eng')
    nltk.download('wordnet')
    nltk.download('omw-1.4')
    nltk.download('stopwords')


# Helper for words --> sentence model
def append_word(words: list[str], sign: str, confidence: float | None) -> bool:
    if confidence is None:
        return False
    if sign in ("—", "TV"):
        return False
    if not words or sign not in words:
        words.append(sign)
        return True
    return False

# Helper for asl-style english
class TextInput(BaseModel):
    text: str

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("WebSocket connected")

    # per-connection state
    recognized_words: list[str] = []

    try:
        while True:
            data = await ws.receive_json()

            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
                continue

            if data.get("type") == "context":
                predictor.reset(flow=data.get("flow"))
                await ws.send_json({"type": "flow_reset", "flow": predictor.active_flow})
                continue

            # clear recognized words
            if data.get("type") == "clear":
                logger.info("Clearing recognized words (client request)")
                recognized_words.clear()
                predictor.reset()
                await ws.send_json({
                    "type": "cleared",
                    "recognized_words": []
                })
                continue

            # Landmark inference
            landmarks = np.array(data.get("landmarks", []), dtype=np.float32)
            if landmarks.size == 0:
                continue

            generate_sentence = bool(data.get("generate_sentence", False))

            sign, confidence, top5 = predictor.update(landmarks)
            was_added = append_word(recognized_words, sign, confidence)


            sentence = ""
            if generate_sentence:
                logger.info("Generating sentence from words: %s", recognized_words)
                sentence = generate_sentence_from_words(recognized_words)
                recognized_words.clear()

            current_sign = sign if was_added else None
            response = {
                "current_sign": current_sign,
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

# REST: speech to text
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

# REST: english --> ASL-style gloss
@app.post("/convert_to_asl_style")
async def convert_to_asl_style(input: TextInput):
    try:
        asl_style = english_to_asl_keywords(input.text)
        return {"asl_style": asl_style}
    except Exception as e:
        logger.exception("ASL conversion error")
        return {"error": str(e)}

@app.post("/generate_asl_video")
async def generate_asl_video(data: dict):
    try:
        gloss = data.get("gloss", "")
        if not gloss:
            return {"error": "No gloss provided"}

        words = gloss.split()
        video_id = hashlib.md5(gloss.encode()).hexdigest()
        output_path = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.mp4")

        # Return cached video if it exists
        if os.path.exists(output_path):
            return {"video_url": f"/video/{video_id}"}

        # Collect preprocessed clip paths
        clip_paths = []
        for word in words:
            clip = SIGN_VIDEO_DIR / f"{word.lower()}_processed.mp4"
            if clip.exists():
                clip_paths.append(str(clip))

        if not clip_paths:
            return {"error": "No matching sign clips"}

        # If only one clip, just copy it
        if len(clip_paths) == 1:
            shutil.copy(clip_paths[0], output_path)
        else:
            # Create concat list file for ffmpeg
            concat_file = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.txt")
            with open(concat_file, "w") as f:
                for clip in clip_paths:
                    f.write(f"file '{os.path.abspath(clip)}'\n")

            # Merge clips using concat demuxer (fast, no re-encoding)
            subprocess.run([
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_file, "-c", "copy", output_path
            ], check=True)

        return {
            "video_url": f"/video/{video_id}"
        }

    except Exception as e:
        logger.exception("Video generation error")
        return {"error": str(e)}

@app.get("/video/{video_id}")
def get_video(video_id: str, request: Request):
    path = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.mp4")
    if not os.path.exists(path):
        return {"error": "Video not found"}

    file_size = os.path.getsize(path)
    range_header = request.headers.get("range")

    if range_header:
        byte1, byte2 = 0, None
        m = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            g = m.groups()
            byte1 = int(g[0])
            if g[1]:
                byte2 = int(g[1])
        chunk_size = 1024 * 1024  # 1MB
        byte2 = byte2 or min(byte1 + chunk_size, file_size - 1)
        length = byte2 - byte1 + 1
        with open(path, "rb") as f:
            f.seek(byte1)
            data = f.read(length)
        headers = {
            "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
            "Access-Control-Allow-Origin": "*",
            "Cross-Origin-Resource-Policy": "cross-origin"
        }

        return Response(content=data, status_code=206, headers=headers)
    else:
        return FileResponse(
            path,
            media_type="video/mp4",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Resource-Policy": "cross-origin"
            }
        )

