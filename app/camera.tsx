import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  SafeAreaView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";


// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b18",
  },

  cameraWrap: {
    flex: 1,
    position: "relative",
    backgroundColor: "#050b18",
  },

  camera: {
    flex: 1,
  },
  cameraStage: {
  flex: 1,
  backgroundColor: "#050b18",
  overflow: "hidden",
},

topBarSafe: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    zIndex: 50,
  },

  topBar: {
    marginTop: Platform.OS === "android" ? 10 : 6,
    padding: 11,
    borderRadius: 22,
    backgroundColor: "rgba(10,16,34,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  overlayTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  statusPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(96,165,250,0.95)",
  },

  statusText: {
    color: "rgba(255,255,255,0.86)",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.2,
  },

  homeButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  pausedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },

  pausedText: {
    color: "rgba(59,130,246,0.95)",
    fontSize: 82,
    fontWeight: "900",
    transform: [{ rotate: "-18deg" }],
    letterSpacing: 4,
    textShadowColor: "rgba(59,130,246,0.25)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 18,
  },

  thumb: {
    position: "absolute",
    top: 110,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    zIndex: 60,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  thumbImg: {
    width: 64,
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  thumbLabel: {
    marginTop: 6,
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "800",
  },

  panel: {
  position: "absolute",
  left: 14,
  right: 14,
  bottom: 14,
  paddingHorizontal: 14,
  paddingTop: 10,
  paddingBottom: 14,
  borderRadius: 26,
  backgroundColor: "rgba(8,14,30,0.84)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},


  panelHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 10,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  panelTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  link: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "800",
  },

transcriptBox: {
  marginTop: 10,
  backgroundColor: "rgba(0,0,0,0.26)",
  borderRadius: 18,
  padding: 12,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  flex: 1, // allows it to expand without pushing buttons offscreen
},


  label: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  liveText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },

  stableText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15.5,
    fontWeight: "800",
    marginTop: 6,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 10,
  },


controls: {
  flexDirection: "row",
  gap: 10,
  marginTop: 12,
},


  smallBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },

  smallBtnOff: {
    opacity: 0.78,
  },

  smallBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },

primaryCta: {
  marginTop: 12,
  paddingVertical: 13,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(59,130,246,0.92)", 
  borderWidth: 1,
  borderColor: "rgba(147,197,253,0.35)",
  overflow: "hidden",
},

  ctaSheen: {
    position: "absolute",
    top: -40,
    left: -80,
    width: 220,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ rotate: "-18deg" }],
  },

  primaryCtaText: {
    color: "white",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // for permission screen
  center: {
    flex: 1,
    backgroundColor: "#050b18",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  text: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },

  primaryBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(59,130,246,0.92)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.35)",
  },

  primaryBtnText: {
    color: "white",
    fontWeight: "900",
  },
});

// Landmark indices (for extraction)
const LEFT_HAND_IDXS = Array.from({ length: 21 }, (_, i) => 468 + i);
const RIGHT_HAND_IDXS = Array.from({ length: 21 }, (_, i) => 522 + i);
const LEFT_POSE_IDXS = [502, 504, 506, 508, 510];
const RIGHT_POSE_IDXS = [503, 505, 507, 509, 511];
const FACE_IDXS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314,
  405, 321, 375, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 95, 88, 178, 87,
  14, 317, 402, 318, 324, 308,
];

// types for data sent to server
type WSData = {
  current_sign: string;
  confidence: number | null;
  top5: [string, number][] | null;
  recognized_words: string[];
  generated_sentence?: string;
};

// extracting landmarks from frame
const extract543Landmarks = (
  faceResults: any,
  leftHandResults: any,
  rightHandResults: any,
  poseResults: any
) => {
  const landmarks: number[][] = Array.from({ length: 543 }, () => [NaN, NaN, NaN]);

  if (faceResults?.multiFaceLandmarks?.length) {
    const face = faceResults.multiFaceLandmarks[0];
    FACE_IDXS.forEach((idx) => {
      if (face[idx]) landmarks[idx] = [face[idx].x, face[idx].y, face[idx].z];
    });
  }

  if (poseResults?.poseLandmarks) {
    poseResults.poseLandmarks.slice(0, 10).forEach((lm, i) => {
      landmarks[502 + i] = [lm.x, lm.y, lm.z];
    });
  }

  if (leftHandResults?.multiHandLandmarks?.length) {
    leftHandResults.multiHandLandmarks.forEach((hand) => {
      hand.forEach((lm, i) => (landmarks[468 + i] = [lm.x, lm.y, lm.z]));
    });
  }

  if (rightHandResults?.multiHandLandmarks?.length) {
    rightHandResults.multiHandLandmarks.forEach((hand) => {
      hand.forEach((lm, i) => (landmarks[522 + i] = [lm.x, lm.y, lm.z]));
    });
  }

  return landmarks;
};

// for loading mediapipe scripts (web only)
const loadMediapipeScripts = () => {
  return Promise.all([
    new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    }),
    new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    }),
  ]);
};

// storing conversation locally
type ChatMsg = {
  id: string;
  sender: "deaf" | "hearing";
  text: string;
  ts: number;
};

const CHAT_KEY = "conversation_messages_v1";

const appendChatMessage = async (msg: ChatMsg) => {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    const prev: ChatMsg[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify([...prev, msg]));
  } catch (e) {
    console.log("appendChatMessage error", e);
  }
};

// Main component -- live camera feed
export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const params = useLocalSearchParams<{ mode?: string }>();
  const isConversationMode = params?.mode === "conversation";

  const [isFrozen, setIsFrozen] = useState(false);
  const isFrozenRef = useRef(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const PANEL_H = 330;

  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("—");
  const [generatedSentence, setGeneratedSentence] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  const [hasGeneratedSentence, setHasGeneratedSentence] = useState(false);
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const lastDetectedWordRef = useRef<string | null>(null);

  const [isAutomated, setIsAutomated] = useState(false);

  const isRunningRef = useRef(true);
  const lastFrameLandmarksRef = useRef<number[][] | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const holisticRef = useRef<any>(null);
  const cameraUtilsRef = useRef<any>(null);
  const hasInitializedHolisticRef = useRef(false);
  const hasGeneratedSentenceRef = useRef(false);
  const ignoreUntilSignChangeRef = useRef(false);
  const lastSentWordRef = useRef<string | null>(null);
  const lockedWordRef = useRef<string | null>(null);
  const hasAutoSentRef = useRef(false);
  const [autoConversation, setAutoConversation] = useState(false);


  const isFocusedRef = useRef(true);

  useEffect(() => {
    isFrozenRef.current = isFrozen;
  }, [isFrozen]);

  useEffect(() => {
    if (isConversationMode) {
      setAutoConversation(true);
    } else {
      setAutoConversation(false);
    }
  }, [isConversationMode]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      isRunningRef.current = true;

      setIsFrozen(false);
      setLastPhotoUri(null);

      setIsGenerating(false);
      isGeneratingRef.current = false;

      setLiveText("—");
      setDetectedWords([]);
      setHasGeneratedSentence(false);
      setGeneratedSentence(null);
      setConfidence(0);

      lastDetectedWordRef.current = null;
      lockedWordRef.current = null;
      hasGeneratedSentenceRef.current = false;
      hasAutoSentRef.current = false;

      return () => {
        isFocusedRef.current = false;
        isRunningRef.current = false;
      };
    }, [])
  );

  // Connecting WebSocket server
  useEffect(() => {
    wsRef.current = new WebSocket("ws://192.168.1.175:8000/ws");

    wsRef.current.onopen = () => console.log("WebSocket connected");
    wsRef.current.onclose = () => console.log("WebSocket disconnected");

    wsRef.current.onmessage = (event) => {
      if (!isFocusedRef.current) return;

      const data: WSData = JSON.parse(event.data);

      if (isGeneratingRef.current) {
        if (data.confidence !== null) setConfidence(data.confidence);

        if (typeof data.generated_sentence === "string") {
          const sentence = data.generated_sentence.trim();
          if (sentence.length > 0) {
            setGeneratedSentence(sentence);

            setIsGenerating(false);
            isGeneratingRef.current = false;
            isRunningRef.current = true;
          }
        }
        return;
      }

      if (data.current_sign) {
        const word = data.current_sign.trim();

        if (lockedWordRef.current) {
          if (word === lockedWordRef.current) {
            setLiveText("—");
            return;
          } else {
            lockedWordRef.current = null;
          }
        }

        if (!hasGeneratedSentenceRef.current && word) {
          if (word !== lastDetectedWordRef.current) {
            setDetectedWords((prev) => [...prev, word]);
            lastDetectedWordRef.current = word;
          }
        }

        if (isRunningRef.current && !isFrozenRef.current && !isGeneratingRef.current) {
          setLiveText(word);
        } else {
          setLiveText("—");
        }
      }

      if (data.confidence !== null) setConfidence(data.confidence);
      if (typeof data.generated_sentence === "string") {
        const sentence = data.generated_sentence.trim();
        if (sentence.length > 0) {
          setGeneratedSentence(sentence);
        }
      }
    };

    return () => wsRef.current?.close();
  }, []);

  const sendLandmarks = (landmarks: number[][], generateSentence = false) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const payload = { landmarks, generate_sentence: generateSentence };
    wsRef.current.send(JSON.stringify(payload));
  };


  // Initialize holistic for web
  useEffect(() => {
    if (
      !permission?.granted ||
      Platform.OS !== "web" ||
      hasInitializedHolisticRef.current
    ) return;
    hasInitializedHolisticRef.current = true;

    const initWebHolistic = async () => {
      await loadMediapipeScripts();

      const HolisticConstructor = (window as any).Holistic;
      const CameraConstructor = (window as any).Camera;

      holisticRef.current = new HolisticConstructor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
      });

      holisticRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      holisticRef.current.onResults((results: any) => {

        if (!isRunningRef.current) return;

        const landmarks = extract543Landmarks(
          results.faceLandmarks ? { multiFaceLandmarks: [results.faceLandmarks] } : null,
          results.leftHandLandmarks ? { multiHandLandmarks: [results.leftHandLandmarks] } : null,
          results.rightHandLandmarks ? { multiHandLandmarks: [results.rightHandLandmarks] } : null,
          results.poseLandmarks ? { poseLandmarks: results.poseLandmarks } : null
        );
        lastFrameLandmarksRef.current = landmarks;
        sendLandmarks(landmarks);
      });

      if (videoRef.current) {
        cameraUtilsRef.current = new CameraConstructor(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) await holisticRef.current.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
        cameraUtilsRef.current.start();
      }
    };

    initWebHolistic();
  }, [permission?.granted]);

  // Capture loop for mobile
  useEffect(() => {
    if (!permission?.granted || Platform.OS === "web") return;

    let isCancelled = false;

    const loop = async () => {
      if (isCancelled || !isRunningRef.current) return;

      try {
        const photo = await cameraRef.current?.takePictureAsync({ base64: true });
        if (photo?.base64) {
          wsRef.current?.send(JSON.stringify({ image: photo.base64 }));
          console.log("Mobile frame sent to server");
        }
      } catch (err) {
        console.error("Error capturing frame:", err);
      }

      setTimeout(loop, 100);
    };

    loop();
    return () => { isCancelled = true; };
  }, [permission?.granted]);

  // Toggle button between automated TTS or not
  useEffect(() => {
    const loadAutomatedState = async () => {
      try {
        const savedState = await AsyncStorage.getItem("isAutomated");
        if (savedState !== null) setIsAutomated(JSON.parse(savedState));
      } catch (error) {
        console.error("Error loading automated state from AsyncStorage", error);
      }
    };
    loadAutomatedState();
  }, []);

  useEffect(() => {
    if (
      isAutomated &&
      hasGeneratedSentence &&
      generatedSentence &&
      !hasAutoSentRef.current
    ) {
      hasAutoSentRef.current = true;
      handleSendToOutput();
    }
  }, [isAutomated, hasGeneratedSentence, generatedSentence]);

  // Pause / Resume detection
  const handlePause = async () => {
    if (isFrozen) {
      setIsFrozen(false);
      setLastPhotoUri(null);
      if (!isGeneratingRef.current) isRunningRef.current = true;
      return;
    }

    setIsFrozen(true);
    isRunningRef.current = false;

    if (Platform.OS !== "web" && cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true });
        setLastPhotoUri(photo.uri);
      } catch (err) {
        console.error(err);
        setIsFrozen(false);
        isRunningRef.current = true;
      }
    }
  };

  const handleGenerateSentence = () => {
    if (!lastFrameLandmarksRef.current) return;

    setIsGenerating(true);
    isGeneratingRef.current = true;
    isRunningRef.current = false;

    setHasGeneratedSentence(true);
    hasGeneratedSentenceRef.current = true;

    setDetectedWords([]);
    setLiveText("—");

    sendLandmarks(lastFrameLandmarksRef.current, true);
  };

  const handleSendToOutput = async () => {
    const lastWord = detectedWords[detectedWords.length - 1] || liveText;
    
    if (lastWord && lastWord !== "—") {
      lockedWordRef.current = lastWord;
    }

    const finalText = (generatedSentence || lastWord || "—").trim();
    handleClear();

    if (isConversationMode) {
      await appendChatMessage({
        id: String(Date.now()),
        sender: "deaf",
        text: finalText,
        ts: Date.now(),
      });

      if (generatedSentence) {
        await appendChatMessage({
          id: String(Date.now() + 1),
          sender: "hearing",
          text: generatedSentence,
          ts: Date.now() + 1,
        });
      }
    }
    // Pushing to the TTS output screen
    const url = `/output?text=${encodeURIComponent(finalText)}&autoGoConversation=${isConversationMode}`;

    // Push to output screen
    router.push(url);
  };

  const handleClear = () => {
    hasAutoSentRef.current = false;
    if (liveText && liveText !== "—") {
      lockedWordRef.current = liveText;
    }
    setIsGenerating(false);
    isGeneratingRef.current = false;

    hasGeneratedSentenceRef.current = false;

    setLiveText("—");
    setGeneratedSentence("Waiting for input...");
    setConfidence(0);

    setHasGeneratedSentence(false);
    setDetectedWords([]);
    lastDetectedWordRef.current = null;

    if (!isFrozenRef.current) isRunningRef.current = true;
  };

  // Permissions (camera)
  if (!permission) return (
    <View style={styles.center}>
      <Text style={styles.text}>Checking camera permissions…</Text>
    </View>
  );

  if (!permission.granted) return (
    <View style={styles.center}>
      <Text style={styles.text}>We need your permission to use the camera.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
        <Text style={styles.primaryBtnText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  const statusLabel = isGenerating
    ? "Generating…"
    : isFrozen
    ? "Paused"
    : "Live";

 return (
  <View style={styles.container}>
    {/* camera area (reserves space for bottom panel) */}
    <View style={[styles.cameraStage, { marginBottom: PANEL_H }]}>
      {Platform.OS === "web" ? (
        <video ref={videoRef} autoPlay style={styles.camera as any} />
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      )}

      {/* top header (stays on top of camera) */}
      <SafeAreaView style={styles.topBarSafe}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.overlayTitle}>Live Interpreter</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{isGenerating ? "Generating…" : isFrozen ? "Paused" : "Live"}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.homeButton} onPress={() => router.push("/")}>
            <Ionicons name="home" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* "PAUSED" overlay label */}
      {isFrozen && (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}
    </View>

    {/* bottom panel (fixed height, no overlap) */}
    <View style={[styles.panel, { height: PANEL_H }]}>
      <View style={styles.panelHandle} />

      <View style={styles.rowBetween}>
        <Text style={styles.panelTitle}>Transcript</Text>
        <TouchableOpacity onPress={handleClear}>
          <Text style={styles.link}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.transcriptBox}>
        <Text style={styles.label}>LIVE DETECTION</Text>
        <Text style={styles.liveText}>{liveText || "—"}</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>
          {hasGeneratedSentence ? "GENERATED SENTENCE" : "INDIVIDUAL WORDS"}
        </Text>
        <Text style={styles.stableText}>
          {hasGeneratedSentence
            ? generatedSentence || "Creating sentence..."
            : detectedWords.length
            ? detectedWords.join(" ")
            : "—"}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.smallBtn, isFrozen && styles.smallBtnOff]}
          onPress={handlePause}
          disabled={isGenerating}
        >
          <Text style={styles.smallBtnText}>{isFrozen ? "Resume" : "Pause"}</Text>
        </TouchableOpacity>

        {!isAutomated && (
          <TouchableOpacity
            style={[styles.smallBtn, isGenerating && { opacity: 0.55 }]}
            onPress={handleGenerateSentence}
            disabled={isGenerating}
          >
            <Text style={styles.smallBtnText}>
              {isGenerating ? "Generating..." : "Generate Sentence"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryCta, isGenerating && { opacity: 0.7 }]}
        onPress={isAutomated ? handleGenerateSentence : handleSendToOutput}
        disabled={isGenerating}
        activeOpacity={0.85}
      >
        <View style={styles.ctaSheen} />
        <Text style={styles.primaryCtaText}>
          {isAutomated
            ? isGenerating
              ? "Generating..."
              : "Generate Sentence and Speak ➜"
            : "Send to Speech ➜"}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);
}