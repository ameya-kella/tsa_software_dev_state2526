import torch
import nltk
import evaluate
import numpy as np
from datasets import load_dataset
from transformers import T5Tokenizer, DataCollatorForSeq2Seq
from transformers import T5ForConditionalGeneration, Seq2SeqTrainingArguments, Seq2SeqTrainer

device = "cuda" if torch.cuda.is_available() else "cpu"
print(device)
# load the tokenizer, model, and data collator
MODEL_NAME = "google/flan-t5-base"
tokenizer = T5Tokenizer.from_pretrained(MODEL_NAME)
model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME).to(device)
data_collator = DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model)

DATA_NAME = "aslg_pc12"
dataset = load_dataset(DATA_NAME)

dataset = dataset["train"].shuffle(seed=42)

dataset = dataset.train_test_split(test_size=0.2, seed=42)

# prompt for model
prefix = "Translate the following American Sign Language (ASL) gloss sequence into a grammatical English sentence: "

# define the pre-processing function
def preprocess(examples):
  inputs = [prefix + i.strip().lower() for i in examples["gloss"]]
  model_inputs = tokenizer(inputs, max_length = 128, truncation = True)

  targets = []
  for text in examples["text"]:
    text = text.strip().lower()
    if not text.endswith("."):
      text += "."
    targets.append(text)

  # the labels are the tokenized outputs
  labels = tokenizer(text_target = targets, max_length = 128, truncation = True)

  model_inputs["labels"] = labels["input_ids"]
  return model_inputs

tokenized_dataset = dataset.map(preprocess, batched = True)

nltk.download("punkt")
nltk.download("punkt_tab")
metric = evaluate.load("rouge")

def compute_metrics(eval_preds):
  preds, labels = eval_preds

  # decode the preds and labels
  labels = np.where(labels != -100, labels, tokenizer.pad_token_id)
  decoded_preds = tokenizer.batch_decode(preds, skip_special_tokens = True)
  decoded_labels = tokenizer.batch_decode(labels, skip_special_tokens = True)

  decoded_preds = ["\n".join(nltk.sent_tokenize(pred.strip())) for pred in decoded_preds]
  decoded_labels = ["\n".join(nltk.sent_tokenize(label.strip())) for label in decoded_labels]

  result = metric.compute(predictions=decoded_preds, references=decoded_labels, use_stemmer=True)

  return result

# global parameters
L_RATE = 3e-4
BATCH_SIZE = 8
PER_DEVICE_EVAL_BATCH = 8
WEIGHT_DECAY = 0.01
SAVE_TOTAL_LIM = 3
NUM_EPOCHS = 5

training_args = Seq2SeqTrainingArguments(
  output_dir = './results',
  evaluation_strategy = "epoch",
  save_strategy = "epoch",
  learning_rate = L_RATE,
  per_device_train_batch_size = BATCH_SIZE,
  per_device_eval_batch_size = PER_DEVICE_EVAL_BATCH,
  weight_decay = WEIGHT_DECAY,
  save_total_limit = SAVE_TOTAL_LIM,
  num_train_epochs = NUM_EPOCHS,
  predict_with_generate = False,
  fp16 = False,
  bf16 = False,
  push_to_hub = False,
  logging_strategy = "epoch",
  report_to = "none"
)

trainer = Seq2SeqTrainer(
  model=model,
  args=training_args,
  train_dataset=tokenized_dataset["train"],
  eval_dataset=tokenized_dataset["test"],
  tokenizer=tokenizer,
  data_collator=data_collator,
  compute_metrics = None
)

trainer.train()

# saving the model
from transformers.trainer_utils import get_last_checkpoint

last_checkpoint = get_last_checkpoint("./results")

finetuned_model = T5ForConditionalGeneration.from_pretrained(last_checkpoint)
tokenizer = T5Tokenizer.from_pretrained(last_checkpoint)

# save the final model and tokenizer after training
finetuned_model.save_pretrained("./final_model")
tokenizer.save_pretrained("./final_model")