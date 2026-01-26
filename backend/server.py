from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

from backend.inference.predictor import LiveASLPredictor
from backend.inference.sentence import generate_sentence_from_words
from backend.inference.config import TFLITE_MODEL_PATH, ORD2SIGN
from backend.inference.text_to_gloss import english_to_asl_keywords
import whisper
import uuid
import subprocess
from fastapi import UploadFile, File, WebSocketDisconnect

import os
import tempfile
import logging
whisper_model = whisper.load_model("base")

# setup FastAPI
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# predictor class - create instance
predictor = LiveASLPredictor(TFLITE_MODEL_PATH, ORD2SIGN)
recognized_words = []

# append word if valid
def append_word(sign, confidence):
    if confidence is not None and sign not in ("—", "TV"):
        if not recognized_words or sign != recognized_words[-1]:
            recognized_words.append(sign)

# WebSocket endpoint
import asyncio

async def keep_alive(ws: WebSocket):
    while True:
        await ws.send_json({"ping": True})
        await asyncio.sleep(30)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("WebSocket connected")

    while True:
        try:
            data = await ws.receive_json()

            landmarks = np.array(data.get("landmarks", []), dtype=np.float32)
            if landmarks.size == 0:
                continue

            generate_sentence = data.get("generate_sentence", False)
            if generate_sentence:
                print("Generating sentence...")

            sign, confidence, top5 = predictor.update(landmarks)
            append_word(sign, confidence)

            sentence = ""
            if generate_sentence:
                print("Generating sentence from words:", recognized_words)
                sentence = generate_sentence_from_words(recognized_words)
                print(f"Generated sentence: {sentence}")

                # clear the recognized words list after generating the sentence
                recognized_words.clear()

            confidence = float(confidence) if confidence is not None else None
            sign = str(sign)
            if top5 is not None:
                top5 = [{"sign": s, "confidence": float(c)} for s, c in top5]

            await ws.send_json({
                "current_sign": sign,
                "confidence": confidence,
                "top5": top5,
                "recognized_words": recognized_words,
                "generated_sentence": sentence
            })

        except WebSocketDisconnect:
            print("WebSocket disconnected")
            break

        except Exception as e:
            print(f"Error: {e}")
            continue

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())

    # use temporary directory that works cross-platform
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"{uid}.webm")
        wav_path = os.path.join(tmpdir, f"{uid}.wav")

        # save uploaded audio
        with open(input_path, "wb") as f:
            f.write(await file.read())

        # convert to WAV for Whisper
        subprocess.run([
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            wav_path
        ], check=True)

        # transcribe
        result = whisper_model.transcribe(wav_path, language="en")

    return {
        "text": result["text"]
    }

@app.post("/convert_to_asl_style")
async def convert_to_asl_style(text: str):
    try:
        asl_style = english_to_asl_keywords(text)
        return {"asl_style": asl_style}
    except Exception as e:
        return {"error": str(e)}
