import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

const CREDS_KEY = "asl_user_credentials";

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter a username and password.");
      return;
    }

    const hashed = CryptoJS.SHA256(password).toString();
    const stored = await AsyncStorage.getItem(CREDS_KEY);

    if (isSignUp) {
      if (stored) {
        Alert.alert("Error", "An account already exists on this device.");
        return;
      }
      await AsyncStorage.setItem(
        CREDS_KEY,
        JSON.stringify({ username: username.trim(), password: hashed })
      );
      Alert.alert("Success", "Account created!", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } else {
      if (!stored) {
        Alert.alert("No account found", "Please sign up first.");
        return;
      }
      const creds = JSON.parse(stored);
      if (creds.username === username.trim() && creds.password === hashed) {
        router.replace("/");
      } else {
        Alert.alert("Error", "Incorrect username or password.");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? "Create your account" : "Sign in to continue"}
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter username"
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
          <Text style={styles.primaryBtnText}>
            {isSignUp ? "Create Account" : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => setIsSignUp((v) => !v)}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? "Already have an account? Sign In" : "No account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#0b1220",
    justifyContent: "center", padding: 24,
  },
  title: { color: "white", fontSize: 32, fontWeight: "900", textAlign: "center" },
  subtitle: {
    color: "rgba(255,255,255,0.6)", textAlign: "center",
    marginTop: 6, marginBottom: 32, fontSize: 14,
  },
  form: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  label: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 13 },
  input: {
    marginTop: 6, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, padding: 12, color: "white",
    fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  primaryBtn: {
    marginTop: 22, backgroundColor: "#22c55e",
    borderRadius: 14, paddingVertical: 13, alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900", fontSize: 15 },
  toggleBtn: { marginTop: 14, alignItems: "center" },
  toggleText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13 },
});