import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
from nltk import pos_tag, word_tokenize
import os
import string
from pathlib import Path


# this file is for converting english text --> asl-styled text
# ex: "I like to go to parks." --> "ME LIKE GO PARK"

lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))
stop_words.update({"a", "an", "the"})

# mappings for aiding conversion
PRONOUN_MAP = {
    "i": "ME",
    "me": "ME",
    "my": "MY",
    "you": "YOU",
    "your": "YOUR",
    "he": "HE",
    "she": "SHE",
    "we": "WE",
    "they": "THEY",
    "him": "HE",
    "her": "SHE",
    "us": "WE",
    "them": "THEY",
}

AUX_MAP = {
    "am": "",
    "is": "",
    "are": "",
    "was": "",
    "were": "",
    "be": "",
    "been": "",
    "being": "",
    "have": "",
    "has": "",
    "had": "",
    "do": "",
    "does": "",
    "did": "",
    "will": "",
    "shall": "",
    "would": "",
    "should": "",
    "can": "",
    "could": "",
    "may": "",
    "might": "",
    "must": "",
}

# ASL grammar usually puts time words first
TIME_WORDS = {
    "yesterday", "today", "tomorrow",
    "now", "later", "tonight",
    "morning", "afternoon", "evening",
    "week", "month", "year"
}


BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
VIDEO_DIR = BACKEND_DIR / "data" / "sample_videos_preprocessed"

# for checking if raw word already has a processed video
AVAILABLE_SIGNS = {
    f.stem.replace("_processed", "")
    for f in VIDEO_DIR.glob("*_processed.mp4")
}
# function to map NLTK POS tags to WordNet POS
def get_wordnet_pos(treebank_tag):
    if treebank_tag.startswith('J'):
        return wordnet.ADJ
    elif treebank_tag.startswith('V'):
        return wordnet.VERB
    elif treebank_tag.startswith('N'):
        return wordnet.NOUN
    elif treebank_tag.startswith('R'):
        return wordnet.ADV
    else:
        return None


def english_to_asl_keywords(sentence):
    words = word_tokenize(sentence.lower())
    print(words)

    final_tokens = []

    for word in words:
        if word in string.punctuation:
            continue

        
        if word in AVAILABLE_SIGNS:
            final_tokens.append(word.upper())
            continue

        # otherwise do NLP like normal
        tagged = pos_tag([word])[0]
        tag = tagged[1]

        # remove filler words
        if word in stop_words and word not in PRONOUN_MAP:
            continue

        # map pronouns first
        if word in PRONOUN_MAP:
            final_tokens.append(PRONOUN_MAP[word])
            continue

        # remove auxiliaries
        if word in AUX_MAP:
            continue

        # lemmatize
        wn_tag = get_wordnet_pos(tag)
        if wn_tag is not None:
            lemma = lemmatizer.lemmatize(word, pos=wn_tag)
        else:
            lemma = word

        final_tokens.append(lemma.upper())

    time_tokens = []
    main_tokens = []

    for word in final_tokens:
        if word.lower() in TIME_WORDS:
            time_tokens.append(word.upper())
        else:
            main_tokens.append(word)

    return " ".join(time_tokens + main_tokens)