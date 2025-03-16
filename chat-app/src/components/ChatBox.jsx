import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/defaultavatar.png";
import { RiSendPlaneFill, RiImageAddFill, RiCloseFill, RiMore2Fill } from "react-icons/ri";
import logo from "../assets/logo.png";

const Chatbox = ({ selectedUser }) => {
    const [messages, setMessages] = useState([]);
    const [messageText, sendMessageText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    const user1 = { fullName: "Current User", username: "currentuser", image: defaultAvatar };
    const user2 = selectedUser || { fullName: "Selected User", username: "selecteduser", image: defaultAvatar };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!messageText.trim() && !selectedFile) {
            return; // Do not send if the message is empty and no file is selected
        }

        const newMessage = {
            sender: user1.username,
            recipient: user2.username,
            text: messageText,
            timestamp: {
                seconds: Math.floor(Date.now() / 1000),
                nanoseconds: 0,
            },
            file: selectedFile,
        };

        console.log("Sending message:", newMessage); // Debugging log

        setMessages((prevMessages) => [...prevMessages, newMessage]);
        sendMessageText(""); // Clear the message input
        setSelectedFile(null); // Clear the selected file after sending
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleFileClick = (file) => {
        const fileURL = URL.createObjectURL(file);
        window.open(fileURL);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    const filteredMessages = useMemo(() => {
        return messages.filter(msg => 
            (msg.recipient === user2.username && msg.sender === user1.username) || 
            (msg.sender === user2.username && msg.recipient === user1.username)
        );
    }, [messages, user2.username, user1.username]);

    return (
        <>
            {selectedUser ? (
                <section className="flex flex-col items-start justify-start h-screen flex-1 background-image">
                    <header className="w-full h-[82px] m:h-fit p-4 bg-white flex items-center justify-between">
                        <main className="flex items-center gap-3">
                            <span>
                                <img src={selectedUser?.image || defaultAvatar} className="w-11 h-11 object-cover rounded-full" alt="" />
                            </span>
                            <span>
                                <h3 className="font-semibold text-[#2A3D39] text-lg">{selectedUser?.fullName || "Chatfrik User"}</h3>
                                <p className="font-light text-[#2A3D39] text-sm">@{selectedUser?.username || "chatfrik"}</p>
                            </span>
                        </main>
                        <RiMore2Fill className="text-[#2A3D39] cursor-pointer" size={24} onClick={() => console.log("Menu clicked")} />
                    </header>

                    <main className="custom-scrollbar relative h-[100vh] w-[100%] flex flex-col justify-between">
                        <section className="px-3 pt-5 b-20 lg:pb-10">
                            <div ref={scrollRef} className="overflow-auto h-[80vh]">
                                {filteredMessages?.map((msg, index) => (
                                    (msg.text.trim() || msg.file) && (
                                        <div key={index} className={`flex flex-col ${msg.sender === user1.username ? "items-end" : "items-start"} w-full`}>
                                            <span className={`flex gap-3 ${msg.sender === user1.username ? "me-10" : "ms-10"} h-auto`}>
                                                {msg.sender !== user1.username && <img src={defaultAvatar} className="h-11 w-11 object-cover rounded-full" alt="" />}
                                                <div>
                                                    <div className="flex items-center bg-white justify-center p-6 rounded-lg shadow-sm gap-2">
                                                        <h4 className="whitespace-normal break-words max-w-[300px]">{msg.text}</h4>
                                                        {msg.file && (
                                                            <div className="flex items-center justify-between mt-1">
                                                                {msg.file.type.startsWith('image/') ? (
                                                                    <img 
                                                                        src={URL.createObjectURL(msg.file)} 
                                                                        alt={msg.file.name} 
                                                                        className="max-w-[150px] max-h-[150px] rounded"
                                                                    />
                                                                ) : (
                                                                    <p className="text-gray-400 text-sx cursor-pointer" onClick={() => handleFileClick(msg.file)}>
                                                                        {msg.file.name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-400 text-sx mt-3">{formatTimestamp(msg?.timestamp)}</p>
                                                </div>
                                            </span>
                                        </div>
                                    )
                                ))}
                            </div>
                        </section>
                        <div className="sticky lg:bottom-0 bottom-[60px] p-3 h-fit w-[100%]">
                            <form onSubmit={handleSendMessage} className="flex items-center bg-white h-[60px] w-[100%] px-4 rounded-lg relative shadow-lg">
                                <input
                                    value={messageText}
                                    onChange={(e) => sendMessageText(e.target.value)}
                                    className="h-full text-[#2A3D39] outline-none text-[16px] pl-4 pr-[50px] rounded-lg w-[90%]"
                                    type="text"
                                    placeholder="Write your message..."
                                />
                                <div className="flex items-center">
                                    <button type="button" onClick={() => fileInputRef.current.click()} className="flex items-center justify-center p-2 rounded-full hover:bg-[#D9f2ed] transition duration-200">
                                        <RiImageAddFill color="#01AA85" size={24} />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        accept="image/*,video/*,.pdf,.doc,.docx"
                                    />
                                    <button type="submit" className="flex items-center justify-center p-2 rounded-full bg-[#D9f2ed] hover:bg-[#c8eae3] text-lg ml-2">
                                        <RiSendPlaneFill color="#01AA85" size={24} />
                                    </button>
                                </div>
                            </form>
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

export default Chatbox;
