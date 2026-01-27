# TSA HS Software Development - Regionals Presubmission - Signify
Our app, named Signify, aims to bridge the gap that exists between the hearing-impaired and those they wish to communicate with by providing an innovative solution for continuous sign language detection and translation. Through our application, users will be able to real-time record themselves going through ASL (American Sign Language) motions. We will used machine learning and computer vision techniques, specifically a Tensorflow model. As the sign language is done by the user in front of the device camera, the application will convert it to English text in real time, followed by speech, allowing for seamless translation. We also have implemented a live conversation feature as well, through which someone without hearing disabilities (and likely not fluent in ASL) can respond back, either with audio or text. This allows for a simulated conversation with limited delay, facilitating both casual and emergency situations. This application ultimately enables the hearing-impaired to communicate with a larger variety of people, reducing the barriers that exist for them in the world.

## Technical Features
### Live Interpreter:
Easy-to-transport way for ASL speakers (especially those with hearing disabilities) to communicate with anyone at any time through ASL to English translation.
* ASL to Words Machine Learning Model
  + A custom Transformer model created using Tensorflow -- predicts landmark sequences of video frames into ASL words or "glosses"
* Words to Sentence model
  + A custom model built using PyTorch that converts a sequence of ASL glosses into grammatically correct English sentences
  + Leverages Google's Flan-T5-base
* Text to Speech (TTS)
  + Takes the computed English sentence and speaks it aloud

### Live Conversation:
Primarily designed for aiding in conversations between those with hearing disabilties and those who are not be fluent in ASL.
This includes all features above, and:
* Speech to Text or Typing
  + Allows a non-deaf user to either speak aloud or type out their responses to the deaf user, converting to text if necessary
* Normal English to ASL-Style English
  + If the deaf user struggles to read regular English due to the grammar gap between ASL and English, we give them the option to see what the non-deaf user said in an ASL gloss format
  + For example, if the non-deaf user said "I want to go to the park today," then this feature would convert that into "ME WANT GO PARK TODAY"

  


## Hardware/Software:
Hardware / Software:
Brand/Model of Computer: Acer Nitro ANV15-41
- This computer is equipped with a built-in dedicated graphics card (NVIDIA GeForce RTX 4060 Laptop GPU). This allows our program to run faster despite complicated and time-intensive ML techniques.

Software Installed:
- Windows 11
- Visual Studio Code
- Python 3.12.3
- Libraries/Frameworks: So far, we have installed mediapipe, open-cv, tensorflow, keras, pandas, numpy, sci-kit learn, nltk, pytorch, expo, and react-native
- WebSockets for server

## Code structure:
The main 2 folders with our code are "app" and "backend." The "app" folder contains the UI-related code, while the "backend" folder contains scripts for the backend of our app, which we have set up locally using WebSockets. 

Due to the large size of the models, we did not upload them here; however, they are available for download at https://drive.google.com/drive/folders/1x0KjHnAD7iHUkfxQgbU40-mMhUUc9zPu?usp=sharing. To view the model architectures and frameworks we used, you can find them inside the "backend" folder.

## Usage / Installation:
To test out our app on your own, install all necessary libraries states n the "requirements.txt" file.

```pip install -r requirements.txt```

You may also need to download certain nltk corpora used in our program.

```python -m nltk.downloader punkt averaged_perceptron_tagger_eng wordnet omw-1.4 stopwords```


