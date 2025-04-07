import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navlinks from "./components/Navlinks";
import ChatList from "./components/ChatList";
import ChatBox from "./components/ChatBox";
import Login from "./components/Login";
import Register from "./components/Register";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GroupProvider } from "./context/GroupContext";
import ResetPassword from './components/ResetPassword';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  return children;
};

const App = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

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
                  <div className="flex h-screen w-full overflow-hidden">
                    <Navlinks />
                    <ChatList 
                      setSelectedUser={setSelectedUser} 
                      setSelectedGroup={setSelectedGroup}
                    />
                    <ChatBox 
                      selectedUser={selectedUser} 
                      selectedGroup={selectedGroup}
                    />
                  </div>
                </ProtectedRoute>
              }
            />
            
            <Route path="/"  element={<Login />} />
          </Routes>
        </Router>
      </GroupProvider>
    </AuthProvider>
  );
};

export default App;
