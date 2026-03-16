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

from backend.inference.predictor import LiveASLPredictor
from backend.inference.sentence import generate_sentence_from_words

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
SIGN_VIDEO_DIR = "backend/data/test_stitching"
VIDEO_CACHE_DIR = "backend/video_cache" # for repeat messages -- just used saved videos to save time

os.makedirs(VIDEO_CACHE_DIR, exist_ok=True)

@app.on_event("startup")
def download_nltk():
    nltk.download('punkt')
    nltk.download('averaged_perceptron_tagger_eng')
    nltk.download('wordnet')
    nltk.download('omw-1.4')
    nltk.download('stopwords')

# helper for words --> sentence model
def append_word(words: list[str], sign: str, confidence: float | None) -> bool:
    if confidence is None:
        return False
    if sign in ("—", "TV"):
        return False
    if not words or sign not in words:
        words.append(sign)
        return True
    return False

# helper for asl-style english
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

from moviepy.editor import VideoFileClip, concatenate_videoclips

@app.post("/generate_asl_video")
async def generate_asl_video(data: dict):
    ## FIX THIS LATER
    try:
        gloss = data.get("gloss", "")
        if not gloss:
            return {"error": "No gloss provided"}

        words = gloss.split()
        video_id = hashlib.md5(gloss.encode()).hexdigest()
        output_path = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.mp4")

        # return the cached video if it exists
        if os.path.exists(output_path):
            return {"video_url": f"/video/{video_id}"}

        # collect preprocessed clip paths
        clip_paths = []
        for word in words:
            clip_file = os.path.join(SIGN_VIDEO_DIR, f"{word.lower()}.mp4")
            if os.path.exists(clip_file):
                clip_paths.append(clip_file)

        if not clip_paths:
            return {"error": "No matching sign clips"}

        # load clips and pad/resize to 1280x720
        clips = []
        for path in clip_paths:
            clip = VideoFileClip(path)
            clip = clip.resize(height=720).on_color(size=(1280,720), color=(255,255,255), pos='center')
            clips.append(clip)

        # concatenate with 0.2s crossfade
        final_clip = concatenate_videoclips(clips, method="compose", padding=-0.2)  # negative padding = overlap crossfade
        final_clip.write_videofile(output_path, codec="libx264", audio=False, threads=4, logger=None)

        # generate thumbnail
        thumb_path = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.jpg")
        final_clip.save_frame(thumb_path, t=0.1)

        return {
            "video_url": f"/video/{video_id}",
            "thumbnail_url": f"/thumbnail/{video_id}"
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
        chunk_size = 1024 * 1024
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

@app.get("/thumbnail/{video_id}")
def get_thumbnail(video_id: str):
    path = os.path.join(VIDEO_CACHE_DIR, f"{video_id}.jpg")
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "Thumbnail not found"})
    return FileResponse(path, media_type="image/jpeg", headers={"Access-Control-Allow-Origin": "*"})
