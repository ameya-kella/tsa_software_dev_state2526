from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch

# loading pre-trained individual words --> sentence model
MODEL_PATH = "./backend/models/sentence_gen_model"
tokenizer = T5Tokenizer.from_pretrained(MODEL_PATH)
model = T5ForConditionalGeneration.from_pretrained(MODEL_PATH).to("cuda" if torch.cuda.is_available() else "cpu")

def generate_sentence_from_words(recognized_words):    
    # check if recognized_words is empty
    if not recognized_words:
        return "Waiting for input..."
    
    # remove any "TV" words if present
    words = [w for w in recognized_words if w != "TV"]
    if not words:
        return "Waiting for input..."
    
    # prefix = prompt for model (same as what it was trained on)
    prefix = "Translate the following American Sign Language (ASL) gloss sequence into a grammatical English sentence: "
    input_text = prefix + " ".join(words)

    # tokenize the model's input
    inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=128).to(model.device)

    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=50, num_beams=4, early_stopping=True)
    sentence = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return sentence.capitalize()
