# TSA HS Software Development - State Presubmission - Signify
Team ID: 2057-1

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

### One-Way Hashing
Additionally, users can save the conversations they have by creating an account. To enable security for the user's username and password, we have employed a one-way hashing system.
1. The plain-text password is used as the initial raw data for processing.
2. A random string is generated and added to the password to ensure identical passwords have different hashes.
3. Functions like SHA-256 or PBKDF2 are chosen within CryptoJS.
4. Logical operations that scramble the input data into a non-linear state.
5. Multiple rounds of mixing are done to ensure the output cannot be reversed.
6. A fixed-length hexadecimal string is produced to be stored in the database in place of the actual password.

Once the user has logged in, the conversations they have are also stored in the database to enable revisiting.


## Hardware/Software:
Hardware / Software:
Brand/Model of Computer: Acer Nitro ANV15-41
- This computer is equipped with a built-in dedicated graphics card (NVIDIA GeForce RTX 4060 Laptop GPU). This allows our program to run faster despite complicated and time-intensive ML techniques.
Google Colab Workspace Online GPUs were also employed in the creation and training of the models used in the application.

Software Installed:
- Windows 11
- Visual Studio Code
- Python 3.12.3
- Libraries/Frameworks: We have installed mediapipe, open-cv, tensorflow, keras, pandas, numpy, sci-kit learn, nltk, pytorch, moviepy, ffmpeg, expo, sqlalchemy, passlib, pydantic, expo, fastapi, uvicorn, and react-native
- WebSockets for server

## Code Structure:
The main two folders with our code are "app" and "backend." The "app" folder contains the UI-related code, while the "backend" folder contains scripts for the backend of our app, which we have set up locally using WebSockets. 

Due to the large size of the models, we did not upload them here; however, they are available for download at https://drive.google.com/drive/folders/1x0KjHnAD7iHUkfxQgbU40-mMhUUc9zPu?usp=sharing. To view the model architectures and frameworks we used, you can find them inside the "backend" folder.

## Software Development Process - Important Notes
### Project Timeline
Going into this project, we wanted to have a clear idea of the features for this application as well as a method to hold each other accountable. So, at the beginning of our development, we created this calendar: https://docs.google.com/spreadsheets/d/1gJzG0SG803LZEIrRAKYUECLalSRudhfAjnKcNfPmmAE/edit?usp=sharing

Additionally, our team brainstormed different ideas and mapped out the scope of the project at these early stages as well. These ideas are located at the following document (Tab 1 contains our brainstorming for app ideas as well as how to implement them while Tab 2 contains the notes for how to structure the models): https://docs.google.com/document/d/1z1Fp5Pja9lyfngQQKyaTcJN5SEB8MC9H5KGYyzJfTEI/edit?tab=t.xe9n8yzcevh9

### Project Development
#### Repositories
This GitHub repository only includes changes made for the Texas TSA State competition and does not have changes from before. As a team, we decided to have different repositories for each level of the competition as well as for major milestones. This allows for easier reflection while also serving as a good documentation method.

If you would like to see our repositories for the different levels, you may do so here:
* The repository submitted for our regionals competition as an intermediate step can be found here: https://github.com/ameya-kella/tsa_software_dev_regionals2526
* Additionally, the work we made before regionals can be found here: https://github.com/ameya-kella/tsa_software_dev_2526

#### Google Colab Workspace
This project's development has the need for intensive operations using libraries such as Tensorflow and PyTorch. However, some of our teammates worked on shared computers which has hardware restrictions such as low RAM and a lack of GPU structures. Additionally, they were unable to commit changes to the GitHub as they could not make push requests from their devices.

Google Colab's services offered a solution for our team. The workspace provides access to free GPUs and TPUs requiring only a stable internet connection. As such, these teammates were able to collaborate using this workspace. Then, other teammates were able to implement their changes which included some of the models, e.g. ASL Gloss → English Text, English Text → ASL Gloss, and English Text → Speech: https://colab.research.google.com/drive/1vo6ZUE-q_wBkPd7w1GoT63aWinTPiAA9

### Project Testing 
Once we created a minimum viable product (MVP) as well as while we continued to develop the application, we frequently tested our models to ensure accuracy and limit bias. You can find our testing documentation at the folder called "testing_code" which contains evaluation scripts as well as results for the two models employed.

Along with this, we systematically tested our ASL → Text model using our camera as well as doing the same for other features (Text → Speech, Text → Gloss, etc.) to ensure the user experience worked properly.

## Usage / Installation:
To test out our app on your own, install all necessary libraries stated in the "requirements.txt" file.

```pip install -r requirements.txt```

You may also need to download certain nltk corpora used in our program.

```python -m nltk.downloader punkt averaged_perceptron_tagger_eng wordnet omw-1.4 stopwords```


