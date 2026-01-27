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
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";

const USE_MOCK_TRANSCRIBE = false; // only true if backend unavailable

const TRANSCRIBE_URL = "http://192.168.1.175:8000/transcribe";
const ASL_STYLE_URL = "http://192.168.1.175:8000/convert_to_asl_style";

type ChatMsg = {
  id: string;
  sender: "deaf" | "hearing";
  text: string;
  ts: number;
  aslText?: string; // store fetched ASL-style
};

export default function SpeechScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === "web";

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

  // --- ASL-style POST ---
  const sendToAslStyleEnglish = async (text: string) => {
    if (USE_MOCK_TRANSCRIBE) return text;
    const res = await fetch(ASL_STYLE_URL + "?text=" + encodeURIComponent(text), { method: "POST" });
    const data = await res.json();
    return data?.asl_style || text;
  };

  const toAslStyleEnglish = (text: string) => sendToAslStyleEnglish(text);

  // when adding a hearing message:
  const addMessage = async (sender: ChatMsg["sender"], text: string) => {
    const id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
    const newMsg: ChatMsg = { id, sender, text, ts: Date.now() };

    // Add message immediately
    setMessages(prev => [...prev, newMsg]);

    // If it's a hearing message, fetch ASL-style text right away
    if (sender === "hearing") {
      try {
        const aslText = await sendToAslStyleEnglish(text);
        setMessages(prev =>
          prev.map(m => (m.id === id ? { ...m, aslText } : m))
        );
      } catch (err) {
        console.error("ASL style fetch error", err);
      }
    }
  };

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length]);

  const sendTyped = async () => {
    if (!typedText.trim()) return;
    // Add hearing message (addMessage now handles ASL-style)
    addMessage("hearing", typedText);
    setTypedText("");
  };


  const ensureMicPermission = async () => {
    if (Platform.OS !== "web") {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone needed", "Please enable microphone access to record speech.");
        throw new Error("Mic permission not granted");
      }
    }
  };

  // --- POST transcription ---
  const transcribeAudio = async (input: string | Blob) => {
    if (USE_MOCK_TRANSCRIBE) {
      await new Promise((r) => setTimeout(r, 500));
      return "Mock transcript (no backend)";
    }

    const form = new FormData();
    if (Platform.OS === "web") {
      form.append("file", input as Blob, "speech.webm");
    } else {
      form.append("file", {
        uri: input as string,
        name: "speech.m4a",
        type: Platform.OS === "ios" ? "audio/m4a" : "audio/mp4",
      } as any);
    }

    const res = await fetch(TRANSCRIBE_URL, { method: "POST", body: form });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Transcribe failed (${res.status}): ${txt || "No details"}`);
    }
    const data = await res.json();
    return data?.text || "";
  };

  // --- Recording handlers ---
  const startRecording = async () => {
    try {
      if (loading) return;
      setLoading(false);
      setStatus("Recording...");
      setListening(true);
      recordStartedAt.current = Date.now();

      await ensureMicPermission();

      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        webChunksRef.current = [];
        webRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };
        recorder.start();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      const rec = new Audio.Recording();
      recordingRef.current = rec;
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
    } catch (e: any) {
      setListening(false);
      setStatus("Ready to record");
      Alert.alert("Recording error", String(e?.message || e));
    }
  };

  const stopRecording = async () => {
    try {
      if (loading) return;
      setStatus("Processing audio...");
      setLoading(true);
      setListening(false);

      if (Platform.OS === "web") {
        const recorder = webRecorderRef.current;
        if (!recorder) {
          setLoading(false);
          setStatus("Ready to record");
          return;
        }
        recorder.stop();
        recorder.onstop = async () => {
          try {
            const blob = new Blob(webChunksRef.current, { type: "audio/webm" });
            const text = (await transcribeAudio(blob)).trim();
            if (text) {
              addMessage("hearing", text); // ASL fetch handled inside addMessage
            }
            setLoading(false);
            setStatus("Ready to record");
          } catch (err: any) {
            setLoading(false);
            setStatus("Ready to record");
            Alert.alert("Transcription error", String(err?.message || err));
          }
        };
        return;
      }

      const rec = recordingRef.current;
      if (!rec) {
        setLoading(false);
        setStatus("Ready to record");
        return;
      }
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      if (!uri) {
        setLoading(false);
        setStatus("Ready to record");
        Alert.alert("Recording error", "No audio file URI was created.");
        return;
      }

      const text = (await transcribeAudio(uri)).trim();
      if (text) {
        addMessage("hearing", text);
        const aslText = await sendToAslStyleEnglish(text);
        addMessage("deaf", aslText);
      }

      setLoading(false);
      setStatus("Ready to record");
    } catch (e: any) {
      setLoading(false);
      setStatus("Ready to record");
      Alert.alert("Recording error", String(e?.message || e));
    }
  };

  // --- status UI ---
  const prettyStatus = useMemo(() => {
    if (loading) return { label: "Loading model…", tone: "warn" as const };
    if (!isWeb) return { label: "Web only", tone: "bad" as const };
    if (status === "Ready to record") return { label: "Ready to record", tone: "good" as const };
    return { label: status, tone: "warn" as const };
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
          <TouchableOpacity style={styles.homeCta} onPress={() => router.push("/")}>
            <Ionicons name="home" size={18} color="white" />
            <Text style={styles.homeCtaText}>Home</Text>
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
                <Text style={styles.toggleLabel}>ASL</Text>
                <Switch
                  value={showAslUnderHearing}
                  onValueChange={setShowAslUnderHearing}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "rgba(72,255,115,0.85)" }}
                  thumbColor="white"
                />
              </View>

              <TouchableOpacity onPress={() => router.push("/")} style={styles.iconBtn}>
                <Ionicons name="home" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        <View style={styles.listWrap}>
          {messages.length ? (
            <FlatList
              ref={listRef}
              data={messages}
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
              onPress={listening ? stopRecording : startRecording} // ✅ REAL functionality now
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
  homeCtaText: { color: "white", fontWeight: "900" },
});