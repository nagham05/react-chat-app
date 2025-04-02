import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiSendPlaneFill, RiImageAddFill, RiCloseFill, RiMore2Fill, RiUserUnfollowFill, RiUserFollowFill } from "react-icons/ri";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import supabase from "../supabase";
import ConfirmationModal from "./ConfirmationModal";

const ChatBox = ({ selectedUser }) => {
    const { currentUser, sendMessage, uploadFile, blockUser, unblockUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showUnblockModal, setShowUnblockModal] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockStatus, setBlockStatus] = useState(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const menuRef = useRef(null);

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

            // Add message to local state immediately
            const newMessage = {
                id: messageRef.id,
                senderId: currentUser.uid,
                receiverId: selectedUser.id,
                content: content,
                type: messageType,
                sentAt: new Date().toISOString(),
                ...(fileName && { fileName })
            };

            setMessages(prevMessages => [...prevMessages, newMessage]);
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

    const renderMessageContent = (msg) => {
        switch (msg.type) {
            case 'text':
                return <h4 className="whitespace-normal break-words max-w-[300px]">{msg.content}</h4>;
            case 'image':
                return (
                    <img 
                        src={msg.content} 
                        alt={msg.fileName || "Shared image"} 
                        className="max-w-[300px] max-h-[300px] rounded cursor-pointer"
                        onClick={() => window.open(msg.content, '_blank')}
                    />
                );
            case 'file':
                return (
                    <div className="flex items-center gap-2">
                        <p className="text-gray-400 text-sm">{msg.fileName}</p>
                        <button 
                            className="text-teal-600 hover:text-teal-700 text-sm"
                            onClick={() => window.open(msg.content, '_blank')}
                        >
                            Download
                        </button>
                    </div>
                );
            default:
                return <p>Unsupported message type</p>;
        }
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

    return (
        <>
            {selectedUser ? (
                <section className="flex flex-col items-start justify-start h-screen flex-1 background-image">
                    <header className="w-full h-[82px] m:h-fit p-4 bg-white flex items-center justify-between">
                        <main className="flex items-center gap-3">
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
                    </header>

                    <main className="custom-scrollbar relative h-[100vh] w-[100%] flex flex-col justify-between">
                        <section className="px-3 pt-5 b-20 lg:pb-10">
                            <div ref={scrollRef} className="overflow-auto h-[80vh]">
                                {isBlocked && (
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-center max-w-md">
                                            You have blocked this user. You cannot send or receive messages from them.
                                        </div>
                                    </div>
                                )}
                                {messages.map((msg) => (
                                    <div 
                                        key={msg.id}
                                        className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'} mb-4`}
                                    >
                                        <div className={`max-w-[70%] ${msg.senderId === currentUser.uid ? 'bg-[#01AA85] text-white' : 'bg-white'} rounded-lg p-3 shadow-sm`}>
                                            {renderMessageContent(msg)}
                                            <p className="text-xs mt-1 opacity-70">
                                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
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

                    <ConfirmationModal
                        isOpen={showBlockModal}
                        onClose={() => setShowBlockModal(false)}
                        onConfirm={handleBlockUser}
                        title="Block User"
                        message={`Are you sure you want to block ${selectedUser?.name}? You won't be able to send or receive messages from this user.`}
                    />

                    <ConfirmationModal
                        isOpen={showUnblockModal}
                        onClose={() => setShowUnblockModal(false)}
                        onConfirm={handleUnblockUser}
                        title="Unblock User"
                        message={`Are you sure you want to unblock ${selectedUser?.name}? You will be able to send and receive messages from this user again.`}
                    />
                </section>
            ) : (
                <section className="flex flex-col h-screen flex-1">
                    <div className="flex flex-col justify-center items-center h-screen">
                        <img src={logo} alt="" width={100} />
                        <h1 className="text-[30px] font-bold text-teal-700 mt-5">Welcome to Chatterly</h1>
                        <p className="text-gray-500">Connect and chat with friends easily, securely, and fast</p>
                    </div>
                </section>
            )}
        </>
    );
};

export default ChatBox;
