import { View, Platform, StyleSheet } from "react-native";
import { Stack, Slot } from "expo-router";

export default function Layout() {
  return (
    <View style={styles.wrapper}>
      {Platform.OS === "web" ? (
        <View style={styles.phoneFrame}>
          <Slot />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#0b1220" },
  phoneFrame: {
    width: 440,
    height: 952,
    marginLeft: "auto",
    marginRight: "auto",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 40,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
});
