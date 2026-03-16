import React, { useEffect } from "react";
import { StyleSheet, SafeAreaView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { VideoView, useVideoPlayer } from "expo-video";

export default function VideoPlayer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const url = params.url;

  const player = useVideoPlayer(url ?? "", (player) => {
    player.play(); // autoplay when opened
  });

  useEffect(() => {
    if (!player) return;

    const sub = player.addListener("playToEnd", () => {
      router.replace("/speech"); // return back to chat screen automatically
    });

    return () => sub.remove();
  }, [player]);

  if (!url) return <SafeAreaView style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === "web" ? (
        <video
          src={url}
          style={styles.video}
          autoPlay
          controls
          onEnded={() => router.replace("/speech")}
        />
      ) : (
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "90%",
    height: 420,
  },
});
