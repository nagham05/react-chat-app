import React from "react";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";

const MainLayout = ({ selectedUser, setSelectedUser }) => {
    return (
        <div className="flex flex-col lg:flex-row h-screen">
            <ChatList setSelectedUser={setSelectedUser} />
            <ChatBox selectedUser={selectedUser} />
        </div>
    );
};

export default MainLayout; 