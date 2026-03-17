import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  SafeAreaView,
  Animated,
  Image,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter , useLocalSearchParams} from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import { useFocusEffect } from '@react-navigation/native';


const USE_MOCK_TRANSCRIBE = false;
const STORAGE_KEY = "unified_conversation_v1";

const WS_URL = "ws://localhost:8000/ws";
export const API_BASE = "http://localhost:8000";

const TRANSCRIBE_URL = `${API_BASE}/transcribe`;
const ASL_STYLE_URL = `${API_BASE}/convert_to_asl_style`;
const ASL_VIDEO_URL = `${API_BASE}/generate_asl_video`;


type ChatMsg = {
  id: string;
  sender: "deaf" | "hearing";
  text: string;
  ts: number;
  aslText?: string;
  aslVideo?: string;
  aslThumbnail?: string;
};

export default function SpeechScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const wsRef = useRef<WebSocket | null>(null);

  const [showAslUnderHearing, setShowAslUnderHearing] = useState(false);
  const recordStartedAt = useRef<number>(0);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typedText, setTypedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>("Ready to record");

  const listRef = useRef<FlatList<ChatMsg>>(null);
  const inputRef = useRef<TextInput>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const params = useLocalSearchParams<{ deafText?: string }>();
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const messageQueue = useRef<ChatMsg[]>([]);

  // WebSocket
  const connectWS = () => {
    if (!isWeb) return;
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("WS connected");

      if (messageQueue.current.length > 0) {
        console.log("Flushing queued messages:", messageQueue.current);

        // concept of "queueing" so that messages are not lost even if server is not connected yet
        setMessages((prev) => [...prev, ...messageQueue.current]);
        messageQueue.current.forEach((msg) => console.log("Message displayed on screen from queue:", msg));

        messageQueue.current = [];
      }

      AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
        if (saved) setMessages(JSON.parse(saved));
      });
    };

    ws.onclose = () => {
      console.log("WS closed — reconnecting...");
      setTimeout(connectWS, 2000);
    };
    ws.onerror = (e) => console.error("WS error", e);

    ws.onmessage = (event) => {
      try {
        const msg: ChatMsg = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
      } catch {}
    };

    wsRef.current = ws;
  };

  useEffect(() => {
      connectWS();
      return () => wsRef.current?.close();
    }, []);
    
  useEffect(() => {
    if (!params.deafText) return;

    setMessages((prev) => {
      const exists = prev.find((m) => m.sender === "deaf" && m.text === params.deafText);
      if (exists) return prev;
      const id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
      const newMsg: ChatMsg = { id, sender: "deaf", text: params.deafText!, ts: Date.now() };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(newMsg));
      } else {
        messageQueue.current.push(newMsg);
        console.log("WS not ready, queued deaf message");
        console.log("Current queue:", messageQueue.current);

      }

      return [...prev, newMsg];
    });
  }, [params.deafText]);

  // scroll to bottom
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  }, [messages]);

  // converting to ASL-style english
  const sendToAslStyleEnglish = async (text: string) => {
    if (USE_MOCK_TRANSCRIBE) return text;
    const res = await fetch(ASL_STYLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
  });
    const data = await res.json();
    return data?.asl_style || text;
  };

  // adding message to chat screen
  const addMessage = async (sender: ChatMsg["sender"], text: string) => {
    const id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    const newMsg: ChatMsg = { id, sender, text, ts: Date.now() };

    setMessages((prev) => [...prev, newMsg]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(newMsg));
    } else {
      messageQueue.current.push(newMsg);
      console.log("WS not ready, queued message");
    }

    if (sender === "hearing") {
      try {
        const aslText = await sendToAslStyleEnglish(text);

        const res = await fetch(ASL_VIDEO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gloss: aslText }),
        });

        const videoData = await res.json();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  aslText,
                  aslVideo: API_BASE + videoData.video_url,
                  aslThumbnail: API_BASE + videoData.thumbnail_url,
                }
              : m
          )
        );
      } catch (err) {
        console.error("ASL error", err);
      }
    }
  };

  useEffect(() => {
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60
    );
    return () => clearTimeout(t);
  }, [messages.length]);

  const sendTyped = async () => {
    if (!typedText.trim()) return;
    addMessage("hearing", typedText);
    setTypedText("");
  };

  // transcribing if user chooses speech-to-text
  const transcribeAudio = async (input: string | Blob) => {
    if (USE_MOCK_TRANSCRIBE) {
      await new Promise((r) => setTimeout(r, 500));
      return "Mock transcript";
    }

    const form = new FormData();
    if (Platform.OS === "web") {
      form.append("file", input as Blob, "speech.webm");
    } else {
      form.append("file", {
        uri: input as string,
        name: "speech.m4a",
        type: "audio/m4a",
      } as any);
    }

    const res = await fetch(TRANSCRIBE_URL, { method: "POST", body: form });
    const data = await res.json();
    return data?.text || "";
  };

  const startRecording = async () => {
    try {
      setStatus("Recording...");
      setListening(true);

      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });

        webChunksRef.current = [];
        webRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };

        recorder.start();
      }
    } catch (e: any) {
      Alert.alert("Recording error", e.message);
    }
  };

  const stopRecording = async () => {
    try {
      setLoading(true);
      setListening(false);

      const recorder = webRecorderRef.current;
      recorder?.stop();

      recorder!.onstop = async () => {
        const blob = new Blob(webChunksRef.current, {
          type: "audio/webm",
        });
        const text = (await transcribeAudio(blob)).trim();
        if (text) addMessage("hearing", text);

        setLoading(false);
        setStatus("Ready to record");
      };
    } catch (e: any) {
      Alert.alert("Recording error", e.message);
    }
  };

  const prettyStatus = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "warn" as const };
    if (!isWeb) return { label: "Web only", tone: "bad" as const };
    return { label: status, tone: "good" as const };
  }, [loading, isWeb, status]);

  const statusPillStyle =
    prettyStatus.tone === "good"
      ? styles.pillGood
      : prettyStatus.tone === "bad"
      ? styles.pillBad
      : styles.pillWarn;

  const placeholder = useMemo(() => {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="rgba(255,255,255,0.75)" />
        </View>
        <Text style={styles.emptyTitle}>Start a conversation</Text>
        <Text style={styles.emptySub}>Tap the mic to record, or type a message below.</Text>
      </View>
    );
  }, []);

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const isLeft = item.sender === "deaf";
    const showAsl = showAslUnderHearing && item.sender === "hearing";
    return (
      <View style={[styles.row, isLeft ? styles.rowLeft : styles.rowRight]}>
        <View style={{ gap: 8, alignItems: isLeft ? "flex-start" : "flex-end" }}>
          <View style={[styles.bubble, isLeft ? styles.bubbleLeft : styles.bubbleRight]}>
            <Text style={[styles.bubbleText, isLeft ? styles.textLeft : styles.textRight]}>
              {item.text}
            </Text>
            <Text style={styles.time}>
              {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          {showAsl && item.aslText && (
          <View style={[styles.bubble, styles.bubbleASL]}>
            <View style={styles.aslHeaderRow}>
              <Ionicons name="swap-horizontal" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.aslHeaderText}>ASL-style English</Text>
            </View>

            <Text style={styles.aslText}>{item.aslText}</Text>

            {item.aslVideo && (
              <TouchableOpacity
                onPress={() => {
                  setPlayingVideoId(item.id);
                  router.push({ pathname: "/videoPlayer", params: { url: item.aslVideo } });
                }}
              >
                <View style={styles.videoPreview}>
                  <Ionicons name="play-circle" size={48} color="white" style={styles.playIcon} />
                </View>
              </TouchableOpacity>
            )}


          </View>
        )}
        </View>
      </View>
    );
  };

  if (!isWeb) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.center, { padding: 22 }]}>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
            Whisper STT works on Web only
          </Text>
          <TouchableOpacity style={styles.homeCta} onPress={() => router.push("/camera?mode=conversation")}>
            <Ionicons name="arrow-forward" size={18} color="white" />
            <Text style={styles.homeCtaText}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={["#070B18", "#0A1230", "#080A12"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <View style={styles.headerWrap}>
          <BlurView intensity={22} tint="dark" style={styles.headerGlass}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Live Conversation</Text>
              <View style={[styles.pill, statusPillStyle]}>
                <View
                  style={[
                    styles.dot,
                    prettyStatus.tone === "good"
                      ? styles.dotGood
                      : prettyStatus.tone === "bad"
                      ? styles.dotBad
                      : styles.dotWarn,
                  ]}
                />
                <Text style={styles.pillText}>{prettyStatus.label}</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.toggleWrap}>
                <Text style={styles.toggleLabel}>ASL Assist</Text>
                <Switch
                  value={showAslUnderHearing}
                  onValueChange={setShowAslUnderHearing}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "rgba(72,255,115,0.85)" }}
                  thumbColor="white"
                />
              </View>

              <TouchableOpacity onPress={() => router.push("/camera?mode=conversation")} style={styles.iconBtn}>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        <View style={styles.listWrap}>
          {messages.length ? (
            <FlatList
              ref={listRef}
              data={[...messages].sort((a, b) => a.ts - b.ts)}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            placeholder
          )}
        </View>

        <View style={styles.inputBar}>
          <View style={styles.micWrap}>
            <TouchableOpacity
              style={[styles.micBtn, loading && { opacity: 0.55 }]}
              disabled={loading}
              onPress={listening ? stopRecording : startRecording}
              activeOpacity={0.85}
            >
              <Ionicons name="mic" size={18} color="white" />
              {listening && (
                <Animated.View
                  style={[
                    styles.micRing,
                    { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                  ]}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={typedText}
              onChangeText={setTypedText}
              placeholder="Type a message…"
              placeholderTextColor="rgba(255,255,255,0.45)"
              returnKeyType="send"
              onSubmitEditing={sendTyped}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, !typedText && { opacity: 0.55 }]}
            onPress={sendTyped}
            disabled={!typedText}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050b18" },
  container: { flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  toggleLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.3,
  },

  bubbleASL: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(59,130,246,0.35)",
  },

  aslHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  aslHeaderText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    fontSize: 12,
  },
  aslText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },

  // header
  headerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerGlass: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(10,14,24,0.55)",
  },
  headerLeft: { gap: 6 },
  headerTitle: { color: "white", fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },

  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { color: "rgba(255,255,255,0.88)", fontWeight: "900", fontSize: 12 },
  pillGood: { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.25)" },
  pillWarn: { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.25)" },
  pillBad: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.25)" },

  dot: { width: 8, height: 8, borderRadius: 99 },
  dotGood: { backgroundColor: "rgba(34,197,94,0.95)" },
  dotWarn: { backgroundColor: "rgba(245,158,11,0.95)" },
  dotBad: { backgroundColor: "rgba(239,68,68,0.95)" },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.20)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
  },

  // list
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingBottom: 12 },

  row: { flexDirection: "row", marginVertical: 7 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  bubbleLeft: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.12)",
    borderTopLeftRadius: 9,
  },
  bubbleRight: {
    backgroundColor: "rgba(34,197,94,0.16)",
    borderColor: "rgba(34,197,94,0.28)",
    borderTopRightRadius: 9,
  },
  bubbleText: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  textLeft: { color: "rgba(255,255,255,0.92)" },
  textRight: { color: "white" },
  time: { marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: "800" },

  // empty state
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900", marginTop: 12 },
  emptySub: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 260,
  },

  // input bar
  inputBar: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(10,14,24,0.55)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  micWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  micRing: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(239,68,68,0.35)",
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderColor: "rgba(239,68,68,0.30)",
  },

  inputWrap: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { color: "white", fontSize: 15, fontWeight: "800", paddingVertical: 0 },

  miniHint: {
    marginTop: 6,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "800",
    fontSize: 11,
  },

  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(124,58,237,0.30)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },

  homeCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  videoBtn: {
    marginTop: 10,
    alignSelf: "center",
    padding: 6,
  },
  videoPreview: {
    marginTop: 10,
    width: 200,
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  thumbnail: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },

  playIcon: {
    opacity: 0.9,
  },

  homeCtaText: { color: "white", fontWeight: "900" }
});