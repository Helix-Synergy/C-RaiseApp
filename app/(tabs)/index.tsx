import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
  Share,
  Vibration,
  Platform,
  FlatList,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth, api } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { BlurView } from "expo-blur";
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';

interface Comment {
  user: { _id: string; name: string };
  text: string;
  createdAt: string;
}

interface Ticket {
  _id: string;
  title: string;
  description: string;
  status: "open" | "inprogress" | "closed" | "rejected";
  priority: "low" | "medium" | "high";
  category: string;
  attachments?: string[];
  assignedTo?: { _id: string; name: string };
  comments: Comment[];
  adminReply?: string;
  createdAt: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  ticketId?: string;
}

export default function EmployeeDashboard() {
  const { user, logout, token, socket, changePassword } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: "", description: "", priority: "medium", category: "general" });
  const [raising, setRaising] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [commentText, setCommentText] = useState("");
  const [activeTicketForComment, setActiveTicketForComment] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [offlineMode, setOfflineMode] = useState(false);
  const [currentView, setCurrentView] = useState<'grid' | 'list'>('list');
  const [voiceSearchActive, setVoiceSearchActive] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [passLoading, setPassLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Dynamic Colors
  const colors = {
    bg: isDarkMode ? "#0f172a" : "#f8fafc",
    card: isDarkMode ? "#1e293b" : "#ffffff",
    text: isDarkMode ? "#f8fafc" : "#0f172a",
    subtext: isDarkMode ? "#94a3b8" : "#64748b",
    border: isDarkMode ? "#334155" : "#e2e8f0",
    accent: "#6366f1"
  };

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem('notifications');
      if (saved) setNotifications(JSON.parse(saved));
    } catch (e) {
      console.log("Error loading notifications:", e);
    }
  };

  const markNotificationsAsRead = async () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    await AsyncStorage.setItem('notifications', JSON.stringify(updated));
  };

  const loadCachedTickets = async () => {
    try {
      const cached = await AsyncStorage.getItem(`tickets_${user?._id}`);
      if (cached) setTickets(JSON.parse(cached));
    } catch (e) {
      console.log("Offline load error:", e);
    }
  };

  const fetchMyTickets = async () => {
    if (!token) return;
    try {
      const res = await api.get("/tickets/my");
      setTickets(res.data);
      await AsyncStorage.setItem(`tickets_${user?._id}`, JSON.stringify(res.data));
    } catch (e: any) {
      console.log("Fetch error:", e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCachedTickets();
    fetchMyTickets();
    loadNotifications();
  }, [token]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("ticketUpdated", (updatedTicket: Ticket) => {
        setTickets((prev) =>
          prev.map((t) => (t._id === updatedTicket._id ? updatedTicket : t))
        );

        // Add notification
        const newNotification: Notification = {
          id: Date.now().toString(),
          title: "Ticket Updated",
          message: `Ticket "${updatedTicket.title}" status changed to ${updatedTicket.status}`,
          type: 'info',
          timestamp: new Date(),
          read: false,
          ticketId: updatedTicket._id,
        };
        setNotifications(prev => {
          const updated = [newNotification, ...prev];
          AsyncStorage.setItem('notifications', JSON.stringify(updated));
          return updated;
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate(500);
      });
    }
    return () => {
      if (socket) socket.off("ticketUpdated");
    };
  }, [socket]);



  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyTickets();
    setRefreshing(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRaiseTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      Alert.alert("Error", "Please fill in both title and description.");
      return;
    }
    setRaising(true);
    try {
      const res = await api.post("/tickets", { ...newTicket, attachments });
      setTickets([res.data, ...tickets]);
      setNewTicket({ title: "", description: "", priority: "medium", category: "general" });
      setAttachments([]);
      setIsModalOpen(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Ticket raised successfully!");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Could not raise ticket.");
    } finally {
      setRaising(false);
    }
  };

  const handleDocumentSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true
      });

      if (!result.canceled && result.assets) {
        const fileNames = result.assets.map(asset => asset.name);
        setAttachments([...attachments, ...fileNames]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn("Document picking error:", err);
      Alert.alert("Error", "Could not pick document");
    }
  };

  const handleAddComment = async (ticketId: string) => {
    if (!commentText.trim()) return;
    try {
      await api.post(`/tickets/${ticketId}/comments`, { text: commentText });
      setCommentText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Sent", "Your comment has been added.");
    } catch (e) {
      Alert.alert("Error", "Could not post comment.");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleChangePassword = async () => {
    if (!passForm.current || !passForm.new) {
      return Alert.alert("Error", "All fields required");
    }
    if (passForm.new !== passForm.confirm) {
      return Alert.alert("Error", "Passwords do not match");
    }
    setPassLoading(true);
    try {
      await changePassword(passForm.current, passForm.new);
      Alert.alert("Success", "Password updated successfully");
      setShowPasswordModal(false);
      setPassForm({ current: "", new: "", confirm: "" });
    } catch (e: any) {
      Alert.alert("Update Failed", e.response?.data?.message || e.message);
    } finally {
      setPassLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "#f59e0b";
      case "inprogress": return "#6366f1";
      case "closed": return "#10b981";
      case "rejected": return "#ef4444";
      default: return "#64748b";
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
      default: return "#64748b";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return "alert-circle";
      case "inprogress": return "progress-clock";
      case "closed": return "check-circle";
      case "rejected": return "close-circle";
      default: return "help-circle";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return "alert";
      case "medium": return "alert-outline";
      case "low": return "information";
      default: return "flag";
    }
  };

  // Stats for Chart
  const total = tickets.length || 1;
  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    inprogress: tickets.filter(t => t.status === "inprogress").length,
    closed: tickets.filter(t => t.status === "closed").length,
    rejected: tickets.filter(t => t.status === "rejected").length,
  };

  // Filter + Search + Sort
  const filteredTickets = tickets
    .filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t._id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc'
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return sortOrder === 'desc'
          ? priorityOrder[b.priority] - priorityOrder[a.priority]
          : priorityOrder[a.priority] - priorityOrder[b.priority];
      } else {
        const statusOrder = { open: 1, inprogress: 2, closed: 3, rejected: 4 };
        return sortOrder === 'desc'
          ? statusOrder[b.status] - statusOrder[a.status]
          : statusOrder[a.status] - statusOrder[b.status];
      }
    });

  const shareTicket = async (ticket: Ticket) => {
    try {
      await Share.share({
        message: `Ticket: ${ticket.title}\nStatus: ${ticket.status}\nPriority: ${ticket.priority}\nID: ${ticket._id}\nDescription: ${ticket.description}`,
        title: ticket.title,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const copyTicketId = (id: string) => {
    Clipboard.setStringAsync(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Ticket ID copied to clipboard");
  };

  const getAnalytics = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today
    
    let labels: string[] = [];
    let dataPoints: number[] = [];

    if (analyticsPeriod === 'week') {
      dataPoints = Array(7).fill(0);
      labels = Array(7).fill("").map((_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { weekday: 'short' });
      });

      tickets.forEach(t => {
        const tDate = new Date(t.createdAt);
        const diffDays = Math.floor((now.getTime() - tDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          dataPoints[6 - diffDays]++;
        }
      });
    } else if (analyticsPeriod === 'month') {
      dataPoints = Array(30).fill(0);
      labels = Array(30).fill("").map((_, i) => (i % 5 === 0 ? `${i + 1}` : ""));
      
      tickets.forEach(t => {
        const tDate = new Date(t.createdAt);
        const diffDays = Math.floor((now.getTime() - tDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays < 30) {
          dataPoints[29 - diffDays]++;
        }
      });
    } else {
      dataPoints = Array(12).fill(0);
      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; // Simplest for year
      
      tickets.forEach(t => {
        const tDate = new Date(t.createdAt);
        const monthIndex = tDate.getMonth();
        dataPoints[monthIndex]++;
      });
    }

    return { labels, dataPoints: dataPoints.length ? dataPoints : [0] };
  };

  const analytics = getAnalytics();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <BlurView intensity={isDarkMode ? 80 : 40} style={styles.blurHeader}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.subtext }]}>Welcome Back 👋</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name || "Member"}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                const nextVal = !showNotifications;
                setShowNotifications(nextVal);
                if (nextVal) markNotificationsAsRead();
              }}
              style={[styles.iconBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.subtext} />
              {notifications.filter(n => !n.read).length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notifications.filter(n => !n.read).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={[styles.iconBtn, { borderColor: colors.border }]}>
              <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={20} color={isDarkMode ? "#f59e0b" : "#6366f1"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.profileIconBtn, { borderColor: colors.border, backgroundColor: colors.accent }]} 
              onPress={() => setShowProfileMenu(true)}
            >
              <Text style={styles.profileInitialText}>{user?.name?.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Notifications Panel */}
      {showNotifications && (
        <Animated.View style={[styles.notificationsPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.notificationsHeader}>
            <Text style={[styles.notificationsTitle, { color: colors.text }]}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <Ionicons name="close" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>
          {notifications.length === 0 ? (
            <Text style={[styles.noNotifications, { color: colors.subtext }]}>No notifications</Text>
          ) : (
            notifications.map(notif => (
              <TouchableOpacity
                key={notif.id}
                onPress={() => {
                  if (notif.ticketId) {
                    const found = tickets.find(t => t._id === notif.ticketId);
                    if (found) {
                      setSelectedTicket(found);
                      setDetailModalVisible(true);
                      setShowNotifications(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }
                }}
                style={[styles.notificationItem, { backgroundColor: colors.bg }]}
              >
                <View style={[styles.notificationDot, { backgroundColor: notif.read ? colors.subtext : colors.accent }]} />
                <View style={styles.notificationContent}>
                  <Text style={[styles.notificationTitle, { color: colors.text }]}>{notif.title}</Text>
                  <Text style={[styles.notificationMessage, { color: colors.subtext }]}>{notif.message}</Text>
                  <Text style={[styles.notificationTime, { color: colors.subtext }]}>
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
        }
      >
        <View style={styles.rolePill}>
          <MaterialCommunityIcons name="ticket-account" size={14} color="#6366f1" />
          <Text style={styles.rolePillText}>Support Center • {tickets.length} Tickets</Text>
        </View>

        {/* Enhanced Analytics Section */}
        <View style={[styles.analyticsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.analyticsHeader}
            onPress={() => setShowAnalytics(!showAnalytics)}
            activeOpacity={0.7}
          >
            <View style={styles.analyticsTitleRow}>
              <MaterialCommunityIcons name="chart-line" size={20} color={colors.accent} />
              <Text style={[styles.analyticsTitle, { color: colors.text }]}>Analytics Dashboard</Text>
            </View>
            <Ionicons name={showAnalytics ? "chevron-up" : "chevron-down"} size={20} color={colors.subtext} />
          </TouchableOpacity>

          {showAnalytics && (
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={styles.periodSelector}>
                {(['week', 'month', 'year'] as const).map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[styles.periodBtn, analyticsPeriod === period && styles.periodBtnActive]}
                    onPress={() => setAnalyticsPeriod(period)}
                  >
                    <Text style={[styles.periodBtnText, analyticsPeriod === period && { color: colors.accent }]}>
                      {period.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <LineChart
                data={{
                  labels: analytics.labels,
                  datasets: [{ data: analytics.dataPoints }]
                }}
                width={Dimensions.get("window").width - 48}
                height={200}
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                  labelColor: (opacity = 1) => colors.subtext,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: colors.accent }
                }}
                bezier
                style={styles.chart}
              />

              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.kpiLabel, { color: colors.subtext }]}>Resolution Rate</Text>
                  <Text style={[styles.kpiValue, { color: colors.accent }]}>
                    {Math.round((stats.closed / total) * 100)}%
                  </Text>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                </View>
                <View style={[styles.kpiCard, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.kpiLabel, { color: colors.subtext }]}>Avg Response</Text>
                  <Text style={[styles.kpiValue, { color: colors.accent }]}>2.4h</Text>
                  <Ionicons name="trending-down" size={16} color="#10b981" />
                </View>
                <TouchableOpacity
                  onPress={() => setFilterStatus('open')}
                  style={[styles.kpiCard, { backgroundColor: colors.bg }]}
                >
                  <Text style={[styles.kpiLabel, { color: colors.subtext }]}>Open Tickets</Text>
                  <Text style={[styles.kpiValue, { color: colors.accent }]}>{stats.open}</Text>
                  <Ionicons name="time-outline" size={16} color="#f59e0b" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tickets & Inquiries</Text>

        {/* Enhanced Search Section */}
        <View style={[styles.enhancedSearchSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.searchMainRow}>
            <Ionicons name="search-outline" size={20} color={colors.subtext} />
            <TextInput
              style={[styles.enhancedSearchInput, { color: colors.text }]}
              placeholder="Search by title, description, or ID..."
              placeholderTextColor={colors.subtext}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity
              onPress={() => {
                setVoiceSearchActive(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert("Voice Search", "Listening for your query...");
              }}
              style={styles.voiceBtn}
            >
              <Ionicons name="mic" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            <View style={styles.chipsContainer}>
              {['all', 'technical', 'billing', 'general'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <MaterialCommunityIcons
                    name={cat === 'technical' ? 'code-tags' : cat === 'billing' ? 'credit-card' : 'chat'}
                    size={12}
                    color={selectedCategory === cat ? colors.accent : colors.subtext}
                  />
                  <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive, { color: selectedCategory === cat ? colors.accent : colors.subtext }]}>
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.advancedFiltersRow}>
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => {
                setSortBy('date');
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
            >
              <Ionicons name="calendar" size={14} color={colors.subtext} />
              <Text style={[styles.filterOptionText, { color: colors.subtext }]}>
                {sortBy === 'date' ? `Date ${sortOrder === 'desc' ? '↓' : '↑'}` : 'Date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => {
                setSortBy('priority');
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
            >
              <Ionicons name="flag" size={14} color={colors.subtext} />
              <Text style={[styles.filterOptionText, { color: colors.subtext }]}>
                {sortBy === 'priority' ? `Priority ${sortOrder === 'desc' ? '↓' : '↑'}` : 'Priority'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => setCurrentView(currentView === 'list' ? 'grid' : 'list')}
            >
              <Ionicons name={currentView === 'list' ? 'grid-outline' : 'list-outline'} size={14} color={colors.subtext} />
              <Text style={[styles.filterOptionText, { color: colors.subtext }]}>
                {currentView === 'list' ? 'Grid' : 'List'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => setOfflineMode(!offlineMode)}
            >
              <Ionicons name={offlineMode ? 'cloud-offline' : 'cloud'} size={14} color={offlineMode ? '#ef4444' : colors.subtext} />
              <Text style={[styles.filterOptionText, { color: offlineMode ? '#ef4444' : colors.subtext }]}>
                {offlineMode ? 'Offline' : 'Online'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRowAlt}>
            {["all", "open", "inprogress", "closed", "rejected"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterBtnAlt,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  filterStatus === s && { backgroundColor: colors.accent + "55", borderColor: colors.accent },
                ]}
                onPress={() => setFilterStatus(s)}
              >
                <MaterialCommunityIcons
                  name={s === 'all' ? 'format-list-bulleted' : getStatusIcon(s)}
                  size={12}
                  color={filterStatus === s ? colors.accent : colors.subtext}
                />
                <Text style={[styles.filterTextAlt, { color: colors.subtext }, filterStatus === s && { color: colors.accent }]}>
                  {s === 'all' ? 'ALL' : s === 'inprogress' ? 'ACTIVE' : s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 50 }} size="large" />
        ) : filteredTickets.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={60} color={colors.subtext} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No tickets found</Text>
            <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
              {search ? "Try different search terms" : "Raise a new ticket to get started"}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setIsModalOpen(true)}
            >
              <Text style={styles.emptyActionBtnText}>+ Create New Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={currentView === 'grid' ? styles.gridContainer : styles.listContainer}>
            {filteredTickets.map((t, index) => (
              <Animated.View
                key={t._id}
                style={[
                  currentView === 'grid' ? styles.gridCard : styles.ticketCard,
                  {
                    opacity: fadeAnim,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }]
                  }
                ]}
              >
                <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(t.priority) }]} />

                <TouchableOpacity
                  onPress={() => {
                    setSelectedTicket(t);
                    setDetailModalVisible(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={styles.ticketHeader}>
                    <View style={styles.titleArea}>
                      <Text style={[styles.ticketTitle, { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
                      <View style={styles.metaRow}>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(t.priority) + "15" }]}>
                          <MaterialCommunityIcons
                            name={getPriorityIcon(t.priority)}
                            size={10}
                            color={getPriorityColor(t.priority)}
                          />
                          <Text style={[styles.priorityText, { color: getPriorityColor(t.priority) }]}>
                            {t.priority.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.categoryBadge}>
                          <MaterialCommunityIcons name="tag-outline" size={10} color={colors.accent} />
                          <Text style={[styles.categoryText, { color: colors.accent }]}>{t.category || "General"}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(t.status) + "22" }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(t.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(t.status) }]}>
                        {t.status === 'inprogress' ? 'IN PROGRESS' : t.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.ticketDesc, { color: colors.subtext }]} numberOfLines={2}>
                    {t.description}
                  </Text>

                  {t.status === 'inprogress' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '65%', backgroundColor: getStatusColor(t.status) }]} />
                      </View>
                      <Text style={[styles.progressText, { color: colors.subtext }]}>65% Complete</Text>
                    </View>
                  )}

                  {t.adminReply && (
                    <View style={[styles.replyBox, { backgroundColor: isDarkMode ? "#020617" : "#f1f5f9" }]}>
                      <View style={styles.replyHeader}>
                        <MaterialCommunityIcons name="shield-account" size={14} color={colors.accent} />
                        <Text style={[styles.replyLabel, { color: colors.accent }]}>Support Response</Text>
                      </View>
                      <Text style={[styles.replyText, { color: colors.subtext }]} numberOfLines={2}>{t.adminReply}</Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.footerLeft}>
                      <Ionicons name="time-outline" size={12} color={colors.subtext} />
                      <Text style={[styles.footerText, { color: colors.subtext }]}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.footerRight}>
                      <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => copyTicketId(t._id)}
                      >
                        <Ionicons name="copy-outline" size={14} color={colors.subtext} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => shareTicket(t)}
                      >
                        <Ionicons name="share-outline" size={14} color={colors.subtext} />
                      </TouchableOpacity>
                      <View style={[styles.commentCount, { backgroundColor: colors.border }]}>
                        <Ionicons name="chatbubble-outline" size={10} color={colors.subtext} />
                        <Text style={[styles.commentCountText, { color: colors.subtext }]}>{t.comments.length}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={[styles.quickReplySection, { borderTopColor: colors.border }]}>
                  <TextInput
                    style={[styles.quickReplyInput, { color: colors.text, backgroundColor: colors.bg }]}
                    placeholder="Quick reply..."
                    placeholderTextColor={colors.subtext}
                    value={commentText}
                    onChangeText={setCommentText}
                  />
                  <TouchableOpacity
                    style={styles.sendReplyBtn}
                    onPress={() => handleAddComment(t._id)}
                  >
                    <Ionicons name="send" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Quick Action FAB */}
      <TouchableOpacity
        style={styles.raiseBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsModalOpen(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.raiseBtnText}>Raise Ticket</Text>
      </TouchableOpacity>

      {/* Enhanced Raise Ticket Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} style={styles.modalBlur}>
            <View style={[styles.enhancedModalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create New Ticket</Text>
                <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Title *</Text>
                <TextInput
                  style={[styles.enhancedInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
                  placeholder="Brief summary of your issue"
                  placeholderTextColor={colors.subtext}
                  value={newTicket.title}
                  onChangeText={(text) => setNewTicket({ ...newTicket, title: text })}
                />

                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Description *</Text>
                <TextInput
                  style={[styles.enhancedInput, { height: 100, textAlignVertical: "top", backgroundColor: colors.bg, borderColor: colors.border }]}
                  placeholder="Provide detailed information about your issue..."
                  placeholderTextColor={colors.subtext}
                  multiline
                  value={newTicket.description}
                  onChangeText={(text) => setNewTicket({ ...newTicket, description: text })}
                />

                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Category</Text>
                <View style={styles.categorySelector}>
                  {['Technical', 'Billing', 'General', 'Feature Request'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        { backgroundColor: colors.bg, borderColor: colors.border },
                        newTicket.category === cat.toLowerCase() && styles.categoryOptionActive
                      ]}
                      onPress={() => setNewTicket({ ...newTicket, category: cat.toLowerCase() })}
                    >
                      <Text style={[styles.categoryOptionText, { color: colors.text }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Priority</Text>
                <View style={styles.prioritySelector}>
                  {["low", "medium", "high"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityOption,
                        { backgroundColor: colors.bg, borderColor: colors.border },
                        newTicket.priority === p && { borderColor: getPriorityColor(p), backgroundColor: getPriorityColor(p) + "15" }
                      ]}
                      onPress={() => setNewTicket({ ...newTicket, priority: p as any })}
                    >
                      <MaterialCommunityIcons
                        name={p === 'high' ? 'alert' : p === 'medium' ? 'alert-outline' : 'information'}
                        size={16}
                        color={newTicket.priority === p ? getPriorityColor(p) : colors.subtext}
                      />
                      <Text style={[styles.priorityOptionText, { color: newTicket.priority === p ? getPriorityColor(p) : colors.subtext }]}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.subtext }]}>Attachments</Text>
                <TouchableOpacity
                  style={[styles.attachArea, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  onPress={handleDocumentSelection}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
                  <Text style={[styles.attachText, { color: colors.text }]}>Upload Files</Text>
                  <Text style={[styles.attachSubtext, { color: colors.subtext }]}>PDF, Images up to 10MB</Text>
                  {attachments.length > 0 && (
                    <View style={styles.attachedFiles}>
                      <Text style={[styles.attachedFilesText, { color: colors.subtext }]}>
                        {attachments.length} file(s) attached
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setIsModalOpen(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.submitBtn]}
                    onPress={handleRaiseTicket}
                    disabled={raising}
                  >
                    {raising ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.submitBtnText}>Submit Ticket</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Enhanced Ticket Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.detailModalOverlay}>
          <BlurView intensity={80} style={styles.detailModalBlur}>
            <View style={[styles.detailModalContent, { backgroundColor: colors.card }]}>
              <View style={styles.detailModalHeader}>
                <Text style={[styles.detailModalTitle, { color: colors.text }]}>Ticket Details</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {selectedTicket && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.timelineContainer}>
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={[styles.timelineTitle, { color: colors.text }]}>Created</Text>
                        <Text style={[styles.timelineDate, { color: colors.subtext }]}>
                          {new Date(selectedTicket.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    {selectedTicket.status !== 'open' && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#6366f1' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineTitle, { color: colors.text }]}>In Progress</Text>
                          <Text style={[styles.timelineDate, { color: colors.subtext }]}>
                            {new Date(selectedTicket.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    )}
                    {selectedTicket.status === 'closed' && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineTitle, { color: colors.text }]}>Resolved</Text>
                          <Text style={[styles.timelineDate, { color: colors.subtext }]}>
                            {new Date(selectedTicket.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={[styles.detailInfo, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.detailLabel, { color: colors.subtext }]}>Ticket ID</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTicket._id}</Text>

                    <Text style={[styles.detailLabel, { color: colors.subtext, marginTop: 12 }]}>Description</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTicket.description}</Text>

                    {selectedTicket.assignedTo && (
                      <>
                        <Text style={[styles.detailLabel, { color: colors.subtext, marginTop: 12 }]}>Assigned To</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTicket.assignedTo.name}</Text>
                      </>
                    )}
                  </View>

                  <Text style={[styles.commentsTitle, { color: colors.text }]}>
                    <Ionicons name="chatbubbles" size={16} /> Comments ({selectedTicket.comments.length})
                  </Text>
                  {selectedTicket.comments.map((comment, idx) => (
                    <View key={idx} style={[styles.commentItem, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.commentUserName, { color: colors.accent }]}>{comment.user.name}</Text>
                      <Text style={[styles.commentTime, { color: colors.subtext }]}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </Text>
                      <Text style={[styles.commentMessage, { color: colors.text }]}>{comment.text}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
      {/* Profile Menu Dropdown */}
      <Modal visible={showProfileMenu} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setShowProfileMenu(false)}
        >
          <View style={[styles.profileMenu, { backgroundColor: colors.card, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.border }]}>
            <View style={styles.menuHeaderAlt}>
              <View style={[styles.largeAvatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.largeAvatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={[styles.menuName, { color: colors.text }]}>Hi, {user?.name}</Text>
                <Text style={[styles.menuEmail, { color: colors.subtext }]}>{user?.email}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setShowProfileMenu(false);
                setShowPasswordModal(true);
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: colors.border }]} 
              onPress={() => {
                setShowProfileMenu(false);
                logout();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, height: 'auto', paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              placeholder="Current Password"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              value={passForm.current}
              onChangeText={(t) => setPassForm({...passForm, current: t})}
            />
            <TextInput
              placeholder="New Password"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              value={passForm.new}
              onChangeText={(t) => setPassForm({...passForm, new: t})}
            />
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              value={passForm.confirm}
              onChangeText={(t) => setPassForm({...passForm, confirm: t})}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: colors.accent, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}
              onPress={handleChangePassword}
              disabled={passLoading}
            >
              {passLoading ? <ActivityIndicator color="#fff" /> : 
                <Text style={styles.submitBtnText}>Update Password</Text>
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
  content: { padding: 24, paddingTop: 60, paddingBottom: 100 },

  blurHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: 60, paddingBottom: 16, paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 14 },
  userName: { fontSize: 24, fontWeight: "800", marginTop: 2 },
  iconBtn: { backgroundColor: "#1e293b", padding: 10, borderRadius: 12, borderWidth: 1 },
  profileIconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  profileInitialText: { color: "#fff", fontSize: 18, fontWeight: "800" },


  notificationBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  notificationsPanel: { position: 'absolute', top: 110, right: 20, left: 20, borderRadius: 16, borderWidth: 1, maxHeight: 400, zIndex: 200, padding: 16 },
  notificationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  notificationsTitle: { fontSize: 16, fontWeight: 'bold' },
  noNotifications: { textAlign: 'center', padding: 20 },
  notificationItem: { flexDirection: 'row', padding: 12, borderRadius: 12, marginBottom: 8, gap: 12 },
  notificationDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  notificationMessage: { fontSize: 12, marginBottom: 2 },
  notificationTime: { fontSize: 10 },

  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1e1b4b", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#6366f1", marginBottom: 28 },
  rolePillText: { fontSize: 12, color: "#6366f1", fontWeight: "600" },

  analyticsSection: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  analyticsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyticsTitle: { fontSize: 16, fontWeight: '700' },
  periodSelector: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 12 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  periodBtnActive: { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
  periodBtnText: { fontSize: 11, fontWeight: '600' },
  chart: { marginVertical: 8, borderRadius: 16 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  kpiCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  kpiLabel: { fontSize: 11, marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },

  enhancedSearchSection: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
  searchMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  enhancedSearchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  voiceBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  filterChips: { marginBottom: 12 },
  chipsContainer: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  chipActive: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: '#6366f1' },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#6366f1' },
  advancedFiltersRow: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  filterOption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterOptionText: { fontSize: 11, fontWeight: '500' },

  filterScroll: { marginBottom: 20 },
  filterRowAlt: { flexDirection: "row", gap: 10, paddingRight: 20 },
  filterBtnAlt: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center' },
  filterTextAlt: { fontSize: 12, fontWeight: "700" },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  listContainer: {},
  gridCard: { width: '48%', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, position: 'relative' },
  ticketCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, position: 'relative' },
  priorityBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 },
  titleArea: { flex: 1 },
  ticketTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', gap: 4, alignItems: 'center' },
  priorityText: { fontSize: 8, fontWeight: "800" },
  categoryBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1e1b4b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontSize: 9, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', gap: 4, alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "800" },
  ticketDesc: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  progressContainer: { marginTop: 12 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, marginTop: 4 },
  replyBox: { marginTop: 12, padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#6366f1" },
  replyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  replyLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  replyText: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, fontWeight: "600" },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionIcon: { padding: 4 },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12 },
  commentCountText: { fontSize: 10, fontWeight: '600' },
  quickReplySection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  quickReplyInput: { flex: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 },
  sendReplyBtn: { padding: 8 },

  emptyCard: { borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, borderStyle: "dashed" },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  emptyActionBtn: { marginTop: 20, backgroundColor: "#6366f1", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyActionBtnText: { color: "#fff", fontWeight: "600" },

  raiseBtn: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#6366f1", borderRadius: 30, height: 56, paddingHorizontal: 24, justifyContent: "center", alignItems: "center", flexDirection: "row", shadowColor: "#6366f1", shadowRadius: 12, shadowOpacity: 0.5, elevation: 8 },
  raiseBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", marginLeft: 8 },

  modalOverlay: { flex: 1, justifyContent: "center", padding: 24 },
  modalBlur: { flex: 1, justifyContent: "center" },
  enhancedModalContent: { borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: "800" },
  inputLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  enhancedInput: { borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 8, borderWidth: 1 },
  categorySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryOptionActive: { borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  categoryOptionText: { fontSize: 13, fontWeight: '500' },
  prioritySelector: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  priorityOptionText: { fontSize: 12, fontWeight: "700" },
  attachArea: { borderStyle: "dashed", borderWidth: 2, borderRadius: 16, padding: 20, alignItems: "center", gap: 8, marginBottom: 20 },
  attachText: { fontSize: 14, fontWeight: "600" },
  attachSubtext: { fontSize: 11 },
  attachedFiles: { marginTop: 8 },
  attachedFilesText: { fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  cancelBtn: { backgroundColor: '#334155' },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
  submitBtn: { backgroundColor: '#6366f1' },
  submitBtnText: { color: '#fff', fontWeight: '700' },

  detailModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  detailModalBlur: { flex: 1, justifyContent: 'flex-end' },
  detailModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  detailModalTitle: { fontSize: 20, fontWeight: '800' },
  timelineContainer: { marginBottom: 20 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12, marginTop: 2 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  timelineDate: { fontSize: 12 },
  detailInfo: { borderRadius: 12, padding: 16, marginBottom: 20 },
  detailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  detailValue: { fontSize: 14 },
  commentsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  commentItem: { padding: 12, borderRadius: 12, marginBottom: 8 },
  commentUserName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  commentTime: { fontSize: 10, marginBottom: 4 },
  commentMessage: { fontSize: 13, lineHeight: 18 },

  // Profile Menu Styles
  menuOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 110, paddingRight: 20 },
  profileMenu: { borderRadius: 16, padding: 8, width: 220, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  menuHeaderAlt: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', marginBottom: 8 },
  largeAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  largeAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuName: { fontSize: 15, fontWeight: 'bold' },
  menuEmail: { fontSize: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 8 },
  menuItemText: { fontSize: 14, fontWeight: '600' },
  modalInput: { borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16, borderWidth: 1 },
});