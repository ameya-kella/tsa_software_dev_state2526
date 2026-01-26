export const LIPS_IDXS = [
  61,185,40,39,37,0,267,269,270,409,
  291,146,91,181,84,17,314,405,321,375,
  78,191,80,81,82,13,312,311,310,415,
  95,88,178,87,14,317,402,318,324,308
];

export const LEFT_HAND_IDXS = Array.from({length:21}, (_,i)=>468+i);
export const RIGHT_HAND_IDXS = Array.from({length:21}, (_,i)=>522+i);

export const LEFT_POSE_IDXS = [502,504,506,508,510];
export const RIGHT_POSE_IDXS = [503,505,507,509,511];

export const LANDMARK_IDXS_LEFT_DOM = [...LIPS_IDXS, ...LEFT_HAND_IDXS, ...LEFT_POSE_IDXS];
export const LANDMARK_IDXS_RIGHT_DOM = [...LIPS_IDXS, ...RIGHT_HAND_IDXS, ...RIGHT_POSE_IDXS];
