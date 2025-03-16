import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navlinks from "./components/Navlinks";
import ChatList from "./components/ChatList";
import ChatBox from "./components/ChatBox";
import Login from "./components/Login";
import Register from "./components/Register";

const App = () => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/chat"
          element={
            <div className="flex h-screen w-full overflow-hidden">
              <Navlinks />
              <ChatList setSelectedUser={setSelectedUser} />
              <ChatBox selectedUser={selectedUser} />
            </div>
          }
        />
        
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
};

export default App;
