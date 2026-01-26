import numpy as np
import os
import json
from glob import glob
from tqdm import tqdm
from sklearn.model_selection import train_test_split
import random

INPUT_SIZE = 64
N_ROWS = 87
N_DIMS = 3

RAW_DIR = "data/raw"
OUT_DIR = "data/processed"
os.makedirs(OUT_DIR, exist_ok=True)


LABEL_MAP_PATH = "ord2sign.json"
if os.path.exists(LABEL_MAP_PATH):
    with open(LABEL_MAP_PATH, "r") as f:
        ORD2SIGN = json.load(f)
else:
    ORD2SIGN = {}

SIGN2ORD = {v: int(k) for k, v in ORD2SIGN.items()}

# landmark indices
LIPS_IDXS = np.array([
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
    291, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
    95, 88, 178, 87, 14, 317, 402, 318, 324, 308
])

LEFT_HAND_IDXS = np.arange(489, 510)
RIGHT_HAND_IDXS = np.arange(522, 543)

POSE_IDXS = np.array([468, 469, 470, 471, 472])

LANDMARK_IDXS = np.concatenate([LIPS_IDXS, LEFT_HAND_IDXS, RIGHT_HAND_IDXS, POSE_IDXS])

assert len(LANDMARK_IDXS) == 87

# data augmentation functions
def apply_translation(frames, max_translation=0.1):
    """Translate landmarks by a small random amount."""
    translation = np.random.uniform(-max_translation, max_translation, size=(frames.shape[0], frames.shape[1], 2))
    frames[:, :, :2] += translation 
    return frames

def apply_rotation(frames, max_angle=30):
    """Rotate the landmarks by a random angle."""
    angle = np.random.uniform(-max_angle, max_angle)
    angle = np.radians(angle)
    rotation_matrix = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    
    for i in range(frames.shape[0]):
        for j in range(frames.shape[1]):
            x, y = frames[i, j, :2]
            rotated = np.dot(rotation_matrix, np.array([x, y]))
            frames[i, j, :2] = rotated
            
    return frames

def apply_scaling(frames, scale_range=(0.9, 1.1)):
    """Scale the landmarks by a random factor."""
    scale_factor = np.random.uniform(*scale_range)
    frames[:, :, :2] *= scale_factor
    return frames

def apply_flipping(frames):
    """Flip the landmarks horizontally (left-right)."""
    frames[:, :, 0] = -frames[:, :, 0]
    return frames

def add_noise(frames, noise_level=0.01):
    """Add random noise to the landmarks."""
    noise = np.random.normal(scale=noise_level, size=frames.shape)
    frames += noise
    return frames

def augment_sample(frames):
    """Apply all augmentations to a given sample."""
    frames = apply_translation(frames)
    frames = apply_rotation(frames)
    frames = apply_scaling(frames)
    if random.random() > 0.5:
        frames = apply_flipping(frames)
    frames = add_noise(frames)
    return frames

def augment_sample(frames):
    """ Apply augmentations to a given sample. """
    frames = apply_translation(frames)
    frames = apply_rotation(frames)
    frames = apply_scaling(frames)
    if random.random() > 0.5:
        frames = apply_flipping(frames)
    frames = add_noise(frames)
    return frames

# matches preprocessing live
def preprocess_sample(raw, augment=False):
    """
    raw: (T, 555, 3)
    returns:
      data: (64, 87, 3)
      frame_idxs: (64,)
    """
    lh_valid = ~np.isnan(raw[:, LEFT_HAND_IDXS]).all(axis=(1, 2))
    rh_valid = ~np.isnan(raw[:, RIGHT_HAND_IDXS]).all(axis=(1, 2))
    valid = lh_valid | rh_valid  # Keep frames where at least one hand is valid

    frames = raw[valid]
    frame_idxs = np.where(valid)[0].astype(np.float32)

    if len(frames) == 0:
        frames = raw[:1]
        frame_idxs = np.array([0], dtype=np.float32)
    frame_idxs -= frame_idxs.min()

    # select landmarks
    frames = frames[:, LANDMARK_IDXS]

    # pad sequence to INPUT_SIZE
    if len(frames) < INPUT_SIZE:
        pad = INPUT_SIZE - len(frames)
        frames = np.pad(frames, ((0, pad), (0, 0), (0, 0)))
        frame_idxs = np.pad(frame_idxs, (0, pad), constant_values=-1)
    else:
        idxs = np.linspace(0, len(frames)-1, INPUT_SIZE).astype(np.int32)
        frames = frames[idxs]
        frame_idxs = frame_idxs[idxs]

    # replace NaNs with zeros
    frames = np.nan_to_num(frames)

    if augment:
        frames = augment_sample(frames)

    return frames.astype(np.float32), frame_idxs.astype(np.float32)

if __name__ == "__main__":
    X, y, idxs = [], [], []
    processed, failed = [], []
    for sign in tqdm(sorted(os.listdir(RAW_DIR))):
        try:
            if sign not in SIGN2ORD:
                new_id = len(SIGN2ORD)
                SIGN2ORD[sign] = new_id
                ORD2SIGN[str(new_id)] = sign

            label = SIGN2ORD[sign]

            for fp in glob(f"{RAW_DIR}/{sign}/*.npy"):
                raw = np.load(fp)
                augment = random.random() > 0.5
                d, i = preprocess_sample(raw, augment=augment)
                X.append(d)
                idxs.append(i)
                y.append(label)

            processed.append(sign)

        except Exception as e:
            print(f"Failed {sign}: {e}")
            failed.append(sign)

    # save label map
    with open("ord2sign_personal.json", "w") as f:
        json.dump(ORD2SIGN, f, indent=2)

    X = np.stack(X)
    y = np.array(y, dtype=np.int32)
    idxs = np.stack(idxs)

    # save processed data
    np.save(f"{OUT_DIR}/X.npy", X)
    np.save(f"{OUT_DIR}/y.npy", y)
    np.save(f"{OUT_DIR}/NON_EMPTY_FRAME_IDXS.npy", idxs)

    print("Preprocessing complete")
