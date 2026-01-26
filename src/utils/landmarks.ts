import { LANDMARK_IDXS_LEFT_DOM, LANDMARK_IDXS_RIGHT_DOM, LEFT_HAND_IDXS, RIGHT_HAND_IDXS } from "./landmarkConstants";
import { INPUT_SIZE } from "../../src/config"; // add INPUT_SIZE in a config file

/**
 * Preprocess a sequence of 543x3 landmarks for the ML model
 * - seq: array of frames, each frame is 543x3
 * - returns:
 *    frames: [1, INPUT_SIZE, N]  (batch dimension included)
 *    frameIdxs: [1, INPUT_SIZE]
 */
export function preprocessLiveSequence(seq: number[][][]): { frames: number[][][][]; frameIdxs: number[][] } | null {
    if (!seq.length) return null;

    const data = seq.map(f => f.map(v => v.slice())); // deep copy

    // Determine dominant hand
    const leftSum = data.map(f => LEFT_HAND_IDXS.reduce((sum, idx) => sum + f[idx].filter(v => !isNaN(v)).length, 0));
    const rightSum = data.map(f => RIGHT_HAND_IDXS.reduce((sum, idx) => sum + f[idx].filter(v => !isNaN(v)).length, 0));
    const leftDom = leftSum.reduce((a, b) => a + b, 0) >= rightSum.reduce((a, b) => a + b, 0);

    const idxs = leftDom ? LANDMARK_IDXS_LEFT_DOM : LANDMARK_IDXS_RIGHT_DOM;
    const handIdxs = leftDom ? LEFT_HAND_IDXS : RIGHT_HAND_IDXS;

    // Filter frames with at least one hand landmark present
    const validFrames: number[] = [];
    data.forEach((f, i) => {
        const handNonNaN = handIdxs.reduce((sum, idx) => sum + f[idx].filter(v => !isNaN(v)).length, 0);
        if (handNonNaN > 0) validFrames.push(i);
    });

    if (!validFrames.length) return null;

    let filteredData = validFrames.map(i => idxs.map(idx => data[i][idx])); // [numValidFrames, N, 3]

    // Create frameIdxs
    let frameIdxs = validFrames.map((i, _, arr) => i - arr[0]);

    // ----- PAD OR SLICE TO INPUT_SIZE -----
    if (filteredData.length < INPUT_SIZE) {
        const padCount = INPUT_SIZE - filteredData.length;
        const padFrame = filteredData[filteredData.length - 1].map(f => f.map(() => 0)); // zero pad
        for (let i = 0; i < padCount; i++) filteredData.push(padFrame);
        frameIdxs = [...frameIdxs, ...Array(padCount).fill(-1)];
    } else if (filteredData.length > INPUT_SIZE) {
        const sel = Array.from({ length: INPUT_SIZE }, (_, i) =>
        Math.floor((i / (INPUT_SIZE - 1)) * (filteredData.length - 1))
        );
        filteredData = sel.map(i => filteredData[i]);
        frameIdxs = sel.map(i => frameIdxs[i]);
    }

    // Replace NaNs with 0
    filteredData = filteredData.map(frame => frame.map(lm => lm.map(v => isNaN(v) ? 0 : v)));

    return {
        frames: [filteredData],  // shape [1, INPUT_SIZE, 543, 3]
        frameIdxs: [frameIdxs],  // shape [1, INPUT_SIZE]
    };


}

// Converts MediaPipe results into a 543x3 array
export function extract543Landmarks(faceRes: any, handRes: any, poseRes: any): number[][] {
  const landmarks: number[][] = Array(543)
    .fill(0)
    .map(() => [NaN, NaN, NaN]);

  // Face
  if (faceRes.multiFaceLandmarks?.length) {
    for (let i = 0; i < faceRes.multiFaceLandmarks[0].length; i++) {
      const lm = faceRes.multiFaceLandmarks[0][i];
      landmarks[i] = [lm.x, lm.y, lm.z];
    }
  }

  // Pose (first 10 landmarks)
  if (poseRes.poseLandmarks) {
    for (let i = 0; i < 10; i++) {
      const lm = poseRes.poseLandmarks[i];
      landmarks[502 + i] = [lm.x, lm.y, lm.z];
    }
  }

  // Hands
  if (handRes.multiHandLandmarks?.length) {
    for (let h = 0; h < handRes.multiHandLandmarks.length; h++) {
      const handLms = handRes.multiHandLandmarks[h];
      const handedness = handRes.multiHandedness[h].label; // "Left" or "Right"
      const baseIdx = handedness === "Left" ? 468 : 522;

      for (let i = 0; i < handLms.length; i++) {
        const lm = handLms[i];
        landmarks[baseIdx + i] = [lm.x, lm.y, lm.z];
      }
    }
  }

  return landmarks;
}

