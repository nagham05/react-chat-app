import React, { useState, useEffect, useMemo } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiMore2Fill } from "react-icons/ri";
import { FaUsers, FaPlus, FaBan } from "react-icons/fa";
import SearchModal from "./SearchModal";
import { useAuth } from "../context/AuthContext";
import { useGroup } from "../context/GroupContext";
import { collection, query, where, getDocs, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import EditProfile from './EditProfile';
import GroupModal from './GroupModal';

const ChatList = ({ setSelectedUser, setSelectedGroup }) => {
  const { currentUser } = useAuth();
  const { groups, getGroups, indexError: groupIndexError } = useGroup();
  const [directChats, setDirectChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexError, setIndexError] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [blockedUsers, setBlockedUsers] = useState(new Set());

  // Effect to track blocked users in real-time
  useEffect(() => {
    if (!currentUser) return;

    const blockedRef = collection(db, 'Blocked');
    const blockedQuery = query(
      blockedRef,
      where('blockerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(blockedQuery, (snapshot) => {
      const blockedIds = new Set();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        blockedIds.add(data.blockedId);
      });
      setBlockedUsers(blockedIds);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Effect to fetch groups
  useEffect(() => {
    if (!currentUser) return;
    getGroups();
  }, [currentUser, getGroups]);

  // Effect to fetch direct chats
  useEffect(() => {
    if (!currentUser) return;

    // Create a map to track unique chats by user ID
    const uniqueChatsMap = new Map();
    
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
              messageType: lastMessage?.type || 'text',
              isGroup: false,
              isBlocked: blockedUsers.has(userId)
            };
          }
        });

        const sentChats = (await Promise.all(userPromises)).filter(Boolean);
        
        // Update the unique chats map with sent messages
        sentChats.forEach(chat => {
          uniqueChatsMap.set(chat.id, chat);
        });
        
        // Convert map to array and sort by last message time
        const updatedChats = Array.from(uniqueChatsMap.values())
          .sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
        
        setDirectChats(updatedChats);
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
              messageType: lastMessage?.type || 'text',
              isGroup: false,
              isBlocked: blockedUsers.has(userId)
            };
          }
        });

        const receivedChats = (await Promise.all(userPromises)).filter(Boolean);
        
        // Update the unique chats map with received messages
        receivedChats.forEach(chat => {
          uniqueChatsMap.set(chat.id, chat);
        });
        
        // Convert map to array and sort by last message time
        const updatedChats = Array.from(uniqueChatsMap.values())
          .sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
        
        setDirectChats(updatedChats);
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
  }, [currentUser, blockedUsers]);

  // Effect to track unread messages
  useEffect(() => {
    if (!currentUser) return;

    const messagesRef = collection(db, 'Messages');
    const unreadQuery = query(
      messagesRef,
      where('receiverId', '==', currentUser.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(unreadQuery, (snapshot) => {
      const counts = {};
      snapshot.docs.forEach(doc => {
        const message = doc.data();
        const senderId = message.senderId;
        counts[senderId] = (counts[senderId] || 0) + 1;
      });
      setUnreadCounts(counts);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Combine direct chats and group chats
  const allChats = useMemo(() => {
    const uniqueChatsMap = new Map();
    
    // Add direct chats to the map
    directChats.forEach(chat => {
      uniqueChatsMap.set(chat.id, chat);
    });

    // Add group chats to the map
    groups.forEach(group => {
      // Ensure lastMessageTime is a proper Date object for sorting
      const lastMessageTime = group.lastMessageTime 
        ? (group.lastMessageTime instanceof Date 
            ? group.lastMessageTime 
            : new Date(group.lastMessageTime))
        : null;
        
      uniqueChatsMap.set(`group_${group.id}`, {
        id: group.id,
        name: group.name,
        lastMessage: group.lastMessage || '',
        lastMessageTime: lastMessageTime,
        messageType: group.lastMessageType || 'text',
        isGroup: true,
        members: group.members,
        creator: group.creator,
        admins: group.admins
      });
    });

    // Convert map to array and sort by last message time
    return Array.from(uniqueChatsMap.values())
      .sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime) : new Date(0);
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime) : new Date(0);
        return timeB - timeA;
      });
  }, [directChats, groups]);

  const handleCreateGroup = () => {
    setGroupToEdit(null);
    setShowGroupModal(true);
  };

  const handleEditGroup = (group) => {
    setGroupToEdit(group);
    setShowGroupModal(true);
  };

  const startChat = (chat) => {
    if (chat.isGroup) {
      setSelectedGroup(chat);
      setSelectedUser(null);
    } else {
      setSelectedUser(chat);
      setSelectedGroup(null);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    // Handle Firestore Timestamp
    if (timestamp?.toDate) {
      const date = timestamp.toDate();
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return date.toLocaleDateString();
    }
    
    // Handle regular Date object or timestamp
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Just now';
    
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
          <h3 className="text-[16px]">Messages ({allChats.length})</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              className="bg-[#D9F2ED] w-[35px] h-[35px] p-2 flex items-center justify-center rounded-lg"
              title="Create Group"
            >
              <FaPlus color="#01AA85" className="w-[20px] h-[20px]" />
            </button>
          <SearchModal startChat={startChat} />
          </div>
        </header>
      </div>

      <main className="flex flex-col items-start mt-[1.5rem] pb-3 custom-scrollbar w-[100%] h-[100%]">
        {loading ? (
          <div className="w-full text-center py-4">Loading...</div>
        ) : error ? (
          <div className="w-full text-center py-4 text-red-500">{error}</div>
        ) : (indexError || groupIndexError) ? (
          <div className="w-full text-center py-4">
            <p className="text-red-500 mb-2">Setting up database indexes...</p>
            <p className="text-sm text-gray-500">This may take a few minutes. Please refresh the page later.</p>
          </div>
        ) : allChats.length === 0 ? (
          <div className="w-full text-center py-4 text-gray-500">No chats yet</div>
        ) : (
          allChats.map((chat) => (
            <button 
              key={chat.isGroup ? `group_${chat.id}` : chat.id} 
              className="flex items-start justify-between w-[100%] border-b border-[#9090902c] px-5 pb-3 pt-3 hover:bg-gray-50 relative"
              onClick={() => startChat(chat)}
              onContextMenu={(e) => {
                if (chat.isGroup) {
                  e.preventDefault();
                  handleEditGroup(chat);
                }
              }}
            >
              <div className="flex items-start gap-2">
                {chat.isGroup ? (
                  <div className="h-[40px] w-[40px] rounded-full bg-[#D9F2ED] flex items-center justify-center">
                    <FaUsers color="#01AA85" className="w-[20px] h-[20px]" />
                  </div>
                ) : (
                  <img 
                    src={chat.profile_pic || defaultAvatar} 
                    className="h-[40px] w-[40px] rounded-full object-cover" 
                    alt={chat.name} 
                  />
                )}
                <span>
                  <div className="flex items-center">
                    <h2 className="p-0 font-semibold text-[#2A3d39] text-left text-[17px]">{chat.name}</h2>
                    {!chat.isGroup && blockedUsers.has(chat.id) && (
                      <FaBan className="text-red-500 ml-2" title="Blocked User" />
                    )}
                  </div>
                  <p className="p-0 font-light text-[#2A3d39] text-left text-[14px]">
                    {chat.isGroup ? (
              <span>
                        {chat.lastMessageSender ? `${chat.lastMessageSender}: ` : ''}
                        {chat.messageType === 'text' ? chat.lastMessage : 'Shared a file'}
                      </span>
                    ) : (
                      chat.messageType === 'text' ? chat.lastMessage : 'Shared a file'
                    )}
                  </p>
              </span>
            </div>
              <div className="flex flex-col items-end">
                <p className="p-0 font-regular text-gray-400 text-left text-[11px]">
                  {formatTimestamp(chat.lastMessageTime)}
                </p>
                {!chat.isGroup && unreadCounts[chat.id] > 0 && (
                  <span className="bg-[#01AA85] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1">
                    {unreadCounts[chat.id]}
                  </span>
                )}
              </div>
          </button>
          ))
        )}
      </main>

      {showEditProfile && (
        <EditProfile onClose={() => setShowEditProfile(false)} />
      )}

      {showGroupModal && (
        <GroupModal
          isOpen={showGroupModal}
          onClose={() => {
            setShowGroupModal(false);
            setGroupToEdit(null);
          }}
          group={groupToEdit}
          mode={groupToEdit ? "edit" : "create"}
        />
      )}
    </section>
  );
};

export default ChatList;
