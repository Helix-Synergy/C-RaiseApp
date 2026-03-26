import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  RefreshControl,
  TextInput,
  FlatList,
  Alert,
  Share,
  Platform,
  Switch,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { useAuth, api } from "@/context/AuthContext";
import Toast from "react-native-toast-message";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  joinedAt?: string;
  ticketCount?: number;
}

interface Ticket {
  _id: string;
  title: string;
  description: string;
  status: "open" | "inprogress" | "closed" | "rejected";
  priority: "low" | "medium" | "high";
  category: string;
  adminReply?: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt?: string;
  attachments?: string[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  ticketId?: string;
  type?: "ticket" | "reply" | "escalation";
}

interface AnalyticsData {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  closedTickets: number;
  rejectedTickets: number;
  avgResponseTime: number;
  satisfactionRate: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

interface FilterOptions {
  status: string | null;
  priority: string | null;
  category: string | null;
  dateRange: { start: Date | null; end: Date | null };
  searchQuery: string;
}

export default function AdminDashboard() {
  const { user, logout, token, socket, changePassword } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"tickets" | "employees">("tickets");

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [updating, setUpdating] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Advanced Features State
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    closedTickets: 0,
    rejectedTickets: 0,
    avgResponseTime: 0,
    satisfactionRate: 0,
    categoryBreakdown: {},
    priorityBreakdown: {},
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: null,
    priority: null,
    category: null,
    dateRange: { start: null, end: null },
    searchQuery: "",
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "priority" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState<Employee | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [passLoading, setPassLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
    loadNotifications();
    loadSettings();
    startAutoRefresh();

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [token]);

  const loadSettings = async () => {
    try {
      const savedDarkMode = await AsyncStorage.getItem("darkMode");
      if (savedDarkMode !== null) setDarkMode(JSON.parse(savedDarkMode));

      const savedAutoRefresh = await AsyncStorage.getItem("autoRefresh");
      if (savedAutoRefresh !== null) setAutoRefresh(JSON.parse(savedAutoRefresh));
    } catch (e) {
      console.log("Error loading settings:", e);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem("darkMode", JSON.stringify(darkMode));
      await AsyncStorage.setItem("autoRefresh", JSON.stringify(autoRefresh));
    } catch (e) {
      console.log("Error saving settings:", e);
    }
  };

  const startAutoRefresh = () => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDataSilently();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    }
  };

  const fetchDataSilently = async () => {
    if (!token) return;
    try {
      const [ticketsRes, empsRes] = await Promise.all([
        api.get("/tickets/company"),
        api.get("/tickets/employees"),
      ]);
      setTickets(ticketsRes.data);
      setEmployees(empsRes.data);
      applyFilters(ticketsRes.data);
      calculateAnalytics(ticketsRes.data);
    } catch (e) {
      // Silent fail for auto-refresh
    }
  };

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem("admin_notifications");
      if (saved) setNotifications(JSON.parse(saved));
    } catch (e) {
      console.log("Error loading notifications:", e);
    }
  };

  const markNotificationsAsRead = async () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    await AsyncStorage.setItem("admin_notifications", JSON.stringify(updated));
  };

  const calculateAnalytics = (ticketData: Ticket[]) => {
    const open = ticketData.filter(t => t.status === "open").length;
    const inProgress = ticketData.filter(t => t.status === "inprogress").length;
    const closed = ticketData.filter(t => t.status === "closed").length;
    const rejected = ticketData.filter(t => t.status === "rejected").length;

    const categoryBreak: Record<string, number> = {};
    const priorityBreak: Record<string, number> = { low: 0, medium: 0, high: 0 };

    ticketData.forEach(t => {
      categoryBreak[t.category] = (categoryBreak[t.category] || 0) + 1;
      priorityBreak[t.priority] = (priorityBreak[t.priority] || 0) + 1;
    });

    // Calculate average response time (mock calculation - would need actual response time data)
    const avgResponseTime = Math.random() * 24; // Replace with actual calculation

    // Calculate satisfaction rate (mock - would need actual feedback data)
    const satisfactionRate = 85 + Math.random() * 10;

    setAnalytics({
      totalTickets: ticketData.length,
      openTickets: open,
      inProgressTickets: inProgress,
      closedTickets: closed,
      rejectedTickets: rejected,
      avgResponseTime,
      satisfactionRate,
      categoryBreakdown: categoryBreak,
      priorityBreakdown: priorityBreak,
    });
  };

  const applyFilters = (ticketData: Ticket[]) => {
    let filtered = [...ticketData];

    // Apply search
    if (filters.searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        t.user.name.toLowerCase().includes(filters.searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Apply date range
    if (filters.dateRange.start) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= filters.dateRange.end!);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "date") {
        return sortOrder === "desc"
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "priority") {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return sortOrder === "desc"
          ? priorityOrder[b.priority] - priorityOrder[a.priority]
          : priorityOrder[a.priority] - priorityOrder[b.priority];
      } else {
        const statusOrder = { open: 1, inprogress: 2, closed: 3, rejected: 4 };
        return sortOrder === "desc"
          ? statusOrder[b.status] - statusOrder[a.status]
          : statusOrder[a.status] - statusOrder[b.status];
      }
    });

    setFilteredTickets(filtered);

    // Extract unique categories
    const uniqueCategories = [...new Set(ticketData.map(t => t.category))];
    setCategories(uniqueCategories);
  };

  useEffect(() => {
    applyFilters(tickets);
    calculateAnalytics(tickets);
  }, [tickets, filters, sortBy, sortOrder]);

  useEffect(() => {
    if (socket) {
      socket.on("newTicket", (newTicket: Ticket) => {
        setTickets((prev) => [newTicket, ...prev]);

        const newNotif: Notification = {
          id: Date.now().toString(),
          title: "🚨 New Ticket!",
          message: `${newTicket.user?.name} raised: ${newTicket.title}`,
          timestamp: new Date(),
          read: false,
          ticketId: newTicket._id,
          type: "ticket",
        };

        setNotifications(prev => {
          const updated = [newNotif, ...prev].slice(0, 50); // Keep last 50 notifications
          AsyncStorage.setItem("admin_notifications", JSON.stringify(updated));
          return updated;
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Vibration.vibrate(500);

        Toast.show({
          type: "info",
          text1: "New Ticket 🚨",
          text2: `${newTicket.user?.name}: ${newTicket.title}`,
        });
      });

      socket.on("ticketUpdated", (updatedTicket: Ticket) => {
        setTickets((prev) =>
          prev.map((t) =>
            t._id === updatedTicket._id ? updatedTicket : t
          )
        );

        const newNotif: Notification = {
          id: Date.now().toString(),
          title: "📝 Ticket Updated",
          message: `Ticket "${updatedTicket.title}" has been updated`,
          timestamp: new Date(),
          read: false,
          ticketId: updatedTicket._id,
          type: "reply",
        };

        setNotifications(prev => {
          const updated = [newNotif, ...prev].slice(0, 50);
          AsyncStorage.setItem("admin_notifications", JSON.stringify(updated));
          return updated;
        });
      });
    }

    return () => {
      if (socket) {
        socket.off("newTicket");
        socket.off("ticketUpdated");
      }
    };
  }, [socket]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ticketsRes, empsRes] = await Promise.all([
        api.get("/tickets/company"),
        api.get("/tickets/employees"),
      ]);
      setTickets(ticketsRes.data);
      setEmployees(empsRes.data);
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.response?.data?.message || "Failed to load data",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (ticketId: string, newStatus: string) => {
    if (!replyText.trim()) {
      Toast.show({
        type: "error",
        text1: "Reply Required",
        text2: "Please enter a reply before updating status",
      });
      return;
    }

    setUpdating(true);
    try {
      await api.patch(`/tickets/${ticketId}/status`, {
        status: newStatus,
        adminReply: replyText,
      });

      setTickets((prev) =>
        prev.map((t) =>
          t._id === ticketId
            ? { ...t, status: newStatus as any, adminReply: replyText }
            : t
        )
      );

      Toast.show({
        type: "success",
        text1: "Updated ✅",
        text2: "Ticket updated successfully",
      });

      setSelectedTicket(null);
      setReplyText("");
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: e.response?.data?.message || "Could not update ticket",
      });
    } finally {
      setUpdating(false);
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedTickets.length === 0) return;

    Alert.alert(
      "Bulk Update",
      `Update ${selectedTickets.length} tickets to ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: async () => {
            setUpdating(true);
            try {
              await Promise.all(
                selectedTickets.map(ticketId =>
                  api.patch(`/tickets/${ticketId}/status`, {
                    status: newStatus,
                    adminReply: "Bulk update by admin",
                  })
                )
              );

              setTickets(prev =>
                prev.map(t =>
                  selectedTickets.includes(t._id)
                    ? { ...t, status: newStatus as any, adminReply: "Bulk update by admin" }
                    : t
                )
              );

              Toast.show({
                type: "success",
                text1: "Bulk Update Complete",
                text2: `Updated ${selectedTickets.length} tickets`,
              });

              setBulkActionMode(false);
              setSelectedTickets([]);
            } catch (e: any) {
              Toast.show({
                type: "error",
                text1: "Bulk Update Failed",
                text2: e.response?.data?.message || "Could not update tickets",
              });
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const exportData = {
        tickets: filteredTickets,
        employees,
        analytics,
        exportDate: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `ticket_export_${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonString);

      if (Platform.OS === 'ios' || await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Ticket Data',
        });
      } else {
        Toast.show({
          type: "success",
          text1: "Export Complete",
          text2: `Data saved to ${fileName}`,
        });
      }
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Export Failed",
        text2: e.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const shareTicket = async (ticket: Ticket) => {
    try {
      await Share.share({
        message: `Ticket: ${ticket.title}\nStatus: ${ticket.status.toUpperCase()}\nPriority: ${ticket.priority}\nDescription: ${ticket.description}\n\nCreated by: ${ticket.user.name}`,
        title: ticket.title,
      });
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Share Failed",
        text2: e.message,
      });
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <Ionicons name="alert-circle" size={16} color="#ef4444" />;
      case "medium":
        return <Ionicons name="warning" size={16} color="#f59e0b" />;
      case "low":
        return <Ionicons name="information-circle" size={16} color="#10b981" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "#f59e0b";
      case "inprogress":
        return "#1a73e8";
      case "closed":
        return "#1e8e3e";
      case "rejected":
        return "#d93025";
      default:
        return "#5f6368";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "#d93025";
      case "medium": return "#f9ab00";
      case "low": return "#1e8e3e";
      default: return "#5f6368";
    }
  };

  const handleChangePassword = async () => {
    if (!passForm.current || !passForm.new) {
      return Toast.show({ type: "error", text1: "Error", text2: "All fields required" });
    }
    if (passForm.new !== passForm.confirm) {
      return Toast.show({ type: "error", text1: "Error", text2: "Passwords do not match" });
    }
    setPassLoading(true);
    try {
      await changePassword(passForm.current, passForm.new);
      Toast.show({ type: "success", text1: "Success", text2: "Password updated" });
      setShowPasswordModal(false);
      setPassForm({ current: "", new: "", confirm: "" });
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Update Failed", text2: e.response?.data?.message || e.message });
    } finally {
      setPassLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const clearFilters = () => {
    setFilters({
      status: null,
      priority: null,
      category: null,
      dateRange: { start: null, end: null },
      searchQuery: "",
    });
    setSortBy("date");
    setSortOrder("desc");
  };

  const animatedHeaderStyle = {
    opacity: fadeAnim,
    transform: [{
      translateY: scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -50],
        extrapolate: 'clamp',
      })
    }]
  };

  const pieChartData = Object.entries(analytics.categoryBreakdown).map(([name, count]) => ({
    name: name.substring(0, 10),
    population: count,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    legendFontColor: "#fff",
  }));

  return (
    <View style={[styles.container, { backgroundColor: darkMode ? "#0f172a" : "#f1f3f4" }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Google-Style Header & Search */}
      <View style={[styles.googleHeader, { backgroundColor: darkMode ? "#1e293b" : "#fff" }]}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={22} color="#5f6368" />
          <TextInput
            placeholder="Search queries, team..."
            placeholderTextColor="#70757a"
            style={[styles.searchInput, { color: darkMode ? "#fff" : "#202124" }]}
            value={filters.searchQuery}
            onChangeText={(text) => setFilters({ ...filters, searchQuery: text })}
          />
          <TouchableOpacity onPress={() => setShowNotifications(!showNotifications)}>
            <Ionicons name="notifications-outline" size={22} color="#5f6368" />
            {notifications.some(n => !n.read) && <View style={styles.googleNotifBadge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProfileMenu(true)} style={{ marginLeft: 15 }}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* View Selection Tabs */}
        <View style={styles.mdTabs}>
          <TouchableOpacity
            onPress={() => setView("tickets")}
            style={[styles.mdTab, view === "tickets" && styles.mdTabActive]}
          >
            <Ionicons name="ticket-outline" size={20} color={view === "tickets" ? "#1a73e8" : "#5f6368"} />
            <Text style={[styles.mdTabText, view === "tickets" && styles.mdTabTextActive]}>Tickets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView("employees")}
            style={[styles.mdTab, view === "employees" && styles.mdTabActive]}
          >
            <Ionicons name="people-outline" size={20} color={view === "employees" ? "#1a73e8" : "#5f6368"} />
            <Text style={[styles.mdTabText, view === "employees" && styles.mdTabTextActive]}>Team</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAnalytics(!showAnalytics)}
            style={[styles.mdTab, showAnalytics && styles.mdTabActive]}
          >
            <Ionicons name="stats-chart-outline" size={20} color={showAnalytics ? "#1a73e8" : "#5f6368"} />
            <Text style={[styles.mdTabText, showAnalytics && styles.mdTabTextActive]}>Stats</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a73e8" />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Analytics Section */}
        {showAnalytics && (
          <View style={[styles.analyticsContainer, darkMode && styles.darkCard]}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{analytics.totalTickets}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#f9ab00" }]}>{analytics.openTickets}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#1a73e8" }]}>{analytics.inProgressTickets}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#1e8e3e" }]}>{analytics.closedTickets}</Text>
                <Text style={styles.statLabel}>Resolved</Text>
              </View>
            </View>

            <View style={styles.chartArea}>
              {pieChartData.length > 0 && (
                <PieChart
                  data={pieChartData}
                  width={Dimensions.get("window").width - 80}
                  height={180}
                  chartConfig={{ color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})` }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              )}
            </View>

            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{analytics.avgResponseTime.toFixed(1)}h</Text>
                <Text style={styles.metricLabel}>Response Time</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{analytics.satisfactionRate.toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>Satisfaction</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bulk Action Bar */}
        {bulkActionMode && selectedTickets.length > 0 && (
          <Animated.View style={styles.bulkActionBar}>
            <Text style={styles.bulkText}>{selectedTickets.length} items</Text>
            <View style={styles.bulkActions}>
              <TouchableOpacity onPress={() => bulkUpdateStatus("inprogress")}>
                <Text style={styles.bulkActionText}>IN PROGRESS</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => bulkUpdateStatus("closed")}>
                <Text style={styles.bulkActionText}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedTickets([])}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* List Content */}
        {loading ? (
          <ActivityIndicator size="large" color="#1a73e8" style={styles.loader} />
        ) : view === "tickets" ? (
          filteredTickets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={60} color="#dadce0" />
              <Text style={styles.emptyStateText}>No tickets found</Text>
            </View>
          ) : (
            filteredTickets.map((t) => (
              <TouchableOpacity
                key={t._id}
                style={[
                  styles.ticketCard, 
                  darkMode && styles.darkCard,
                  { borderLeftColor: getStatusColor(t.status) },
                  selectedTickets.includes(t._id) && styles.selectedTicket
                ]}
                onPress={() => bulkActionMode ? 
                  setSelectedTickets(prev => prev.includes(t._id) ? prev.filter(id => id !== t._id) : [...prev, t._id]) : 
                  setSelectedTicket(t)
                }
              >
                <View style={styles.ticketHeader}>
                  <View style={styles.ticketInfo}>
                    <Text style={[styles.ticketTitle, darkMode && styles.darkText]}>{t.title}</Text>
                    <View style={styles.ticketMeta}>
                      <Text style={[styles.ticketPriority, { color: getPriorityColor(t.priority) }]}>{t.priority}</Text>
                      <Text style={styles.ticketCategory}>• {t.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => shareTicket(t)}>
                    <Ionicons name="share-social-outline" size={20} color="#5f6368" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.ticketDesc, darkMode && styles.darkMutedText]} numberOfLines={2}>{t.description}</Text>
                <View style={styles.ticketFooter}>
                  <Text style={styles.ticketUser}>{t.user.name}</Text>
                  <Text style={styles.ticketDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                  <Text style={[styles.ticketStatus, { backgroundColor: getStatusColor(t.status) + '20', color: getStatusColor(t.status) }]}>
                    {t.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          employees.map((emp) => (
            <TouchableOpacity
              key={emp._id}
              style={[styles.employeeCard, darkMode && styles.darkCard]}
              onPress={() => setShowEmployeeDetails(emp)}
            >
              <View style={styles.employeeAvatar}>
                <Text style={styles.avatarText}>{emp.name.charAt(0)}</Text>
              </View>
              <View style={styles.employeeInfo}>
                <Text style={[styles.employeeName, darkMode && styles.darkText]}>{emp.name}</Text>
                <Text style={styles.employeeEmail}>{emp.email}</Text>
              </View>
              <View style={styles.employeeBadge}>
                <Text style={styles.badgeText}>{emp.role}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button for Export */}
      <TouchableOpacity 
        style={styles.exportFAB} 
        onPress={exportData}
        disabled={exporting}
      >
        {exporting ? <ActivityIndicator color="#fff" /> : <Feather name="download" size={24} color="#fff" />}
      </TouchableOpacity>

      {/* Ticket Modal */}
      <Modal visible={!!selectedTicket} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkCard]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>{selectedTicket?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <Ionicons name="close" size={28} color={darkMode ? "#fff" : "#202124"} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalInfo}>
                <Text style={styles.modalLabel}>REQUESTED BY</Text>
                <Text style={[styles.modalValue, darkMode && styles.darkText]}>{selectedTicket?.user.name} ({selectedTicket?.user.email})</Text>
              </View>
              <View style={styles.modalInfo}>
                <Text style={styles.modalLabel}>DESCRIPTION</Text>
                <Text style={[styles.modalValue, darkMode && styles.darkText]}>{selectedTicket?.description}</Text>
              </View>
              <TextInput
                placeholder="Type internal reply or resolution..."
                placeholderTextColor="#999"
                style={[styles.input, darkMode && styles.darkInput]}
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <Text style={styles.modalLabel}>UPDATE STATUS</Text>
              {["inprogress", "closed", "rejected"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusButton, { borderColor: getStatusColor(s) }]}
                  onPress={() => updateStatus(selectedTicket!._id, s)}
                >
                  <Text style={[styles.statusButtonText, { color: getStatusColor(s) }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Notifications Overlay */}
      {showNotifications && (
        <View style={styles.notifPanel}>
          <Text style={styles.panelTitle}>Updates</Text>
          <ScrollView>
            {notifications.map(n => (
              <TouchableOpacity key={n.id} style={[styles.notifItem, !n.read && styles.unreadNotif]}>
                <Text style={styles.notifText}>{n.message}</Text>
                <Text style={styles.notifTime}>{new Date(n.timestamp).toLocaleTimeString()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Toast />

      {/* Profile Menu Dropdown Overlay */}
      <Modal visible={showProfileMenu} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setShowProfileMenu(false)}
        >
          <View style={[styles.profileMenu, darkMode && styles.darkCard]}>
            <View style={styles.menuHeader}>
              <View style={styles.largeAvatar}>
                <Text style={styles.largeAvatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={[styles.menuName, darkMode && styles.darkText]}>Hi, {user?.name}</Text>
                <Text style={styles.menuEmail}>{user?.email}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setShowProfileMenu(false);
                setShowPasswordModal(true);
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#5f6368" />
              <Text style={[styles.menuItemText, darkMode && styles.darkText]}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#f1f3f4' }]} 
              onPress={() => {
                setShowProfileMenu(false);
                logout();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#d93025" />
              <Text style={[styles.menuItemText, { color: '#d93025' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkCard, { height: 'auto', paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={28} color={darkMode ? "#fff" : "#202124"} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              placeholder="Current Password"
              placeholderTextColor="#999"
              secureTextEntry
              style={[styles.input, darkMode && styles.darkInput]}
              value={passForm.current}
              onChangeText={(t) => setPassForm({...passForm, current: t})}
            />
            <TextInput
              placeholder="New Password"
              placeholderTextColor="#999"
              secureTextEntry
              style={[styles.input, darkMode && styles.darkInput]}
              value={passForm.new}
              onChangeText={(t) => setPassForm({...passForm, new: t})}
            />
            <TextInput
              placeholder="Confirm New Password"
              placeholderTextColor="#999"
              secureTextEntry
              style={[styles.input, darkMode && styles.darkInput]}
              value={passForm.confirm}
              onChangeText={(t) => setPassForm({...passForm, confirm: t})}
            />

            <TouchableOpacity 
              style={[styles.statusButton, { backgroundColor: '#1a73e8', borderColor: '#1a73e8' }]}
              onPress={handleChangePassword}
              disabled={passLoading}
            >
              {passLoading ? <ActivityIndicator color="#fff" /> : 
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>UPDATE PASSWORD</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  googleHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#dadce0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 243, 244, 0.8)',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dfe1e5',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  mdTabs: {
    flexDirection: 'row',
    marginTop: 15,
    paddingHorizontal: 10,
  },
  mdTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  mdTabActive: { borderBottomColor: '#1a73e8' },
  mdTabText: { color: '#5f6368', fontSize: 14, fontWeight: '500' },
  mdTabTextActive: { color: '#1a73e8' },
  content: { padding: 16 },
  analyticsContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#202124', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, marginHorizontal: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  statLabel: { fontSize: 11, color: '#5f6368', marginTop: 4 },
  chartArea: { alignItems: 'center', marginVertical: 16 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#202124', marginBottom: 12 },
  ticketCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, borderLeftWidth: 4 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ticketTitle: { fontSize: 16, fontWeight: '600', color: '#202124', flex: 1 },
  ticketMeta: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  ticketPriority: { fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' },
  ticketCategory: { fontSize: 12, color: '#5f6368', fontStyle: 'italic' },
  ticketDesc: { fontSize: 14, color: '#3c4043', lineHeight: 20 },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f3f4' },
  ticketUser: { fontSize: 12, color: '#5f6368' },
  ticketStatus: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  employeeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  employeeAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '600', color: '#202124' },
  employeeEmail: { fontSize: 13, color: '#5f6368', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(32, 33, 36, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#202124' },
  input: { backgroundColor: '#f1f3f4', borderRadius: 12, padding: 16, textAlignVertical: 'top', marginVertical: 16, fontSize: 15 },
  statusButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginVertical: 6, borderWidth: 1 },
  statusButtonText: { fontWeight: '700', fontSize: 14 },
  exportFAB: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1a73e8', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3 },
  googleNotifBadge: { width: 8, height: 8, backgroundColor: '#d93025', borderRadius: 4, position: 'absolute', top: 0, right: 0, borderWidth: 1, borderColor: '#fff' },
  notifPanel: { position: 'absolute', top: 110, right: 16, left: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 10, padding: 16, borderWidth: 1, borderColor: '#dadce0' },
  panelTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  notifItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  unreadNotif: { backgroundColor: '#e8f0fe' },
  notifText: { fontSize: 14, color: '#202124' },
  notifTime: { fontSize: 12, color: '#5f6368', marginTop: 4 },
  
  // Missing Styles from Overhaul
  darkCard: { backgroundColor: '#111' },
  darkText: { color: '#fff' },
  darkMutedText: { color: '#aaa' },
  darkInput: { backgroundColor: '#222', color: '#fff' },
  metricsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  metricItem: { alignItems: 'center' },
  metricValue: { color: '#10b981', fontSize: 18, fontWeight: 'bold' },
  metricLabel: { color: '#888', fontSize: 12 },
  filtersContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  filterTitle: { fontSize: 16, fontWeight: 'bold', color: '#202124' },
  clearFilters: { color: '#1a73e8', fontSize: 12 },
  filterChips: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f3f4', borderRadius: 20, marginRight: 8 },
  activeChip: { backgroundColor: '#1a73e8' },
  chipText: { color: '#5f6368', fontSize: 12 },
  sortControls: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  sortLabel: { color: '#5f6368', marginRight: 10 },
  sortButton: { marginRight: 10 },
  sortText: { color: '#5f6368' },
  activeSort: { color: '#1a73e8', fontWeight: 'bold' },
  bulkActionBar: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 10, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bulkText: { color: '#fff', fontWeight: 'bold' },
  bulkActions: { flexDirection: 'row', gap: 15 },
  bulkActionText: { color: '#fff', fontWeight: 'bold' },
  exportButton: { backgroundColor: '#34a853', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginBottom: 15, gap: 8 },
  exportButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { color: '#5f6368', textAlign: 'center', padding: 20 },
  loader: { marginTop: 50 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#888', fontSize: 16, marginTop: 10 },
  selectedTicket: { borderWidth: 2, borderColor: '#1a73e8' },
  checkbox: { marginRight: 10 },
  ticketInfo: { flex: 1 },
  ticketDate: { fontSize: 12, color: '#5f6368' },
  employeeBadge: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#1a73e8', fontSize: 12 },
  employeeStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f3f4' },
  employeeStat: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#202124' },
  modalInfo: { marginBottom: 15 },
  modalLabel: { fontSize: 12, color: '#5f6368', marginBottom: 4 },
  modalValue: { fontSize: 14, color: '#202124' },
  employeeDetailAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a73e8', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  employeeDetailAvatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', marginBottom: 12, paddingHorizontal: 10 },
  detailLabel: { color: '#5f6368', width: 80, fontSize: 14 },
  detailValue: { fontSize: 14, flex: 1, color: '#202124' },
  
  // Profile Menu Styles
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 20 },
  profileMenu: { backgroundColor: '#fff', borderRadius: 16, padding: 8, width: 220, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f4', marginBottom: 8 },
  largeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a73e8', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  largeAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  menuName: { fontSize: 14, fontWeight: 'bold', color: '#202124' },
  menuEmail: { fontSize: 11, color: '#5f6368' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 8 },
  menuItemText: { fontSize: 14, color: '#3c4043' },
});