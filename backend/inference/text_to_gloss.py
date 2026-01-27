import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
from nltk import pos_tag, word_tokenize

# this file is for converting english text --> asl-styled text
# ex: "I like to go to parks." --> "ME LIKE GO PARK"

nltk.download('punkt')
nltk.download('averaged_perceptron_tagger_eng')
nltk.download('wordnet')
nltk.download('omw-1.4')
nltk.download('stopwords')

lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))

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

import string

def english_to_asl_keywords(sentence):
    words = word_tokenize(sentence.lower())

    keywords = []
    tagged = pos_tag(words)

    for word, tag in tagged:
        # skip punctuation
        if word in string.punctuation:
            continue

        # remove filler words
        if word in stop_words and word not in PRONOUN_MAP:
            continue

        # map pronouns first
        if word in PRONOUN_MAP:
            keywords.append(PRONOUN_MAP[word])
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

        # uppercase for ASL style
        keywords.append(lemma.upper())

    return " ".join(keywords)
