import torch
import nltk
import evaluate
from datasets import load_dataset
from transformers import T5Tokenizer, T5ForConditionalGeneration
from tqdm import tqdm


device = "cuda" if torch.cuda.is_available() else "cpu"

MODEL_PATH = "./sentence_gen_model"
DATA_NAME = "aslg_pc12"
BATCH_SIZE = 8
MAX_NEW_TOKENS = 50
PREFIX = "Translate the following American Sign Language (ASL) gloss sequence into a grammatical English sentence: "

# load model + tokenizer
tokenizer = T5Tokenizer.from_pretrained(MODEL_PATH)
model = T5ForConditionalGeneration.from_pretrained(MODEL_PATH).to(device)

dataset = load_dataset(DATA_NAME)
dataset = dataset["train"].train_test_split(test_size=0.2, seed=42)
test_data = dataset["test"]

SAMPLE_TEST_SIZE = 50 # just test with 50
if len(test_data) > SAMPLE_TEST_SIZE:
    test_data = test_data.select(range(SAMPLE_TEST_SIZE))


nltk.download("punkt")
metric = evaluate.load("rouge")


predictions = []
references = []

num_batches = (len(test_data) + BATCH_SIZE - 1) // BATCH_SIZE

for i in tqdm(range(0, len(test_data), BATCH_SIZE), desc="Evaluating", total=num_batches):
    batch = test_data.select(range(i, min(i + BATCH_SIZE, len(test_data))))
    
    glosses = [PREFIX + g.strip().lower() for g in batch["gloss"]]
    refs = []
    for t in batch["text"]:
        text = t.strip().lower()
        if not text.endswith("."):
            text += "."
        refs.append(text)

    # tokenize batch
    inputs = tokenizer(
        glosses,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=128
    ).to(device)
    
    # generate predictions
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            num_beams=1,
            early_stopping=True
        )
    
    preds = tokenizer.batch_decode(outputs, skip_special_tokens=True)
    
    predictions.extend(preds)
    references.extend(refs)

#compute metrics
results = metric.compute(
    predictions=predictions,
    references=references,
    use_stemmer=True
)


with open("flan_t5_evaluation.txt", "w") as log_file:
    log_file.write("ROUGE Scores:\n")
    for k, v in results.items():
        log_file.write(f"{k}: {v:.4f}\n")

    log_file.write("\nSample Predictions:\n")
    for i in range(len(references)):
        log_file.write(f"\nGloss: {test_data[i]['gloss']}\n")
        log_file.write(f"True: {references[i]}\n")
        log_file.write(f"Pred: {predictions[i]}\n")