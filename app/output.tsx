import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";

export default function OutputScreen() {
  const params = useLocalSearchParams<{ 
    text?: string; 
    autoGoConversation?: string; 
  }>();

  console.log('Params:', params);

  const router = useRouter();

  const text = useMemo(() => (params?.text ? String(params.text) : "Waiting for input..."), [params]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // check for valid text
  const hasRealText = text && text !== "—" && text !== "Waiting for input...";

  // determine if autoGoConversation should trigger after speech
  const autoGoConversation = params?.autoGoConversation === "true";

  const speak = () => {
    if (isSpeaking) return; // prevent multiple TTS triggers simultaneously

    Speech.stop();
    setIsSpeaking(true);

    console.log("Starting speech...");

    Speech.speak(text, {
      rate: 0.95,
      onDone: () => {
        console.log("Speech done");
        setIsSpeaking(false);
        if (autoGoConversation) {
          console.log("Redirecting to /speech");
          router.push("/speech");
        }
      },
      onStopped: () => {
        console.log("Speech stopped manually");
        setIsSpeaking(false);
      },
      onError: (error) => {
        console.log("Speech error", error);
        setIsSpeaking(false);
      },
    });
  };


  const stop = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  useEffect(() => {
    if (hasRealText) speak();
  }, [hasRealText]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.bgGlowPurple} />
      <View pointerEvents="none" style={styles.bgGlowGreen} />

      <View style={styles.shell}>
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Translation</Text>
            <Text style={styles.subtitle}>Text → Speech output</Text>
          </View>

          <TouchableOpacity style={styles.homeBtn} onPress={() => router.push("/")}>
            <Ionicons name="home" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.outputBox}>
          <Text style={styles.outputText}>{text}</Text>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.actionBtn, !hasRealText && { opacity: 0.5 }]}
            onPress={speak}
            disabled={!hasRealText}
          >
            <Ionicons name="volume-high" size={18} color="white" />
            <Text style={styles.actionText}>{isSpeaking ? "Speaking…" : "Speak"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={stop}>
            <Ionicons name="stop" size={18} color="white" />
            <Text style={styles.actionText}>Stop</Text>
          </TouchableOpacity>
        </View>

        <Link href="/camera" asChild>
          <TouchableOpacity style={styles.primary}>
            <Text style={styles.primaryText}>Back to Interpreter</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

// styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b18",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    overflow: "hidden", // important so glows don’t show as hard edges
  },

  bgGlowPurple: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 560,
    backgroundColor: "rgba(124,58,237,0.18)",
    top: -330,
    right: -340,
    ...(Platform.OS === "web" ? ({ filter: "blur(90px)" } as any) : {}),
    opacity: 0.9,
  },
  bgGlowGreen: {
    position: "absolute",
    width: 620,
    height: 620,
    borderRadius: 620,
    backgroundColor: "rgba(59,130,246,0.18)",
    bottom: -380,
    left: -380,
    ...(Platform.OS === "web" ? ({ filter: "blur(95px)" } as any) : {}),
    opacity: 0.85,
  },

  shell: {
    width: "100%",
  },

  headerCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  title: { color: "white", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 14 },

  homeBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  outputBox: {
    marginTop: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    minHeight: 170,
    justifyContent: "center",
  },
  outputText: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 30,
  },

  row: { flexDirection: "row", gap: 12, marginTop: 14 },

  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  actionBtnGhost: {
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  actionText: { color: "white", fontWeight: "800" },

  primary: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(124,58,237,0.22)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
  },
  primaryText: { color: "white", fontWeight: "900", fontSize: 16 },

  linkBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  linkText: { color: "rgba(255,255,255,0.55)", fontWeight: "800" },
});
