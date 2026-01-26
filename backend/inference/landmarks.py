import numpy as np
# 40 face landmarks
LIPS_IDXS = np.array([
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
    291, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
    95, 88, 178, 87, 14, 317, 402, 318, 324, 308
])
# 21 landmarks for left hand
LEFT_HAND_IDXS = np.array([
    468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 
    478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 
    488
])
# 21 landmarks for right hand
RIGHT_HAND_IDXS = np.array([
    522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 
    532, 533, 534, 535, 536, 537, 538, 539, 540, 541, 
    542
])
# 5 pose landmarks
POSE_IDXS = np.array([502, 503, 504, 505, 506]) 

# combine all landmarks --> 40 + 21 + 21 + 5 = 87 landmarks
LANDMARK_IDXS = np.concatenate([LIPS_IDXS, LEFT_HAND_IDXS, RIGHT_HAND_IDXS, POSE_IDXS]) 

def process_landmarks(rgb, face_mesh, hands, pose):
    return (
        face_mesh.process(rgb),
        hands.process(rgb),
        pose.process(rgb),
    )

# extracting landmarks
def extract_87_landmarks(face_res, hand_res, pose_res):
    # initialize a placeholder for 87 landmarks (x, y, z for each)
    landmarks = np.full((87, 3), np.nan, dtype=np.float32)

    if face_res.multi_face_landmarks: # face
         # only take first 40 landmarks for face
        for i, lm in enumerate(face_res.multi_face_landmarks[0].landmark[:40]):
            landmarks[i] = [lm.x, lm.y, lm.z]

    if pose_res.pose_landmarks: # pose
        # only take first 5 landmarks for pose
        for i, lm in enumerate(pose_res.pose_landmarks.landmark[:5]):
            landmarks[40 + i] = [lm.x, lm.y, lm.z]

    if hand_res.multi_hand_landmarks: # hands
        for hand_lms, handedness in zip(hand_res.multi_hand_landmarks, hand_res.multi_handedness):
            if handedness.classification[0].label == "Left":
                for i, lm in enumerate(hand_lms.landmark):
                    # left hand goes from index 45
                    landmarks[45 + i] = [lm.x, lm.y, lm.z]
            else:  # right hand
                for i, lm in enumerate(hand_lms.landmark):
                    # right hand goes from index 66
                    landmarks[66 + i] = [lm.x, lm.y, lm.z]

    return landmarks
