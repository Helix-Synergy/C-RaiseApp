import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isDarkMode, toggleTheme } = useAuth();
  const router = useRouter();

  // Dynamic Theme Colors
  const colors = {
    bg: isDarkMode ? "#0f172a" : "#f8fafc",
    card: isDarkMode ? "#1e293b" : "#ffffff",
    text: isDarkMode ? "#f1f5f9" : "#0f172a",
    subtext: isDarkMode ? "#94a3b8" : "#475569",
    border: isDarkMode ? "#334155" : "#e2e8f0",
    accent: "#6366f1",
    inputBg: isDarkMode ? "#0f172a" : "#f1f5f9",
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please enter both email and password",
      });
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      Toast.show({
        type: "success",
        text1: "Login Successful 🎉",
        text2: "Welcome back!",
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Invalid email or password.";
      Toast.show({
        type: "error",
        text1: "Login Failed",
        text2: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={toggleTheme}
        >
          <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={20} color={colors.accent} />
        </TouchableOpacity>

        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={[styles.logoCircle, { backgroundColor: isDarkMode ? "#1e1b4b" : "rgba(99, 102, 241, 0.1)", borderColor: colors.accent }]}>
            <Ionicons name="ticket-outline" size={40} color={colors.accent} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>C-Raise</Text>
          <Text style={[styles.tagline, { color: colors.subtext }]}>Ticketing & Support Platform</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.cardSubtitle, { color: colors.subtext }]}>Log in to your account</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.subtext }]}>Email Address</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="you@company.com"
                placeholderTextColor={colors.subtext + "77"}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.subtext }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your password"
                placeholderTextColor={colors.subtext + "77"}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.subtext }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Text style={[styles.footerNote, { color: colors.subtext }]}>
            Don't have an account yet?{" "}
            <Text style={styles.footerLink} onPress={() => router.push("/signup")}>
              Sign Up
            </Text>
          </Text>
        </View>

        {/* Role Info */}
        <View style={styles.roleInfo}>
          <View style={styles.roleTag}>
            <Ionicons name="person-outline" size={14} color={colors.accent} />
            <Text style={[styles.roleTagText, { color: colors.accent }]}>Employee → Employee Dashboard</Text>
          </View>
          <View style={styles.roleTag}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#10b981" />
            <Text style={[styles.roleTagText, { color: "#10b981" }]}>Admin → Admin Dashboard</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60 },
  themeToggle: { position: 'absolute', top: 24, right: 24, padding: 10, borderRadius: 12, borderWidth: 1, zIndex: 10 },
  header: { alignItems: "center", marginBottom: 32 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  appName: { fontSize: 32, fontWeight: "800", letterSpacing: 1 },
  tagline: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  card: { borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 12 },
  cardTitle: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  cardSubtitle: { fontSize: 14, marginBottom: 24, fontWeight: '500' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8, fontWeight: "600" },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  eyeBtn: { padding: 8 },
  loginBtn: { backgroundColor: "#6366f1", borderRadius: 16, height: 56, justifyContent: "center", alignItems: "center", marginTop: 8, shadowColor: "#6366f1", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 16, fontSize: 12, fontWeight: '800' },
  footerNote: { textAlign: "center", fontSize: 14, marginTop: 16, fontWeight: '500' },
  footerLink: { color: "#6366f1", fontWeight: "700" },
  roleInfo: { marginTop: 32, gap: 12, alignItems: "center" },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: 'rgba(99, 102, 241, 0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  roleTagText: { fontSize: 12, fontWeight: '700' },
});
