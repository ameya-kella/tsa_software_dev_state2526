import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Switch,Platform } from "react-native";
import { Link } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  const handleLogout = async () => {
    await AsyncStorage.removeItem("asl_user_credentials");
    router.replace("/login");
  };
  const CREDS_KEY = "asl_user_credentials";
  
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(CREDS_KEY);
      if (!stored) router.replace("/login");
    })();
  }, []);

  const [isAutomated, setIsAutomated] = useState(false);
  const toggleSwitch = async () => {
    const newState = !isAutomated;
    setIsAutomated(newState);
    await AsyncStorage.setItem("isAutomated", JSON.stringify(newState));
  };

  useEffect(() => {
    const resetInterpreterFlow = async () => {
      try {
        // Clear saved messages
        await AsyncStorage.removeItem("speech_messages_v1");

        // Reset backend demo flow
        if (global.ws && global.ws.readyState === WebSocket.OPEN) {
          global.ws.send(JSON.stringify({
            type: "context",
            flow: "interpreter",
          }));
          console.log("Sent flow reset to backend");
        }
      } catch (err) {
        console.error("Failed to clear messages or reset flow", err);
      }
    };

    resetInterpreterFlow();
  }, []);


  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem("isAutomated");
        if (savedState !== null) setIsAutomated(JSON.parse(savedState));
      } catch (error) {
        console.error("Error loading state from AsyncStorage", error);
      }
    };
    loadState();
  }, []);

  return (
    <View style={styles.root}>
      {/* Setting background style */}
     <LinearGradient
    colors={["#020617", "#030a1e", "#020617"]}

        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

<LinearGradient
  colors={[
    "rgba(2,6,23,0.95)",
    "rgba(2,6,23,0.75)",
    "rgba(59,130,246,0.15)",
    "rgba(59,130,246,0.00)",
  ]}
  start={{ x: 0.0, y: 1.0 }}
  end={{ x: 0.6, y: 0.4 }}
  style={StyleSheet.absoluteFillObject}
/>

<LinearGradient
  colors={[
    "rgba(59,130,246,0.22)",
    "rgba(59,130,246,0.08)",
    "rgba(59,130,246,0.00)",
  ]}
  start={{ x: 1.0, y: 0.0 }}
  end={{ x: 0.55, y: 0.45 }}
  style={StyleSheet.absoluteFillObject}
/>
      <View style={styles.panel}>
        <View style={styles.header}>
          

          <Text style={styles.title}>Signify</Text>
          <Text style={styles.subtitle}>
            Real-time accessibility for deaf and ASL speakers in everyday life.
          </Text>
        </View>

        <View style={styles.cardGrid}>
          <Link href="/camera" asChild>
            <TouchableOpacity activeOpacity={0.88} style={styles.card}>
              <View style={styles.cardTop}>
               <View style={styles.iconBubblePurple}>
          <MaterialCommunityIcons name="hand-wave" size={22} color="#E9D5FF" />
        </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Live Interpreter</Text>
                  <Text style={styles.cardDesc}>ASL → Text → Speech</Text>
                </View>
              </View>

  
              <View style={styles.cardHintRow}>
                <Text style={styles.cardHint}>Live ASL translated into spoken sentences in real time.</Text>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.cardGrid}>
          <Link href="/camera?mode=conversation" asChild>
            <TouchableOpacity activeOpacity={0.88} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBubblePurple}>
                  <MaterialCommunityIcons name="microphone-message" size={22} color="#E9D5FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Live Conversation</Text>
                  <Text style={styles.cardDesc}>Interpreter + Speech-to-Text</Text>
                </View>
              </View>

              <View style={styles.cardHintRow}>
                <Text style={styles.cardHint}>For seamless communication between deaf and non-ASL speakers.</Text>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View>
              <Text style={styles.footerText}>Automate Send to Speech?</Text>
              <Text style={styles.footerSub}>
                When enabled, confirmed text auto-speaks.
              </Text>
              <TouchableOpacity onPress={handleLogout} style={{ marginTop: 8}}>
                <Text style={[styles.footerText, { color: "rgba(255,100,100,0.7)" }]}>
                  Log Out
                </Text>
        </TouchableOpacity>
            </View>
<View style={{ transform: [{ scale: 0.85 }], marginLeft: -6 }}>
<View style={{ transform: [{ scale: 0.85 }], marginLeft: -6 }}>
  <Switch
    value={isAutomated}
    onValueChange={toggleSwitch}
    ios_backgroundColor="rgba(255, 255, 255, 1)"
    trackColor={{
      false: "rgba(255,255,255,0.15)", true: "rgba(59,130,246,0.45)"
    }}
    thumbColor="#FFFFFF"
  />
</View>

</View>

          </View>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050b18",
    padding: 14,
    justifyContent: "center",
  },

panel: {
  borderRadius: 34,
  paddingVertical: 22,
  paddingHorizontal: 18,
  borderWidth: 0,
  backgroundColor: "transparent",
},

  header: {
  paddingHorizontal: 6,
  paddingTop: 2,
  paddingBottom: 6,
},

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    backgroundColor: "rgba(124,58,237,0.10)",
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(34,197,94,0.95)",
  },
  badgeText: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
  },

  brandChip: {
    width: 38,
    height: 38,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandChipText: { fontSize: 16 },

  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  subtitle: {
    color: "rgba(255,255,255,0.62)",

    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    fontWeight: "700",
  },

  cardGrid: {
    marginTop: 14,
    gap: 14,
    paddingHorizontal: 4,
  },

  card: {
  borderRadius: 26,
  padding: 18,

  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "rgba(124,58,237,0.20)",

  shadowColor: "#7C3AED",
  shadowOpacity: 0.14,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 14 },
},


  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
iconBubblePurple: {
  width: 48,
  height: 48,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",

  backgroundColor: "rgba(124,58,237,0.22)",
  borderWidth: 1,
  borderColor: "rgba(124,58,237,0.40)",

  // helps it look “embedded” and not flat
  shadowColor: "#7C3AED",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },

  // for android
  elevation: 6,
},

  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconChipPurple: {
    borderColor: "rgba(124,58,237,0.35)",
    backgroundColor: "rgba(124,58,237,0.14)",
  },
  iconChipText: { fontSize: 18 },

  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  cardDesc: {
    color: "rgba(255,255,255,0.82)",
    marginTop: 4,
    fontSize: 14,
    fontWeight: "800",
  },

  cardFoot: {
    color: "rgba(255,255,255,0.58)",
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  cardHintRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHint: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "800",
    fontSize: 12,
  },
  cardArrow: {
    color: "rgba(124,58,237,0.9)",
    fontWeight: "900",
    fontSize: 18,
    marginTop: -2,
  },

  footer: {
    marginTop: 18,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },

  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,

    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,

    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  footerText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "900",
  },
  footerSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "700",
  },
});
