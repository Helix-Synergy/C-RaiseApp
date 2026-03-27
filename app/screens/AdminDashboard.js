// screens/AdminDashboard.js
import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import axios from "axios";

const AdminDashboard = ({ route }) => {
  const { companyId, companyName } = route.params;
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(`https://c-raise-backend.onrender.com/api/users?companyId=${companyId}`);
        setEmployees(res.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{companyName} Admin Dashboard</Text>
      <FlatList
        data={employees}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <Text>{item.name} - {item.email}</Text>}
      />
    </View>
  );
};

export default AdminDashboard;