import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

const CHAT_KEY = "unified_conversation_v1";

type ChatMsg = {
  id: string;
  sender: "deaf" | "hearing";
  text: string;
  ts: number;
};

type Session = {
  id: string;
  title: string;
  created_at: number;
};

//history of conversations
export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const load = async () => {
    const creds = await AsyncStorage.getItem("asl_user_credentials");
    if (!creds) return;

    const { username } = JSON.parse(creds);

    const res = await fetch(`http://localhost:8000/sessions/${username}`);
    const data = await res.json();

    setSessions(data);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/")}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>History</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No conversations saved yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/speech",
                  params: { sessionId: item.id },
                })
              }
            >
              <View style={styles.bubble}>
                <Text style={{ color: "white" }}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050b18" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  title: { color: "white", fontSize: 18, fontWeight: "900" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 15 },
  list: { padding: 16, gap: 10 },
  bubble: {
    padding: 12, borderRadius: 16,
    borderWidth: 1, maxWidth: "85%",
  },
  bubbleDeaf: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(59,130,246,0.14)",
    borderColor: "rgba(59,130,246,0.28)",
  },
  bubbleHearing: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  bubbleSender: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  bubbleText: { color: "white", fontSize: 15, fontWeight: "700" },
  bubbleTime: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 6, textAlign: "right" },
});