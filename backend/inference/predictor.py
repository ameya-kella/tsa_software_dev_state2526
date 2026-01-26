# -------------------------
# Predictor
# -------------------------
import time
import numpy as np
import tensorflow as tf

from backend.inference.preprocessing_live import preprocess_live_sequence
from backend.inference.config import INPUT_SIZE

# predictor class for ASL --> text model
class LiveASLPredictor:
    def __init__(self, tflite_path, ord2sign,
                 pred_interval=0.5, motion_threshold=0.007, smooth_window=5, conf_threshold=0.4):
        self.interpreter = tf.lite.Interpreter(model_path=tflite_path)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        self.ord2sign = ord2sign
        self.motion_threshold = motion_threshold
        self.smooth_window = smooth_window
        self.conf_threshold = conf_threshold

        self.sequence = []
        self.last_landmarks = None
        self.last_preds = []
        self.current_sign = ""
        self.cooldown = 3.0          # seconds between accepted predictions
        self.last_emit_time = 0.0
        self.last_emitted_sign = None
        self.still_start_time = None
        self.still_reset_delay = 0.6  # seconds of stillness to reset

    def update(self, frame_landmarks):
        if np.isnan(frame_landmarks).all():
            return self.current_sign, None, None

        # compute motion
        motion = 0.0
        if self.last_landmarks is not None:
            motion = np.nanmean(np.abs(frame_landmarks - self.last_landmarks))
        self.last_landmarks = frame_landmarks.copy()

        # reset emitted sign if still for some time
        if motion < self.motion_threshold * 0.5:
            if self.still_start_time is None:
                self.still_start_time = time.time()
            elif time.time() - self.still_start_time > self.still_reset_delay:
                self.last_emitted_sign = None
                self.last_preds = []
        else:
            self.still_start_time = None

        self.sequence.append(frame_landmarks)
        if len(self.sequence) > INPUT_SIZE:
            self.sequence.pop(0)

        # pad frame sequence if too short
        if len(self.sequence) < INPUT_SIZE:
            pad_len = INPUT_SIZE - len(self.sequence)
            pad_frame = np.zeros_like(frame_landmarks)
            self.sequence = [pad_frame]*pad_len + self.sequence

        # preprocess frames
        frames, idxs = preprocess_live_sequence(self.sequence)
        if frames is None:
            return self.current_sign, None, None

        # inferencing using the tflite (more efficient for mobile deployment)
        self.interpreter.set_tensor(self.input_details[0]['index'], frames.astype(np.float32))
        self.interpreter.invoke()
        logits = self.interpreter.get_tensor(self.output_details[0]["index"])[0]

        # softmax probabilities
        probs = np.exp(logits - np.max(logits))
        probs = probs / probs.sum()
        top_idx = int(np.argmax(probs))
        top_conf = float(probs[top_idx])

        # update smoothing buffer only if motion is meaningful
        if motion > self.motion_threshold:
            self.last_preds.append(top_idx)
            if len(self.last_preds) > self.smooth_window:
                self.last_preds.pop(0)

        # determine smooth sign
        if self.last_preds:
            counts = np.bincount(self.last_preds, minlength=len(self.ord2sign))
            smooth_idx = int(np.argmax(counts))
            smooth_sign = self.ord2sign.get(smooth_idx, "")
        else:
            smooth_sign = ""

        # decide whether to emit new sign
        emitted = False
        now = time.time()
        can_emit = (now - self.last_emit_time) >= self.cooldown

        if motion > self.motion_threshold and top_conf >= self.conf_threshold:
            if smooth_sign != self.last_emitted_sign or self.last_emitted_sign is None:
                self.current_sign = smooth_sign
                self.last_emitted_sign = smooth_sign
                self.last_emit_time = now
                emitted = True

        # top-5 predictions (for debugging)
        top5_idx = probs.argsort()[-5:][::-1]
        top5 = [(self.ord2sign.get(int(i), ""), float(probs[i])) for i in top5_idx]
        print(f"\nInstant: {self.ord2sign.get(top_idx, '')} ({top_conf:.2f}) | "
              f"Smooth: {smooth_sign} | Emitted: {self.last_emitted_sign} | motion={motion:.4f}")
        for s, c in top5:
            print(f"  {s:20s} {c:.2f}")

        if emitted:
            return self.current_sign, top_conf, top5
        else:
            # return empty string for UI if nothing new was emitted
            return "", None, top5
