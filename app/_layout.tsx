import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { ActivityIndicator, View } from "react-native";
import React, { useEffect } from "react";
import Toast from "react-native-toast-message";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Animated, { FadeOut, useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, Easing, runOnJS } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StyleSheet, Text } from "react-native";

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 800 });

    textOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    textTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.exp) }, () => {
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
      })
    );

    const timer = setTimeout(() => {
      onComplete();
    }, 5000); // Wait exactly 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View exiting={FadeOut.duration(500)} style={styles.splashContainer}>
      <Animated.View style={[styles.iconContainer, logoStyle]}>
        <Ionicons name="rocket" size={80} color="#fff" />
      </Animated.View>
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.title}>C-RAISE</Text>
        <Text style={styles.subtitle}>Ticketing App</Text>
      </Animated.View>
    </Animated.View>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [showSplash, setShowSplash] = React.useState(true);

  useEffect(() => {
    // Only route if splash is done and Auth is loaded
    if (loading || showSplash) return;

    // Check if user is currently in auth-related screens
    const inAuthGroup = segments[0] === "login" || segments[0] === "signup";
    console.log("Auth State Check:", { user: !!user, segments, inAuthGroup });

    if (!user && !inAuthGroup) {
      console.log("Redirecting to /login...");
      router.replace("/login");
    } else if (user) {
      if (inAuthGroup) {
        console.log("Redirecting to dashboard...");
        router.replace(user.role === "admin" ? "/admin" : "/(tabs)");
      } else if (user.role === "admin" && segments[0] === "(tabs)") {
        console.log("Redirecting Admin to /admin...");
        router.replace("/admin");
      } else if (user.role !== "admin" && segments[0] === "admin") {
        console.log("Redirecting Employee to /(tabs)...");
        router.replace("/(tabs)");
      }
    }
  }, [user, loading, segments, showSplash]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {!loading && (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ animation: "fade" }} />
            <Stack.Screen name="signup" options={{ animation: "fade" }} />
            <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
            <Stack.Screen name="admin" options={{ animation: "fade" }} />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          </Stack>
        )}
        
        <Toast />
        <StatusBar style="light" />

        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a", // Premium Dark Theme
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  iconContainer: {
    width: 140,
    height: 140,
    backgroundColor: "#6366f1",
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 32,
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#94a3b8",
    letterSpacing: 4,
    fontWeight: "500",
    textTransform: "uppercase",
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
