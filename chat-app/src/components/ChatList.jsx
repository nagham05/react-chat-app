import React, { useState, useEffect } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiMore2Fill } from "react-icons/ri";
import SearchModal from "./SearchModal";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, getDocs, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import EditProfile from './EditProfile';

const ChatList = ({ setSelectedUser }) => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexError, setIndexError] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // First, get all messages where the current user is either sender or receiver
    const messagesRef = collection(db, 'Messages');
    const messagesQuery = query(
      messagesRef,
      where('senderId', '==', currentUser.uid),
      orderBy('sentAt', 'desc')
    );

    const messagesQuery2 = query(
      messagesRef,
      where('receiverId', '==', currentUser.uid),
      orderBy('sentAt', 'desc')
    );

    const unsubscribe1 = onSnapshot(messagesQuery, async (snapshot) => {
      try {
        const sentMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Get unique receiver IDs from sent messages
        const receiverIds = [...new Set(sentMessages.map(msg => msg.receiverId))];
        
        // Fetch user details for each receiver
        const userPromises = receiverIds.map(async (userId) => {
          const userDoc = await getDocs(query(collection(db, 'Users'), where('uid', '==', userId)));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            const lastMessage = sentMessages.find(msg => msg.receiverId === userId);
            return {
              id: userId,
              ...userData,
              lastMessage: lastMessage?.content || '',
              lastMessageTime: lastMessage?.sentAt || null,
              messageType: lastMessage?.type || 'text'
            };
          }
        });

        const sentChats = (await Promise.all(userPromises)).filter(Boolean);
        setChats(prevChats => {
          const newChats = [...prevChats];
          sentChats.forEach(chat => {
            const existingIndex = newChats.findIndex(c => c.id === chat.id);
            if (existingIndex >= 0) {
              newChats[existingIndex] = chat;
            } else {
              newChats.push(chat);
            }
          });
          return newChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        });
        setIndexError(false);
      } catch (err) {
        console.error('Error processing sent messages:', err);
        if (err.code === 'failed-precondition') {
          setIndexError(true);
        } else {
          setError('Failed to load chats');
        }
      }
    });

    const unsubscribe2 = onSnapshot(messagesQuery2, async (snapshot) => {
      try {
        const receivedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Get unique sender IDs from received messages
        const senderIds = [...new Set(receivedMessages.map(msg => msg.senderId))];
        
        // Fetch user details for each sender
        const userPromises = senderIds.map(async (userId) => {
          const userDoc = await getDocs(query(collection(db, 'Users'), where('uid', '==', userId)));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            const lastMessage = receivedMessages.find(msg => msg.senderId === userId);
            return {
              id: userId,
              ...userData,
              lastMessage: lastMessage?.content || '',
              lastMessageTime: lastMessage?.sentAt || null,
              messageType: lastMessage?.type || 'text'
            };
          }
        });

        const receivedChats = (await Promise.all(userPromises)).filter(Boolean);
        setChats(prevChats => {
          const newChats = [...prevChats];
          receivedChats.forEach(chat => {
            const existingIndex = newChats.findIndex(c => c.id === chat.id);
            if (existingIndex >= 0) {
              newChats[existingIndex] = chat;
            } else {
              newChats.push(chat);
            }
          });
          return newChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        });
        setIndexError(false);
      } catch (err) {
        console.error('Error processing received messages:', err);
        if (err.code === 'failed-precondition') {
          setIndexError(true);
        } else {
          setError('Failed to load chats');
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [currentUser]);

  const startChat = (chatUser) => {
    setSelectedUser(chatUser);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <section className="relative hidden lg:flex flex-col item-start justify-start bg-white h-screen w-[300px] border-r border-[#9090902c] flex-shrink-0">
      <header className="flex items-center justify-between w-[100%] lg:border-b border-b-1 border-[#898989b9] p-4 sticky md:static top-0 z-[100] border-r border-[#9090902c]">
        <main className="flex items-center gap-3">
          <img 
            src={currentUser?.profile_pic || defaultAvatar} 
            className="w-[44px] h-[44px] object-cover rounded-full" 
            alt={currentUser?.name} 
          />
          <span>
            <h3 className="p-0 font-semibold text-[#2A3D39] md:text-[17px]">{currentUser?.name}</h3>
            <p className="p-0 font-light text-[#2A3D39] text-[15px]">{currentUser?.email}</p>
          </span>
        </main>
        <button 
          className="bg-[#D9F2ED] w-[35px] h-[35px] p-2 flex items-center justify-center rounded-lg"
          onClick={() => setShowEditProfile(true)}
        >
          <RiMore2Fill color="#01AA85" className="w-[28px] h-[28px]" />
        </button>
      </header>

      <div className="w-[100%] mt-[10px] px-5">
        <header className="flex items-center justify-between">
          <h3 className="text-[16px]">Messages ({chats.length})</h3>
          <SearchModal startChat={startChat} />
        </header>
      </div>

      <main className="flex flex-col items-start mt-[1.5rem] pb-3 custom-scrollbar w-[100%] h-[100%]">
        {loading ? (
          <div className="w-full text-center py-4">Loading...</div>
        ) : indexError ? (
          <div className="w-full text-center py-4">
            <p className="text-red-500 mb-2">Setting up database indexes...</p>
            <p className="text-sm text-gray-500">This may take a few minutes. Please refresh the page later.</p>
          </div>
        ) : error ? (
          <div className="w-full text-center py-4 text-red-500">{error}</div>
        ) : chats.length === 0 ? (
          <div className="w-full text-center py-4 text-gray-500">No chats yet</div>
        ) : (
          chats.map((chat) => (
            <button 
              key={chat.id} 
              className="flex items-start justify-between w-[100%] border-b border-[#9090902c] px-5 pb-3 pt-3 hover:bg-gray-50"
              onClick={() => startChat(chat)}
            >
              <div className="flex items-start gap-2">
                <img 
                  src={chat.profile_pic || defaultAvatar} 
                  className="h-[40px] w-[40px] rounded-full object-cover" 
                  alt={chat.name} 
                />
                <span>
                  <h2 className="p-0 font-semibold text-[#2A3d39] text-left text-[17px]">{chat.name}</h2>
                  <p className="p-0 font-light text-[#2A3d39] text-left text-[14px]">
                    {chat.messageType === 'text' ? chat.lastMessage : 'Shared a file'}
                  </p>
                </span>
              </div>
              <p className="p-0 font-regular text-gray-400 text-left text-[11px]">
                {formatTimestamp(chat.lastMessageTime)}
              </p>
            </button>
          ))
        )}
      </main>

      {showEditProfile && (
        <EditProfile onClose={() => setShowEditProfile(false)} />
      )}
    </section>
  );
};

export default ChatList;
