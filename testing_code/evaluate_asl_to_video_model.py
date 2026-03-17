import numpy as np 
import tensorflow as tf
import json
from sklearn.model_selection import train_test_split
from tqdm import tqdm

INPUT_SIZE = 64
N_ROWS = 87
N_DIMS = 3
BATCH_SIZE = 16

with open("ord2sign.json", "r") as f:
    ORD2SIGN = json.load(f)

X = np.load("data/processed/X.npy").astype(np.float32)
y = np.load("data/processed/y.npy").astype(np.int32)
non_empty_frame_idxs = np.load(
    "data/processed/NON_EMPTY_FRAME_IDXS.npy"
).astype(np.float32)

# same split as training
_, X_val, _, y_val, _, idx_val = train_test_split(
    X, y, non_empty_frame_idxs,
    test_size=0.1,
    random_state=42,
    stratify=y
)

interpreter = tf.lite.Interpreter(
    model_path="asl_to_text_model.tflite"
)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

log_file = open("evaluate_asl_model_results.txt", "w")

# just check model looks right first
log_file.write("\nInputs: " + str(input_details) + "\n")
log_file.write("\nOutputs: " + str(output_details) + "\n\n")

num_samples = len(X_val)
num_batches = int(np.ceil(num_samples / BATCH_SIZE))

correct = 0
total = 0
all_predictions = []
# iterate over each batch
for i in tqdm(range(num_batches), desc="Evaluating"):
    start = i * BATCH_SIZE
    end = min(start + BATCH_SIZE, num_samples)

    frames_batch = X_val[start:end]
    idxs_batch = idx_val[start:end]
    y_batch = y_val[start:end]

    # iterate over each sample in the batch
    for j in range(len(frames_batch)):
        frame = frames_batch[j:j+1]  # shape: (1, 64, 87, 3)
        idx = idxs_batch[j:j+1]  # shape: (1, 64)
        
        # Set the input tensors for each individual sample
        idxs_input = input_details[0]["index"]
        frames_input = input_details[1]["index"]

        interpreter.set_tensor(idxs_input, idx)
        interpreter.set_tensor(frames_input, frame)
        interpreter.invoke()

        probs = interpreter.get_tensor(output_details[0]["index"])
        preds = np.argmax(probs, axis=-1)

        correct += np.sum(preds == y_batch[j])  # compare prediction to ground truth label
        total += 1

        all_predictions.append(probs)

accuracy = correct / total
log_file.write(f"\nAccuracy: {accuracy:.4f}\n")

all_predictions = np.concatenate(all_predictions, axis=0)

log_file.write("\nIn-depth Evaluation (per sample):\n")
for i in range(len(all_predictions)): # showing ALL sample prediction results
    true_label = ORD2SIGN[str(y_val[i])]
    pred_idx = np.argmax(all_predictions[i])
    pred_label = ORD2SIGN[str(pred_idx)]
    confidence = all_predictions[i][pred_idx]
    log_file.write(f"True: {true_label}, Pred: {pred_label}, Conf: {confidence:.2f}\n")

log_file.close()