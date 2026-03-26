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
export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup, createAdmin } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please fill in all fields",
      });
      return;
    }

    if (!email.includes("@") || email.split("@")[1] === "") {
      Toast.show({
        type: "error",
        text1: "Invalid Email",
        text2: "Use company email format",
      });
      return;
    }

    setLoading(true);

    try {
      // Try normal signup first
      await signup(name.trim(), email.trim(), password);

      Toast.show({
        type: "success",
        text1: "Success 🎉",
        text2: "Account created successfully",
      });

    } catch (err) {
      const msg = err?.message || err?.response?.data?.message;

      // 👑 If admin not exists → create admin
      if (msg && msg.includes("Admin must register first")) {
        try {
          await createAdmin(name.trim(), email.trim(), password);

          Toast.show({
            type: "success",
            text1: "Admin Created 🎉",
            text2: "You are now the admin",
          });

        } catch (adminErr) {
          Toast.show({
            type: "error",
            text1: "Admin Creation Failed",
            text2: "Try again",
          });
          setLoading(false);
          return;
        }
      } else {
        Toast.show({
          type: "error",
          text1: "Signup Failed",
          text2: msg || "Something went wrong",
        });
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    setTimeout(() => {
      router.replace("/login");
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/login")}>
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="people-outline" size={36} color="#6366f1" />
          </View>
          <Text style={styles.title}>New Employee</Text>
          <Text style={styles.subtitle}>Join your company's ticketing platform</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#475569"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your company email"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.hint}>
              Your company is detected from the @domain part.
            </Text>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
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

          {/* Signup Button */}
          <TouchableOpacity
            style={[styles.signupBtn, loading && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupBtnText}>Register Now</Text>}
          </TouchableOpacity>


        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
  backText: { color: "#94a3b8", fontSize: 14 },

  header: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1e1b4b",
    borderWidth: 2,
    borderColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#f1f5f9" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4 },

  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },

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
  hint: { fontSize: 11, color: "#475569", marginTop: 6, fontStyle: "italic" },

  signupBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  signupBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  footerNote: { textAlign: "center", color: "#475569", fontSize: 12, marginTop: 20 },
  adminTip: { color: "#6366f1", fontWeight: "600" },
});
