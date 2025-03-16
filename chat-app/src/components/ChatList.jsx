import React, { useState } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiMore2Fill } from "react-icons/ri";
import SearchModal from "./SearchModal";

const Chatlist = ({ setSelectedUser }) => {
  const [user] = useState({
    fullName: "User User",
    username: "user",
    image: defaultAvatar,
  });

  const sampleChats = [
    {
      id: 1,
      lastMessage: "Hello! How are you?",
      lastMessageTimestamp: new Date(),
      users: [{ fullName: "John Doe", image: defaultAvatar }],
    },
    {
      id: 2,
      lastMessage: "See you tomorrow!",
      lastMessageTimestamp: new Date(),
      users: [{ fullName: "Jane Smith", image: defaultAvatar }],
    },
  ];

  const startChat = (chatUser) => {
    setSelectedUser(chatUser);
  };

  return (
    <section className="relative hidden lg:flex flex-col item-start justify-start bg-white h-screen w-[300px] border-r border-[#9090902c] flex-shrink-0">
      <header className="flex items-center justify-between w-[100%] lg:border-b border-b-1 border-[#898989b9] p-4 sticky md:static top-0 z-[100] border-r border-[#9090902c]">
        <main className="flex items-center gap-3">
          <img src={user.image} className="w-[44px] h-[44px] object-cover rounded-full" alt="" />
          <span>
            <h3 className="p-0 font-semibold text-[#2A3D39] md:text-[17px]">{user.fullName}</h3>
            <p className="p-0 font-light text-[#2A3D39] text-[15px]">@{user.username}</p>
          </span>
        </main>
        <button className="bg-[#D9F2ED] w-[35px] h-[35px] p-2 flex items-center justify-center rounded-lg">
          <RiMore2Fill color="#01AA85" className="w-[28px] h-[28px]" />
        </button>
      </header>

      <div className="w-[100%] mt-[10px] px-5">
        <header className="flex items-center justify-between">
          <h3 className="text-[16px]">Messages ({sampleChats.length})</h3>
          <SearchModal startChat={startChat} />
        </header>
      </div>

      <main className="flex flex-col items-start mt-[1.5rem] pb-3 custom-scrollbar w-[100%] h-[100%]">
        {sampleChats.map((chat) => (
          <button key={chat.id} className="flex items-start justify-between w-[100%] border-b border-[#9090902c] px-5 pb-3 pt-3">
            <div className="flex items-start gap-2" onClick={() => startChat(chat.users[0])}>
              <img src={chat.users[0].image} className="h-[40px] w-[40px] rounded-full object-cover" alt="" />
              <span>
                <h2 className="p-0 font-semibold text-[#2A3d39] text-left text-[17px]">{chat.users[0].fullName}</h2>
                <p className="p-0 font-light text-[#2A3d39] text-left text-[14px]">{chat.lastMessage}</p>
              </span>
            </div>
            <p className="p-0 font-regular text-gray-400 text-left text-[11px]">Just now</p>
          </button>
        ))}
      </main>
    </section>
  );
};

export default Chatlist;
