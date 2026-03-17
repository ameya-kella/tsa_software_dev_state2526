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

export default function HistoryScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const load = async () => {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    const msgs = raw ? JSON.parse(raw) : [];
    msgs.sort((a: ChatMsg, b: ChatMsg) => a.ts - b.ts);
    setMessages(msgs);
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

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No conversations saved yet.</Text>
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[
              styles.bubble,
              item.sender === "deaf" ? styles.bubbleDeaf : styles.bubbleHearing,
            ]}>
              <Text style={styles.bubbleSender}>
                {item.sender === "deaf" ? "ASL" : "Hearing"}
              </Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
              <Text style={styles.bubbleTime}>
                {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
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