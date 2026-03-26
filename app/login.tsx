import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  const { login } = useAuth();
  const router = useRouter();

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
      })
      // _layout.tsx will automatically redirect based on role
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="ticket-outline" size={40} color="#6366f1" />
          </View>
          <Text style={styles.appName}>C-Raise</Text>
          <Text style={styles.tagline}>Ticketing & Support Platform</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in to your account</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
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
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Signup Link */}
          {/* <TouchableOpacity
            style={styles.signupBtn}
            onPress={() => router.push("/signup")}
            activeOpacity={0.85}
          >
            {/* <Text style={styles.signupBtnText}>Create New Account</Text> */}
          {/* </TouchableOpacity>  */}

          <Text style={styles.footerNote}>
            Don't have an account yet?{" "}
            <Text style={styles.footerLink} onPress={() => router.push("/signup")}>
              Sign Up
            </Text>
          </Text>
        </View>

        {/* Role Info */}
        <View style={styles.roleInfo}>
          <View style={styles.roleTag}>
            <Ionicons name="person-outline" size={14} color="#6366f1" />
            <Text style={styles.roleTagText}>Employee → Employee Dashboard</Text>
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
  container: { flex: 1, backgroundColor: "#0f172a" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },

  header: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e1b4b",
    borderWidth: 2,
    borderColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appName: { fontSize: 32, fontWeight: "800", color: "#f1f5f9", letterSpacing: 1 },
  tagline: { fontSize: 13, color: "#64748b", marginTop: 4 },

  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTitle: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 24 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: "#94a3b8", marginBottom: 6, fontWeight: "500" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: "#f1f5f9", fontSize: 15 },
  eyeBtn: { padding: 4 },

  loginBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#334155" },
  dividerText: { marginHorizontal: 12, color: "#475569", fontSize: 12 },

  signupBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#6366f1",
  },
  signupBtnText: { color: "#6366f1", fontSize: 15, fontWeight: "700" },

  footerNote: { textAlign: "center", color: "#475569", fontSize: 13, marginTop: 16 },
  footerLink: { color: "#6366f1", fontWeight: "600" },

  roleInfo: { marginTop: 24, gap: 10, alignItems: "center" },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleTagText: { fontSize: 12, color: "#6366f1" },
});
