import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiSendPlaneFill, RiImageAddFill, RiCloseFill, RiMore2Fill, RiUserUnfollowFill, RiUserFollowFill, RiEmotionLine, RiImageLine, RiFileLine, RiSearchLine, RiGroupLine, RiSettings4Line, RiEditLine, RiDeleteBinLine } from "react-icons/ri";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { useGroup } from "../context/GroupContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, getDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import supabase from "../supabase";
import ConfirmationModal from "./ConfirmationModal";
import MessageContextMenu from './MessageContextMenu';
import EmojiPicker from 'emoji-picker-react';
import GroupModal from './GroupModal';
import { FaSignOutAlt } from 'react-icons/fa';

const ChatBox = ({ selectedUser, selectedGroup, onSelectUser }) => {
    const { currentUser, sendMessage, uploadFile, blockUser, unblockUser, removeReaction, addReaction, markMessageAsRead, getUnreadCount, startChat } = useAuth();
    const { sendGroupMessage, getGroupMessages, deleteGroupMessage, editGroupMessage, addGroupReaction, removeGroupReaction, leaveGroup } = useGroup();
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showUnblockModal, setShowUnblockModal] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockStatus, setBlockStatus] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showContactDetails, setShowContactDetails] = useState(false);
    const [sharedMedia, setSharedMedia] = useState([]);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [showAllMedia, setShowAllMedia] = useState(false);
    const [showMediaModal, setShowMediaModal] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [selectedMember, setSelectedMember] = useState(null);
    const [showChatConfirmation, setShowChatConfirmation] = useState(false);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const menuRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Determine if we're in a group chat
    const isGroupChat = !!selectedGroup;

    // Fetch group members when selectedGroup changes
    useEffect(() => {
        const fetchGroupMembers = async () => {
            if (!selectedGroup?.members?.length) return;
            
            try {
                const membersData = await Promise.all(
                    selectedGroup.members.map(async (memberId) => {
                        const userDoc = await getDoc(doc(db, 'Users', memberId));
                        if (userDoc.exists()) {
                            return {
                                uid: memberId,
                                ...userDoc.data()
                            };
                        }
                        return null;
                    })
                );
                
                setGroupMembers(membersData.filter(member => member !== null));
            } catch (error) {
                console.error('Error fetching group members:', error);
            }
        };

        fetchGroupMembers();
    }, [selectedGroup]);

    // Fetch messages
    useEffect(() => {
        if (!currentUser) return;

        let unsubscribe = () => {};

        if (selectedGroup) {
            // Fetch group messages
            const messagesRef = collection(db, 'Groups', selectedGroup.id, 'Messages');
            const q = query(messagesRef, orderBy('sentAt', 'asc'));
            
            unsubscribe = onSnapshot(q, (snapshot) => {
                const newMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(newMessages);
            });
        } else if (selectedUser) {
            // Fetch direct messages
            const messagesRef = collection(db, 'Messages');
            const q = query(
                messagesRef,
                where('senderId', 'in', [currentUser.uid, selectedUser.id]),
                where('receiverId', 'in', [currentUser.uid, selectedUser.id]),
                orderBy('sentAt', 'asc')
            );
            
            unsubscribe = onSnapshot(q, (snapshot) => {
                const newMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(newMessages);
            });
        } else {
            // Fetch all messages when no group or user is selected
            const messagesRef = collection(db, 'Messages');
            const q = query(
                messagesRef,
                where('senderId', '==', currentUser.uid),
                orderBy('sentAt', 'asc')
            );
            
            unsubscribe = onSnapshot(q, (snapshot) => {
                const newMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(newMessages);
            });
        }

        return () => unsubscribe();
    }, [currentUser, selectedGroup, selectedUser]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const getFileType = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return 'image';
        }
        return 'file';
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!messageText.trim() && !selectedFile) {
            return;
        }

        try {
            setLoading(true);
            let fileUrl = null;
            let messageType = 'text';
            let fileName = null;
            let content = messageText;

            if (selectedFile) {
                fileUrl = await uploadFile(selectedFile);
                messageType = getFileType(selectedFile.name);
                fileName = selectedFile.name;
                content = fileUrl;
            }

            if (isGroupChat) {
                // Send message to group
                await sendGroupMessage(
                    selectedGroup.id,
                    content,
                    messageType,
                    fileUrl,
                    fileName
                );
            } else {
                // Send direct message
                await sendMessage(
                    content,
                    selectedUser.id,
                    messageType,
                    fileUrl,
                    fileName
                );
            }

            // Clear input fields immediately
            setMessageText("");
            setSelectedFile(null);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        
        // Handle Firestore Timestamp
        if (timestamp?.toDate) {
            return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Handle regular Date object or timestamp
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return ''; // Invalid date
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleFileClick = (fileUrl) => {
        window.open(fileUrl);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    // Filter messages based on whether it's a group or direct chat
    const filteredMessages = useMemo(() => {
        if (selectedGroup) {
            // For group chats
            return messages.filter(msg => msg.groupId === selectedGroup.id);
        } else if (selectedUser) {
            // For direct messages
            return messages.filter(msg => 
                (msg.senderId === currentUser.uid && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
            );
        }
        return messages; // Return all messages if neither group nor user is selected
    }, [messages, selectedGroup, selectedUser, currentUser.uid]);

    const handleMessageDoubleClick = (e, message) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const menuWidth = 200; // Approximate width of the context menu
        const windowWidth = window.innerWidth;
        
        // Calculate position to ensure menu is visible
        let left = rect.left;
        if (left + menuWidth > windowWidth) {
            left = windowWidth - menuWidth - 10; // Add some padding from the window edge
        }
        
        setContextMenu({
            message,
            position: {
                x: left,
                y: rect.top
            }
        });
    };

    const handleContextMenuClose = () => {
        setContextMenu(null);
    };

    const updateMessageInState = (messageId, updates) => {
        setMessages(prevMessages => {
            if (updates.deleted) {
                // Remove the message from the array if it's deleted
                return prevMessages.filter(msg => msg.id !== messageId);
            }
            // Otherwise update the message properties
            return prevMessages.map(msg => 
                msg.id === messageId ? { ...msg, ...updates } : msg
            );
        });
    };

    const handleReactionClick = async (message, reaction) => {
        try {
            if (isGroupChat) {
                // For group messages, use the group reaction functions
                if (message.reactions?.[reaction]?.includes(currentUser.uid)) {
                    await removeGroupReaction(selectedGroup.id, message.id, reaction);
                } else {
                    await addGroupReaction(selectedGroup.id, message.id, reaction);
                }
            } else {
                // For direct messages, check if the reaction exists and has users array
                const hasReacted = message.reactions?.[reaction]?.users?.includes(currentUser.uid);
                if (hasReacted) {
                    await removeReaction(message.id, reaction);
                } else {
                    await addReaction(message.id, reaction);
                }
            }
        } catch (error) {
            console.error('Error handling reaction:', error);
        }
    };

    // Update unread count when messages change
    useEffect(() => {
        const updateUnreadCount = async () => {
            if (selectedUser?.id) {
                const count = await getUnreadCount(selectedUser.id);
                setUnreadCount(count);
            }
        };
        updateUnreadCount();
    }, [selectedUser, messages]);

    // Mark messages as read when they are viewed
    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (!selectedUser?.id || !currentUser?.uid) return;

            const unreadMessages = messages.filter(
                msg => msg.receiverId === currentUser.uid && !msg.read
            );

            for (const message of unreadMessages) {
                await markMessageAsRead(message.id);
            }
        };

        markMessagesAsRead();
    }, [messages, selectedUser, currentUser]);

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setCurrentSearchIndex(-1);
            return;
        }

        const results = messages.filter(message => 
            message.type === 'text' && 
            message.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);
        
        if (results.length > 0) {
            // Scroll to the first result
            const messageElement = document.getElementById(`message-${results[0].id}`);
            if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                messageElement.classList.add('highlight');
                setTimeout(() => {
                    messageElement.classList.remove('highlight');
                }, 2000);
            }
        }
    };

    const navigateSearchResults = (direction) => {
        if (searchResults.length === 0) return;
        
        // Remove highlight from current result
        if (currentSearchIndex >= 0) {
            const currentElement = document.getElementById(`message-${searchResults[currentSearchIndex].id}`);
            if (currentElement) {
                currentElement.classList.remove('highlight');
            }
        }
        
        // Calculate new index
        let newIndex;
        if (direction === 'next') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
        }
        
        setCurrentSearchIndex(newIndex);
        
        // Highlight and scroll to new result
        const messageElement = document.getElementById(`message-${searchResults[newIndex].id}`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight');
            setTimeout(() => {
                messageElement.classList.remove('highlight');
            }, 2000);
        }
    };

    const renderMessageContent = (message) => {
        // Don't render deleted messages
        if (message.deleted) return null;

        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            
            // Handle Firestore Timestamp
            if (timestamp?.toDate) {
                return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            // Handle regular Date object or timestamp
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return ''; // Invalid date
            
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const isMessageRead = message.read && message.readAt;
        const showReadReceipt = message.senderId === currentUser.uid;
        const isSearchResult = searchResults.some(result => result.id === message.id);
        const isCurrentResult = currentSearchIndex >= 0 && searchResults[currentSearchIndex]?.id === message.id;

        if (message.type === 'system') {
            return (
                <div className="flex justify-center w-full my-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">
                        {message.content}
                    </div>
                </div>
            );
        }

        return (
            <div
                id={`message-${message.id}`}
                className={`p-3 rounded-lg max-w-[70%] ${
                    message.senderId === currentUser.uid
                        ? 'bg-[#01AA85] text-white ml-auto'
                        : 'bg-gray-100 text-gray-800'
                } ${isSearchResult ? 'border-2 border-yellow-400' : ''} ${isCurrentResult ? 'highlight' : ''}`}
                onDoubleClick={(e) => handleMessageDoubleClick(e, message)}
            >
                {isGroupChat && message.senderId !== currentUser.uid && (
                    <div className="text-xs font-semibold mb-1 text-[#01AA85]">
                        {message.senderName || 'Unknown User'}
                    </div>
                )}
                
                {message.type === 'text' && (
                    <div>
                        <p>{message.content}</p>
                        {message.edited && (
                            <span className="text-xs opacity-70">(edited)</span>
                        )}
                    </div>
                )}
                
                {message.type === 'image' && (
                    <div className="relative">
                        <img 
                            src={message.content} 
                            alt="Shared image" 
                            className="max-h-[300px] w-auto rounded-lg cursor-pointer object-contain"
                            onClick={() => window.open(message.content, '_blank')}
                        />
                    </div>
                )}
                
                {message.type === 'file' && (
                    <div className="flex items-center gap-2">
                        <span>{message.fileName}</span>
                        <a
                            href={message.content}
                            download
                            className="text-[#01AA85] hover:text-[#018a6d]"
                        >
                            Download
                        </a>
                    </div>
                )}
                
                {/* Reactions */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {Object.entries(message.reactions).map(([reaction, users]) => (
                            <button
                                key={reaction}
                                onClick={() => handleReactionClick(message, reaction)}
                                className="text-xs bg-white/20 px-1 rounded hover:bg-white/30 transition-colors"
                            >
                                {reaction} {users.length}
                            </button>
                        ))}
                    </div>
                )}
                
                <div className="flex items-center justify-end gap-1 mt-1">
                    <div className="text-xs opacity-70">
                        {formatTime(message.sentAt)}
                    </div>
                    {showReadReceipt && (
                        <div className="text-xs opacity-70">
                            {isMessageRead ? '✓✓' : '✓'}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Update the block status check
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!selectedUser?.id || !currentUser?.uid) return;
            
            try {
                const blockedRef = collection(db, 'Blocked');
                // Check if current user blocked the selected user
                const blockerQuery = query(
                    blockedRef,
                    where('blockerId', '==', currentUser.uid),
                    where('blockedId', '==', selectedUser.id)
                );
                const blockerSnapshot = await getDocs(blockerQuery);

                // Check if selected user blocked the current user
                const blockedQuery = query(
                    blockedRef,
                    where('blockerId', '==', selectedUser.id),
                    where('blockedId', '==', currentUser.uid)
                );
                const blockedSnapshot = await getDocs(blockedQuery);

                if (!blockerSnapshot.empty) {
                    setBlockStatus('blocked');
                    setIsBlocked(true);
                } else if (!blockedSnapshot.empty) {
                    setBlockStatus('blockedBy');
                    setIsBlocked(true);
                } else {
                    setBlockStatus(null);
                    setIsBlocked(false);
                }
            } catch (error) {
                console.error('Error checking block status:', error);
            }
        };

        checkBlockStatus();
    }, [selectedUser, currentUser.uid]);

    const handleBlockUser = async () => {
        try {
            await blockUser(selectedUser.id);
            setShowBlockModal(false);
            setShowMenu(false);
            setIsBlocked(true);
        } catch (error) {
            console.error('Error blocking user:', error);
        }
    };

    const handleUnblockUser = async () => {
        try {
            await unblockUser(selectedUser.id);
            setShowUnblockModal(false);
            setShowMenu(false);
            setIsBlocked(false);
        } catch (error) {
            console.error('Error unblocking user:', error);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onEmojiClick = (emojiObject) => {
        setMessageText(prevText => prevText + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    // Add click outside handler for emoji picker
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extract shared media from messages
    useEffect(() => {
        if (!messages.length) return;
        
        const mediaMessages = messages.filter(msg => 
            msg.type === 'image' || msg.type === 'file'
        );
        
        setSharedMedia(mediaMessages);
    }, [messages]);

    const handleMediaClick = (media) => {
        if (media.type === 'file') {
            // Open file directly in a new tab
            window.open(media.content, '_blank');
        } else {
            // For images, show in the modal
            setSelectedMedia(media);
        }
    };

    const closeMediaViewer = () => {
        setSelectedMedia(null);
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            // Get the current deletedMessageIds from localStorage
            const storedDeletedIds = JSON.parse(localStorage.getItem('deletedMessageIds') || '[]');
            
            // Add the new message ID to the array if it's not already there
            if (!storedDeletedIds.includes(messageId)) {
                const updatedDeletedIds = [...storedDeletedIds, messageId];
                localStorage.setItem('deletedMessageIds', JSON.stringify(updatedDeletedIds));
                
                // Update the state to reflect the change
                setMessages(prevMessages => 
                    prevMessages.map(msg => 
                        msg.id === messageId ? { ...msg, deleted: true } : msg
                    )
                );
                
                console.log(`Message ${messageId} marked as deleted`);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const handleReactToMessage = (messageId, reaction) => {
        // This function will be implemented later for message reactions
        console.log(`Reacting to message ${messageId} with ${reaction}`);
    };

    const handleMessageUpdate = async (messageId, newContent) => {
        try {
            if (selectedGroup) {
                await editGroupMessage(selectedGroup.id, messageId, newContent);
            } else if (selectedUser) {
                // Handle direct message editing
                const messagesRef = collection(db, 'Messages');
                await updateDoc(doc(messagesRef, messageId), {
                    content: newContent,
                    edited: true,
                    editedAt: serverTimestamp()
                });
            }
            // Update the message in the local state
            setMessages(prevMessages => 
                prevMessages.map(msg => 
                    msg.id === messageId 
                        ? { ...msg, content: newContent, edited: true, editedAt: new Date() }
                        : msg
                )
            );
        } catch (error) {
            console.error('Error updating message:', error);
        }
    };

    const filteredMembers = useMemo(() => {
        if (!memberSearchQuery) return groupMembers;
        return groupMembers.filter(member => 
            member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
        );
    }, [groupMembers, memberSearchQuery]);

    const handleMemberClick = (member) => {
        if (member.uid === currentUser.uid) return;
        setSelectedMember(member);
        setShowChatConfirmation(true);
    };

    const handleOpenChat = () => {
        if (selectedMember) {
            // Format the member data to match the expected user structure
            const userData = {
                id: selectedMember.uid,
                name: selectedMember.name,
                email: selectedMember.email,
                profile_pic: selectedMember.profile_pic,
                bio: selectedMember.bio
            };
            
            // Close the members modal and confirmation modal
            setShowMembersModal(false);
            setShowChatConfirmation(false);
            // Call the onSelectUser prop to open chat with the selected member
            onSelectUser(userData);
        }
    };

    // Filter media messages
    const filteredMediaMessages = useMemo(() => {
        if (selectedGroup) {
            return sharedMedia.filter(msg => msg.groupId === selectedGroup.id);
        } else if (selectedUser) {
            return sharedMedia.filter(msg => 
                (msg.senderId === currentUser.uid && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
            );
        }
        return sharedMedia; // Return all media messages if neither group nor user is selected
    }, [sharedMedia, selectedGroup, selectedUser, currentUser.uid]);

    // Filter files
    const filteredFiles = useMemo(() => {
        if (selectedGroup) {
            return messages.filter(msg => msg.type === 'file' && msg.groupId === selectedGroup.id);
        } else if (selectedUser) {
            return messages.filter(msg => 
                (msg.senderId === currentUser.uid && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
            );
        }
        return messages.filter(msg => msg.type === 'file'); // Return all files if neither group nor user is selected
    }, [messages, selectedGroup, selectedUser, currentUser.uid]);

    // Filter links
    const filteredLinks = useMemo(() => {
        if (selectedGroup) {
            return messages.filter(msg => msg.type === 'link' && msg.groupId === selectedGroup.id);
        } else if (selectedUser) {
            return messages.filter(msg => 
                (msg.senderId === currentUser.uid && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
            );
        }
        return messages.filter(msg => msg.type === 'link'); // Return all links if neither group nor user is selected
    }, [messages, selectedGroup, selectedUser, currentUser.uid]);

    // Filter code snippets
    const filteredCodeSnippets = useMemo(() => {
        if (selectedGroup) {
            return messages.filter(msg => msg.type === 'code' && msg.groupId === selectedGroup.id);
        } else if (selectedUser) {
            return messages.filter(msg => 
                (msg.senderId === currentUser.uid && msg.receiverId === selectedUser.id) ||
                (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
            );
        }
        return messages.filter(msg => msg.type === 'code'); // Return all code snippets if neither group nor user is selected
    }, [messages, selectedGroup, selectedUser, currentUser.uid]);

    return (
        <>
            {(selectedUser || selectedGroup) ? (
                <section className="flex flex-col items-start justify-start h-screen flex-1 background-image">
                    <header className="w-full h-[82px] m:h-fit p-4 bg-white flex items-center justify-between">
                        <main 
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => setShowContactDetails(true)}
                        >
                            <span>
                                {isGroupChat ? (
                                    <div className="w-11 h-11 bg-[#01AA85] rounded-full flex items-center justify-center">
                                        <RiGroupLine className="text-white" size={24} />
                                    </div>
                                ) : (
                                    <img 
                                        src={selectedUser?.profile_pic || defaultAvatar} 
                                        className="w-11 h-11 object-cover rounded-full" 
                                        alt={selectedUser?.name} 
                                    />
                                )}
                            </span>
                            <span>
                                <h3 className="font-semibold text-[#2A3D39] text-lg">
                                    {isGroupChat ? selectedGroup.name : selectedUser?.name}
                                </h3>
                                <p className="font-light text-[#2A3D39] text-sm">
                                    {isGroupChat ? `${selectedGroup.members?.length || 0} members` : selectedUser?.email}
                                </p>
                            </span>
                        </main>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <span className="bg-[#01AA85] text-white text-xs px-2 py-1 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                            <button 
                                onClick={() => setShowSearch(!showSearch)}
                                className="text-[#2A3D39] hover:text-[#01AA85] transition-colors"
                            >
                                <RiSearchLine size={24} />
                            </button>
                            {isGroupChat && selectedGroup.admins?.includes(currentUser.uid) && (
                                <button 
                                    onClick={() => setShowGroupModal(true)}
                                    className="text-[#2A3D39] hover:text-[#01AA85] transition-colors"
                                >
                                    <RiSettings4Line size={24} />
                                </button>
                            )}
                            {!isGroupChat && (
                                <div className="relative" ref={menuRef}>
                                    <RiMore2Fill 
                                        className="text-[#2A3D39] cursor-pointer" 
                                        size={24} 
                                        onClick={() => setShowMenu(!showMenu)} 
                                    />
                                    {showMenu && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-10">
                                            {isBlocked ? (
                                                <button
                                                    onClick={() => {
                                                        setShowUnblockModal(true);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-[#01AA85] hover:bg-gray-100 flex items-center gap-2"
                                                >
                                                    <RiUserFollowFill size={20} />
                                                    Unblock User
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setShowBlockModal(true);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-red-500 hover:bg-gray-100 flex items-center gap-2"
                                                >
                                                    <RiUserUnfollowFill size={20} />
                                                    Block User
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Search Bar */}
                    {showSearch && (
                        <div className="w-full bg-white p-3 border-b border-gray-200 flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                    placeholder="Search in messages..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85] focus:border-transparent"
                                />
                                <RiSearchLine className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">
                                        {currentSearchIndex + 1} of {searchResults.length}
                                    </span>
                                    <button 
                                        onClick={() => navigateSearchResults('prev')}
                                        className="p-1 rounded-full hover:bg-gray-100"
                                    >
                                        ↑
                                    </button>
                                    <button 
                                        onClick={() => navigateSearchResults('next')}
                                        className="p-1 rounded-full hover:bg-gray-100"
                                    >
                                        ↓
                                    </button>
                                </div>
                            )}
                            <button 
                                onClick={() => {
                                    setShowSearch(false);
                                    setSearchQuery("");
                                    setSearchResults([]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <RiCloseFill size={24} />
                            </button>
                        </div>
                    )}

                    <main className="custom-scrollbar relative h-[100vh] w-[100%] flex flex-col justify-between">
                        <section className="px-3 pt-5 b-20 lg:pb-10">
                            <div ref={scrollRef} className="overflow-auto h-[80vh] scrollbar-hide relative">
                                {isBlocked && (
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-center">
                                            {blockStatus === 'blocked' 
                                                ? "You have blocked this user. You cannot send or receive messages from them."
                                                : "This user has blocked you. You cannot send or receive messages from them."}
                                        </div>
                                                                </div>
                                                            )}
                                <div className="space-y-3">
                                    {filteredMessages.map((message, index) => {
                                        // Check if this message is from a different day than the previous one
                                        const currentDate = new Date(message.sentAt?.toDate?.() || message.sentAt);
                                        const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
                                        const prevDate = prevMessage ? new Date(prevMessage.sentAt?.toDate?.() || prevMessage.sentAt) : null;
                                        
                                        const isNewDay = !prevDate || 
                                            currentDate.getDate() !== prevDate.getDate() || 
                                            currentDate.getMonth() !== prevDate.getMonth() || 
                                            currentDate.getFullYear() !== prevDate.getFullYear();
                                        
                                        // Format the date for the header
                                        const formatDateHeader = (date) => {
                                            const today = new Date();
                                            const yesterday = new Date(today);
                                            yesterday.setDate(yesterday.getDate() - 1);
                                            
                                            if (date.getDate() === today.getDate() && 
                                                date.getMonth() === today.getMonth() && 
                                                date.getFullYear() === today.getFullYear()) {
                                                return "Today";
                                            } else if (date.getDate() === yesterday.getDate() && 
                                                date.getMonth() === yesterday.getMonth() && 
                                                date.getFullYear() === yesterday.getFullYear()) {
                                                return "Yesterday";
                                            } else {
                                                return date.toLocaleDateString('en-US', { 
                                                    weekday: 'long', 
                                                    year: 'numeric', 
                                                    month: 'long', 
                                                    day: 'numeric' 
                                                });
                                            }
                                        };
                                        
                                        return (
                                            <React.Fragment key={message.id}>
                                                {isNewDay && (
                                                    <div className="sticky top-0 z-30 flex justify-center my-4 py-2">
                                                        <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded-full text-sm shadow-sm">
                                                            {formatDateHeader(currentDate)}
                                                        </div>
                                                    </div>
                                                )}
                                                <div
                                                    className={`flex ${message.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    {renderMessageContent(message)}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                        </div>
                            </div>
                        </section>
                        <div className="sticky lg:bottom-0 bottom-[60px] p-3 h-fit w-[100%]">
                            {isBlocked ? (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-center mb-4">
                                    {blockStatus === 'blocked' 
                                        ? "You have blocked this user. You cannot send or receive messages from them."
                                        : "This user has blocked you. You cannot send or receive messages from them."}
                                </div>
                            ) : (
                            <form onSubmit={handleSendMessage} className="flex items-center bg-white h-[60px] w-[100%] px-4 rounded-lg relative shadow-lg">
                                <input
                                    value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                    className="h-full text-[#2A3D39] outline-none text-[16px] pl-4 pr-[50px] rounded-lg w-[90%]"
                                    type="text"
                                    placeholder="Write your message..."
                                        disabled={loading}
                                />
                                <div className="flex items-center">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="flex items-center justify-center p-2 rounded-full hover:bg-[#D9f2ed] transition duration-200"
                                            disabled={loading}
                                        >
                                            <RiEmotionLine color="#01AA85" size={24} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current.click()} 
                                            className="flex items-center justify-center p-2 rounded-full hover:bg-[#D9f2ed] transition duration-200"
                                            disabled={loading}
                                        >
                                        <RiImageAddFill color="#01AA85" size={24} />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        accept="image/*,video/*,.pdf,.doc,.docx"
                                            disabled={loading}
                                        />
                                        <button 
                                            type="submit" 
                                            className="flex items-center justify-center p-2 rounded-full bg-[#D9f2ed] hover:bg-[#c8eae3] text-lg ml-2"
                                            disabled={loading}
                                        >
                                        <RiSendPlaneFill color="#01AA85" size={24} />
                                    </button>
                                </div>
                                    {showEmojiPicker && (
                                        <div 
                                            ref={emojiPickerRef}
                                            className="absolute bottom-[70px] right-0 z-50"
                                        >
                                            <EmojiPicker onEmojiClick={onEmojiClick} />
                                        </div>
                                    )}
                            </form>
                            )}
                            {selectedFile && (
                                <div className="mt-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between cursor-pointer">
                                    <p className="text-[#2A3D39]">{selectedFile.name}</p>
                                    <button onClick={handleRemoveFile} className="text-red-500">
                                        <RiCloseFill size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </main>

                    {/* Contact Details and Shared Media Section */}
                    {showContactDetails && (
                        <div className="fixed inset-0  flex">
                            {/* Overlay to dim the background */}
                            <div className="absolute inset-0  bg-opacity-20" onClick={() => setShowContactDetails(false)}></div>
                            
                            {/* Contact Details Panel */}
                            <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-lg z-10">
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-[#2A3D39]">Contact Details</h2>
                                    <button 
                                        onClick={() => setShowContactDetails(false)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <RiCloseFill size={24} />
                                    </button>
                                </div>
                                
                                <div className="p-4 flex flex-col items-center border-b border-gray-200">
                                    {isGroupChat ? (
                                        <>
                                            <div className="w-24 h-24 bg-[#01AA85] rounded-full flex items-center justify-center mb-3">
                                                <RiGroupLine className="text-white" size={40} />
                                            </div>
                                            <h3 className="text-xl font-semibold text-[#2A3D39]">{selectedGroup.name}</h3>
                                            <p className="text-gray-600">{selectedGroup.members?.length || 0} members</p>
                                            <div className="mt-4 w-full">
                                                <h4 className="text-sm font-semibold text-[#2A3D39] mb-2">Group Members</h4>
                                                <div className="max-h-40 overflow-y-auto">
                                                    {groupMembers.slice(0, 3).map((member) => (
                                                        <div key={member.uid} className="flex items-center py-1">
                                                            <img 
                                                                src={member.profile_pic || defaultAvatar} 
                                                                className="w-8 h-8 rounded-full mr-2" 
                                                                alt={member.name} 
                                                            />
                                                            <span className="text-sm">
                                                                {member.name}
                                                                {selectedGroup.admins?.includes(member.uid) && (
                                                                    <span className="ml-1 text-xs text-[#01AA85]">(Admin)</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {groupMembers.length > 3 && (
                                                        <button 
                                                            onClick={() => setShowMembersModal(true)}
                                                            className="w-full text-center py-2 text-sm text-[#01AA85] hover:bg-gray-50 rounded-md mt-1"
                                                        >
                                                            Show All ({groupMembers.length} members)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <img 
                                                src={selectedUser?.profile_pic || defaultAvatar} 
                                                className="w-24 h-24 object-cover rounded-full mb-3" 
                                                alt={selectedUser?.name} 
                                            />
                                            <h3 className="text-xl font-semibold text-[#2A3D39]">{selectedUser?.name}</h3>
                                            <p className="text-gray-600">{selectedUser?.email}</p>
                                            {selectedUser?.bio && (
                                                <p className="mt-2 text-gray-700 text-center">{selectedUser.bio}</p>
                                            )}
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex-1 overflow-auto">
                                    <div className="p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-lg font-semibold text-[#2A3D39]">Shared Media</h3>
                                            {filteredMediaMessages.length > 3 && !showAllMedia && (
                                                <button 
                                                    onClick={() => setShowMediaModal(true)}
                                                    className="text-sm text-[#01AA85] hover:text-[#018a6d] hover:underline"
                                                >
                                                    Show All ({filteredMediaMessages.length})
                                                </button>
                                            )}
                                        </div>
                                        {filteredMediaMessages.length === 0 ? (
                                            <p className="text-gray-500 text-center">No shared media yet</p>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {filteredMediaMessages.slice(0, showAllMedia ? undefined : 3).map((media) => (
                                                        <div 
                                                            key={media.id} 
                                                            className="flex flex-col"
                                                        >
                                                            <div 
                                                                className="aspect-square rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                                                onClick={() => handleMediaClick(media)}
                                                            >
                                                                {media.type === 'image' ? (
                                                                    <img 
                                                                        src={media.content} 
                                                                        alt="Shared image" 
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                                        <RiFileLine size={24} className="text-gray-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {media.type === 'file' && (
                                                                <p className="text-xs text-gray-600 mt-1 truncate" title={media.fileName || 'File'}>
                                                                    {media.fileName || 'File'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Leave Group Button */}
                                {isGroupChat && !selectedGroup.creator && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to leave this group?')) {
                                                    leaveGroup(selectedGroup.id);
                                                }
                                            }}
                                            className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                                        >
                                            Leave Group
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Media Viewer Modal */}
                    {selectedMedia && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#D9F2ED] bg-opacity-20 backdrop-blur-sm">
                            <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
                                <button 
                                    onClick={closeMediaViewer}
                                    className="absolute top-2 right-2 text-gray-700 bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100 z-10 shadow-md"
                                >
                                    <RiCloseFill size={24} />
                                </button>
                                
                                {selectedMedia.type === 'image' ? (
                                    <img 
                                        src={selectedMedia.content} 
                                        alt="Shared image" 
                                        className="max-h-[90vh] w-auto mx-auto object-contain rounded-lg shadow-xl"
                                    />
                                ) : (
                                    <div className="bg-white p-8 rounded-lg text-center shadow-xl">
                                        <div className="mb-4">
                                            <RiFileLine size={48} className="text-gray-500 mx-auto" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">{selectedMedia.fileName || 'File'}</h3>
                                        <a 
                                            href={selectedMedia.content} 
                                            download
                                            className="inline-block mt-4 px-4 py-2 bg-[#01AA85] text-white rounded-lg hover:bg-[#018a6d] transition-colors"
                                        >
                                            Download File
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Media Modal */}
                    {showMediaModal && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#D9F2ED] bg-opacity-20 backdrop-blur-sm">
                            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-[#2A3D39]">All Shared Media</h2>
                                    <button 
                                        onClick={() => setShowMediaModal(false)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <RiCloseFill size={24} />
                                    </button>
                                </div>
                                <div className="p-4 overflow-y-auto max-h-[70vh]">
                                    <div className="grid grid-cols-4 gap-3">
                                        {filteredMediaMessages.map((media) => (
                                            <div 
                                                key={media.id} 
                                                className="flex flex-col"
                                            >
                                                <div 
                                                    className="aspect-square rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => {
                                                        handleMediaClick(media);
                                                        setShowMediaModal(false);
                                                    }}
                                                >
                                                    {media.type === 'image' ? (
                                                        <img 
                                                            src={media.content} 
                                                            alt="Shared image" 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                            <RiFileLine size={24} className="text-gray-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                {media.type === 'file' && (
                                                    <p className="text-xs text-gray-600 mt-1 truncate" title={media.fileName || 'File'}>
                                                        {media.fileName || 'File'}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <ConfirmationModal
                        isOpen={showBlockModal}
                        onClose={() => setShowBlockModal(false)}
                        onConfirm={handleBlockUser}
                        title="Block User"
                        message={`Are you sure you want to block ${selectedUser?.name}? You won't be able to send or receive messages from them.`}
                        confirmText="Block"
                        cancelText="Cancel"
                        confirmButtonClass="bg-red-500 hover:bg-red-600"
                    />

                    <ConfirmationModal
                        isOpen={showUnblockModal}
                        onClose={() => setShowUnblockModal(false)}
                        onConfirm={handleUnblockUser}
                        title="Unblock User"
                        message={`Are you sure you want to unblock ${selectedUser?.name}? You will be able to send and receive messages from them again.`}
                        confirmText="Unblock"
                        cancelText="Cancel"
                        confirmButtonClass="bg-[#01AA85] hover:bg-[#018a6d]"
                    />

                    {contextMenu && (
                        <MessageContextMenu
                            position={contextMenu.position}
                            message={contextMenu.message}
                            onClose={() => setContextMenu(null)}
                            onDelete={handleDeleteMessage}
                            onReact={handleReactToMessage}
                            onMessageUpdate={handleMessageUpdate}
                            isGroupChat={isGroupChat}
                            groupId={selectedGroup?.id}
                        />
                    )}

                    {isGroupChat && showGroupModal && (
                        <GroupModal
                            isOpen={showGroupModal}
                            onClose={() => setShowGroupModal(false)}
                            group={selectedGroup}
                            mode="edit"
                        />
                    )}

                    {/* Members Modal */}
                    {showMembersModal && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#D9F2ED] bg-opacity-20 backdrop-blur-sm">
                            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-[#2A3D39]">Group Members</h2>
                                    <div className="flex items-center gap-2">
                                        {currentUser.uid !== selectedGroup.creator && (
                                            <button
                                                onClick={() => {
                                                    setShowChatConfirmation(true);
                                                    setSelectedMember(currentUser);
                                                }}
                                                className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1 px-3 py-1 border border-red-500 rounded-md hover:bg-red-50 transition-colors"
                                            >
                                                <FaSignOutAlt size={14} />
                                                Leave Group
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setShowMembersModal(false)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <RiCloseFill size={24} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="mb-4">
                                        <input
                                            type="text"
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                                            placeholder="Search members..."
                                        />
                                    </div>
                                    <div className="overflow-y-auto max-h-[60vh]">
                                        <div className="space-y-2">
                                            {filteredMembers.map((member) => (
                                                <div 
                                                    key={member.uid} 
                                                    className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-md cursor-pointer"
                                                    onClick={() => handleMemberClick(member)}
                                                >
                                                    <div className="flex items-center">
                                                        <img 
                                                            src={member.profile_pic || defaultAvatar} 
                                                            className="w-8 h-8 rounded-full mr-2" 
                                                            alt={member.name} 
                                                        />
                                                        <span className="text-sm">
                                                            {member.name}
                                                            {selectedGroup.admins?.includes(member.uid) && (
                                                                <span className="ml-1 text-xs text-[#01AA85]">(Admin)</span>
                                                            )}
                                                            {member.uid === selectedGroup.creator && (
                                                                <span className="ml-1 text-xs text-[#01AA85]">(Creator)</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredMembers.length === 0 && (
                                                <div className="text-center text-gray-500 py-4">
                                                    No members found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat Confirmation Modal */}
                    {showChatConfirmation && (
                        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#D9F2ED] bg-opacity-20 backdrop-blur-sm">
                            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                                <h3 className="text-lg font-semibold text-[#2A3D39] mb-4">Leave Group</h3>
                                <p className="text-gray-600 mb-6">
                                    Are you sure you want to leave this group? You won't be able to rejoin unless invited by an admin.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setShowChatConfirmation(false);
                                            setSelectedMember(null);
                                        }}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            leaveGroup(selectedGroup.id);
                                            setShowMembersModal(false);
                                            setShowChatConfirmation(false);
                                            setSelectedMember(null);
                                        }}
                                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                    >
                                        Leave Group
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            ) : (
                <section className="flex flex-col items-center justify-center h-screen flex-1 background-image">
                    <img src={logo} alt="Logo" className="w-32 h-32 mb-4" />
                    <h2 className="text-2xl font-semibold text-[#2A3D39]">Welcome to Chatterly</h2>
                    <p className="text-gray-600 mt-2">Select a chat to start messaging</p>
                </section>
            )}
        </>
    );
};

export default ChatBox;
