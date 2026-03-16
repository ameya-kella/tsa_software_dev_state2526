# for preprocessing the individual word videos (with the same signer) 
# so that they can be combined later for signing the full message of the non-deaf user
import os
from pathlib import Path
import numpy as np
import cv2
import mediapipe as mp
from moviepy.video.io.VideoFileClip import VideoFileClip
from moviepy.video.VideoClip import VideoClip
import gc
import time
import sys


# directories (on personal computer -- not here)
INPUT_DIR = "videos_same_signer"
OUTPUT_DIR = "sign_videos_preprocessed"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_W = 1280
TARGET_H = 720
SAMPLE_FRAMES = 25
PADDING_RATIO = 0.18
TARGET_FPS = 30

mp_pose = mp.solutions.pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
mp_hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.5)

# detecting morion to find where the signer is, along with other functions
def detect_motion_window(video_path):
    cap = cv2.VideoCapture(video_path)
    motions, prev_center = [], None
    while True:
        ret, frame = cap.read()
        if not ret: break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = mp_hands.process(rgb)
        if not result.multi_hand_landmarks:
            motions.append(0)
            continue
        centers = [[np.mean([lm.x for lm in h.landmark]),
                    np.mean([lm.y for lm in h.landmark])] for h in result.multi_hand_landmarks]
        center = np.mean(centers, axis=0)
        motions.append(0 if prev_center is None else np.linalg.norm(center - prev_center))
        prev_center = center
    cap.release()
    motions = np.array(motions)
    if len(motions) == 0: return None
    threshold = np.percentile(motions, 25)
    active = np.where(motions > threshold)[0]
    if len(active) == 0: return None
    return int(active[0]), int(active[-1])

def compute_pose_bbox(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = mp_pose.process(rgb)
    if not result.pose_landmarks: return None
    lm = result.pose_landmarks.landmark
    xs = [int(p.x * frame.shape[1]) for p in lm]
    ys = [int(p.y * frame.shape[0]) for p in lm]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    return x0, y0, x1, y1

def compute_global_bbox(video_path, sample_frames=SAMPLE_FRAMES):
    cap = cv2.VideoCapture(video_path)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_rate = max(1, frame_count // sample_frames)
    boxes = []
    for i in range(frame_count):
        ret, frame = cap.read()
        if not ret: break
        if i % sample_rate != 0: continue
        bbox = compute_pose_bbox(frame)
        if bbox: boxes.append(bbox)
    cap.release()
    if not boxes: return None
    boxes = np.array(boxes)
    x0, y0 = int(np.percentile(boxes[:,0], 5)), int(np.percentile(boxes[:,1], 5))
    x1, y1 = int(np.percentile(boxes[:,2], 95)), int(np.percentile(boxes[:,3], 95))
    return x0, y0, x1, y1

def expand_box(box, frame_w, frame_h):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    pad_w, pad_h = int(w * PADDING_RATIO), int(h * PADDING_RATIO)
    x0, y0 = max(0, x0 - pad_w), max(0, y0 - pad_h)
    x1, y1 = min(frame_w, x1 + pad_w), min(frame_h, y1 + pad_h)
    return x0, y0, x1, y1

# padding the outsides (after centering the signer's location) with a blur-type fade
def padding_outsides(frame, bbox, frame_w, frame_h, target_w=1280, target_h=720):
    x0, y0, x1, y1 = expand_box(bbox, frame_w, frame_h)
    blurred_bg = cv2.GaussianBlur(frame, (51,51), 0)
    blurred_bg[y0:y1, x0:x1] = frame[y0:y1, x0:x1]

    # resize frame to fit target while keeping aspect ratio
    scale = min(target_w / frame_w, target_h / frame_h)
    new_w, new_h = int(frame_w * scale), int(frame_h * scale)
    resized = cv2.resize(blurred_bg, (new_w, new_h))

    final_bg = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2
    final_bg[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    return final_bg


# main preprocessing function -- puts everything together
def preprocess_video(video_path):
    name = Path(video_path).stem
    final_path = os.path.join(OUTPUT_DIR, f"{name}_processed.mp4")

    # Skip if already processed (in case needing to resume mid-way)
    if os.path.exists(final_path):
        print(f"Skipping {name}, already processed")
        return True

    clip = VideoFileClip(video_path)
    frame_w, frame_h = clip.w, clip.h

    bbox = compute_global_bbox(video_path)
    if not bbox: 
        print(f"No signer detected in {name} -- skipping")
        return False

    motion = detect_motion_window(video_path)
    if motion: 
        start, end = motion
    else: 
        start, end = 0, int(clip.duration * clip.fps) - 1

    clip = clip.subclipped(start / clip.fps, end / clip.fps)

    def process_frame(frame):
        return pad_with_blur_no_signer_final(frame, bbox, frame_w, frame_h)

    final_clip = VideoClip(lambda t: process_frame(clip.get_frame(t)), duration=clip.duration)
    final_clip.fps = TARGET_FPS

    final_clip.write_videofile(final_path, codec='libx264', audio=False)

    # preventing OOM crash
    final_clip.close()
    clip.close()
    gc.collect()

    return True

# in case crash was not on purpose, allow it to retry up to 3 times
MAX_RETRIES = 3

def main():
    videos = [f for f in os.listdir(INPUT_DIR) if f.endswith(".mp4")]
    total = len(videos)
    start_time = time.time()

    for i, v in enumerate(videos, 1):

        elapsed = time.time() - start_time
        avg_time_per_video = elapsed / max(1, i)
        remaining = total - i
        eta = remaining * avg_time_per_video
        eta_min, eta_sec = divmod(int(eta), 60)

        sys.stdout.write(f"\rProcessing {i}/{total}: {v} | ETA: {eta_min}m {eta_sec}s ")
        sys.stdout.flush()

        retries = 0
        success = False

        while not success and retries < MAX_RETRIES:
            try:
                preprocess_video(os.path.join(INPUT_DIR, v))
                success = True

            except Exception as e:
                retries += 1
                print(f"\n Crash on {v} (attempt {retries}/{MAX_RETRIES})")
                print(e)

                gc.collect()
                time.sleep(5)

        if not success:
            print(f"\nFailed after {MAX_RETRIES} attempts: {v}")
            print("Moving on — it will retry if you restart the script later.")

    print("\nDone preprocessing")

if __name__ == "__main__":
    main()