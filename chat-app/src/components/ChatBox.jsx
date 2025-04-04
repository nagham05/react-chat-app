import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiSendPlaneFill, RiImageAddFill, RiCloseFill, RiMore2Fill, RiUserUnfollowFill, RiUserFollowFill, RiEmotionLine, RiImageLine, RiFileLine } from "react-icons/ri";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import supabase from "../supabase";
import ConfirmationModal from "./ConfirmationModal";
import MessageContextMenu from './MessageContextMenu';
import EmojiPicker from 'emoji-picker-react';

const ChatBox = ({ selectedUser }) => {
    const { currentUser, sendMessage, uploadFile, blockUser, unblockUser, removeReaction, addReaction, markMessageAsRead, getUnreadCount } = useAuth();
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
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const menuRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        if (!selectedUser) return;

        const messagesRef = collection(db, 'Messages');
        const q = query(
            messagesRef,
            where('senderId', 'in', [currentUser.uid, selectedUser.id]),
            where('receiverId', 'in', [currentUser.uid, selectedUser.id]),
            orderBy('sentAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(newMessages);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedUser, currentUser.uid]);

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
                // Upload file using the new uploadFile function
                fileUrl = await uploadFile(selectedFile);
                messageType = getFileType(selectedFile.name);
                fileName = selectedFile.name;
                content = fileUrl;
            }

            // Add message to Firestore
            const messageRef = await sendMessage(
                content,
                selectedUser.id,
                messageType,
                fileUrl,
                fileName
            );

            // Clear input fields immediately
            setMessageText("");
            setSelectedFile(null);
            
            // Don't manually add the message to state - let the onSnapshot listener handle it
            // This prevents duplicate messages from appearing
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleFileClick = (fileUrl) => {
        window.open(fileUrl);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    const filteredMessages = useMemo(() => {
        return messages.filter(msg => 
            (msg.receiverId === selectedUser.id && msg.senderId === currentUser.uid) || 
            (msg.senderId === selectedUser.id && msg.receiverId === currentUser.uid)
        );
    }, [messages, selectedUser?.id, currentUser?.uid]);

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
            if (message.reactions?.[reaction]) {
                await removeReaction(message.id, reaction);
            } else {
                await addReaction(message.id, reaction);
            }
            
            // Reload messages to show the updated reactions
            const messagesRef = collection(db, 'Messages');
            const q = query(
                messagesRef,
                where('senderId', 'in', [currentUser.uid, selectedUser.id]),
                where('receiverId', 'in', [currentUser.uid, selectedUser.id]),
                orderBy('sentAt', 'asc')
            );

            const snapshot = await getDocs(q);
            const newMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(newMessages);
        } catch (error) {
            console.error('Error handling reaction:', error);
        }
    };

    // Update unread count when messages change
    useEffect(() => {
        const updateUnreadCount = async () => {
            if (selectedUser) {
                const count = await getUnreadCount(selectedUser.id);
                setUnreadCount(count);
            }
        };
        updateUnreadCount();
    }, [selectedUser, messages]);

    // Mark messages as read when they are viewed
    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (!selectedUser || !currentUser) return;

            const unreadMessages = messages.filter(
                msg => msg.receiverId === currentUser.uid && !msg.read
            );

            for (const message of unreadMessages) {
                await markMessageAsRead(message.id);
            }
        };

        markMessagesAsRead();
    }, [messages, selectedUser, currentUser]);

    const renderMessageContent = (message) => {
        // Don't render deleted messages
        if (message.deleted) return null;

        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const isMessageRead = message.read && message.readAt;
        const showReadReceipt = message.senderId === currentUser.uid;

        return (
            <div
                className={`p-3 rounded-lg max-w-[70%] ${
                    message.senderId === currentUser.uid
                        ? 'bg-[#01AA85] text-white ml-auto'
                        : 'bg-gray-100 text-gray-800'
                }`}
                onDoubleClick={(e) => handleMessageDoubleClick(e, message)}
            >
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
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {Object.entries(message.reactions).map(([reaction, count]) => (
                            <button
                                key={reaction}
                                onClick={() => handleReactionClick(message, reaction)}
                                className="text-xs bg-white/20 px-1 rounded hover:bg-white/30 transition-colors"
                            >
                                {reaction} {count}
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
            if (!selectedUser) return;
            
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

    return (
        <>
            {selectedUser ? (
                <section className="flex flex-col items-start justify-start h-screen flex-1 background-image">
                    <header className="w-full h-[82px] m:h-fit p-4 bg-white flex items-center justify-between">
                        <main 
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => setShowContactDetails(true)}
                        >
                            <span>
                                <img 
                                    src={selectedUser?.profile_pic || defaultAvatar} 
                                    className="w-11 h-11 object-cover rounded-full" 
                                    alt={selectedUser?.name} 
                                />
                            </span>
                            <span>
                                <h3 className="font-semibold text-[#2A3D39] text-lg">{selectedUser?.name}</h3>
                                <p className="font-light text-[#2A3D39] text-sm">{selectedUser?.email}</p>
                            </span>
                        </main>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <span className="bg-[#01AA85] text-white text-xs px-2 py-1 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
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
                        </div>
                    </header>

                    <main className="custom-scrollbar relative h-[100vh] w-[100%] flex flex-col justify-between">
                        <section className="px-3 pt-5 b-20 lg:pb-10">
                            <div ref={scrollRef} className="overflow-auto h-[80vh] scrollbar-hide">
                                {isBlocked && (
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-center">
                                            {blockStatus === 'blocked' 
                                                ? "You have blocked this user. You cannot send or receive messages from them."
                                                : "This user has blocked you. You cannot send or receive messages from them."}
                                        </div>
                                    </div>
                                )}
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {renderMessageContent(message)}
                                    </div>
                                ))}
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
                                </div>
                                
                                <div className="flex-1 overflow-auto">
                                    <div className="p-4">
                                        <h3 className="text-lg font-semibold text-[#2A3D39] mb-3">Shared Media</h3>
                                        {sharedMedia.length === 0 ? (
                                            <p className="text-gray-500 text-center">No shared media yet</p>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2">
                                                {sharedMedia.map((media) => (
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
                                        )}
                                    </div>
                                </div>
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
                        />
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
