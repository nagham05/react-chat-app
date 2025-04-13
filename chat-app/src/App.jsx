import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navlinks from "./components/Navlinks";
import ChatList from "./components/ChatList";
import ChatBox from "./components/ChatBox";
import Login from "./components/Login";
import Register from "./components/Register";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GroupProvider, useGroup } from "./context/GroupContext";
import ResetPassword from './components/ResetPassword';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  return children;
};

const AppContent = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const { groups } = useGroup();

  // Check if the selected group still exists in the user's groups
  useEffect(() => {
    if (selectedGroup && groups.length > 0) {
      const groupExists = groups.some(group => group.id === selectedGroup.id);
      if (!groupExists) {
        setSelectedGroup(null);
      }
    }
  }, [groups, selectedGroup]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSelectedGroup(null); // Clear selected group when selecting a user
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Navlinks />
      <ChatList 
        setSelectedUser={setSelectedUser} 
        setSelectedGroup={setSelectedGroup}
      />
      <ChatBox 
        selectedUser={selectedUser} 
        selectedGroup={selectedGroup}
        onSelectUser={handleUserSelect}
      />
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <GroupProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </GroupProvider>
    </AuthProvider>
  );
};

export default App;
