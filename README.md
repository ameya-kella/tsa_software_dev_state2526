# TSA HS Software Development - State Presubmission - Signify
Our app, named Signify, aims to bridge the gap that exists between the hearing-impaired and those they wish to communicate with by providing an innovative solution for continuous sign language detection and translation. Through our application, users will be able to real-time record themselves going through ASL (American Sign Language) motions. We used machine learning and computer vision techniques, specifically a Tensorflow model. As the sign language is done by the user in front of the device camera, the application will convert it to English text in real time, followed by speech, allowing for seamless translation. We also have implemented a live conversation feature as well, through which someone without hearing disabilities (and likely not fluent in ASL) can respond back, either with audio or text. This allows for a simulated conversation with limited delay, facilitating both casual and emergency situations. This application ultimately enables the hearing-impaired to communicate with a larger variety of people, reducing the barriers that exist for them in the world.

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
* Video Playback of ASL Signs
  + Once the non-deaf user's message is converted into ASL-style English, the deaf user has the option to view that message in the form of a video showing a professional signer doing the motions for each individual word. This is an even more convenient way for the deaf user to understand the message.
  + We do this by utilizing moviepy to preprocess every video of the same signer. Then, in real-time, we concatenate the video files (each representing one sign/gloss) using ffmpeg to form the full message.
      + Videos are from the WLASL dataset: https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed

////// add info about the login feature (not asymmetric encryption but a robust hashing method) here --> then go into how chats are saved ///////

## Hardware/Software:
Hardware / Software:
Brand/Model of Computer: Acer Nitro ANV15-41
- This computer is equipped with a built-in dedicated graphics card (NVIDIA GeForce RTX 4060 Laptop GPU). This allows our program to run faster despite complicated and time-intensive ML techniques.

Software Installed:
- Windows 11
- Visual Studio Code
- Python 3.12.3
- Libraries/Frameworks: We have installed mediapipe, open-cv, tensorflow, keras, pandas, numpy, sci-kit learn, nltk, pytorch, moviepy, ffmpeg, expo, sqlalchemy, passlib, pydantic, expo, fastapi, uvicorn, and react-native
- WebSockets for server

## Code structure:
The main two folders with our code are "app" and "backend." The "app" folder contains the UI-related code, while the "backend" folder contains scripts for the backend of our app, which we have set up locally using WebSockets. 

Due to the large size of the models, we did not upload them here; however, they are available for download at https://drive.google.com/drive/folders/1x0KjHnAD7iHUkfxQgbU40-mMhUUc9zPu?usp=sharing. To view the model architectures and frameworks we used, you can find them inside the "backend" folder.

## Software Development Process - Important Notes
///things we could talk about / include (fix wording, organization, etc) 
* this repository was created after regionals, so it doesnt have our history from before
* this was the repository that we submitted for regionals (as an intermediate step for our progress): https://github.com/ameya-kella/tsa_software_dev_regionals2526
* this was the repository we used before regionals as we worked on it:https://github.com/ameya-kella/tsa_software_dev_2526
* we used diff repositories for diff levels in the competition because when we look back at this project later, we want to be able to know what features were implemented by what levels in the competition (idk if this makes sense)
* since some teammates were not able to collaborate on github and contribute personally (due to reasons like using shared computers), they sent code to other members. one form of this communication is through this Google Colab: https://colab.research.google.com/drive/1vo6ZUE-q_wBkPd7w1GoT63aWinTPiAA9
* calendar / project timeline: https://docs.google.com/spreadsheets/d/1gJzG0SG803LZEIrRAKYUECLalSRudhfAjnKcNfPmmAE/edit?usp=sharing
* we could also add this doc if wanted (esp the notes for how to structure the models):https://docs.google.com/document/d/1z1Fp5Pja9lyfngQQKyaTcJN5SEB8MC9H5KGYyzJfTEI/edit?tab=t.xe9n8yzcevh9
* TESTING -- i made a new folder in code called "testing_code" -- has evaluation scripts and results for the two models
  + as for other testing mechanisms, we systematically tested the asl-to-text model using our real-time camera as well as did the same thing for other features (like text-to-speech, text-to-gloss, etc)

## Usage / Installation:
To test out our app on your own, install all necessary libraries stated in the "requirements.txt" file.

```pip install -r requirements.txt```

You may also need to download certain nltk corpora used in our program.

```python -m nltk.downloader punkt averaged_perceptron_tagger_eng wordnet omw-1.4 stopwords```


