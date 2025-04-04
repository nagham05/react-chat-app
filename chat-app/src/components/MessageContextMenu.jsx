import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiEditLine, RiDeleteBinLine, RiEmotionLine } from 'react-icons/ri';
import ConfirmationModal from './ConfirmationModal';

const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageContextMenu = ({ message, onClose, position, onMessageUpdate }) => {
    const { currentUser, editMessage, deleteMessage, addReaction, removeReaction } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(message.content);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleEdit = async () => {
        try {
            if (!message?.id) {
                console.error('No message ID found');
                return;
            }

            if (!editedContent.trim()) {
                console.error('Message content cannot be empty');
                return;
            }

            await editMessage(message.id, editedContent);
            onMessageUpdate(message.id, {
                content: editedContent,
                edited: true
            });
            setIsEditing(false);
            onClose();
        } catch (error) {
            console.error('Error editing message:', error);
        }
    };

    const handleDelete = async () => {
        try {
            console.log('Delete initiated for message:', message);
            if (!message?.id) {
                console.error('No message ID found');
                return;
            }
            
            console.log('Calling deleteMessage with ID:', message.id);
            await deleteMessage(message.id);
            console.log('Message deleted successfully');
            
            console.log('Updating UI state for message:', message.id);
            onMessageUpdate(message.id, { deleted: true });
            setShowDeleteModal(false);
            onClose();
        } catch (error) {
            console.error('Error in handleDelete:', error);
        }
    };

    const handleReaction = async (reaction) => {
        try {
            const currentReactions = message.reactions || {};
            let updatedReactions = { ...currentReactions };
            
            if (currentReactions[reaction]) {
                await removeReaction(message.id, reaction);
                delete updatedReactions[reaction];
            } else {
                await addReaction(message.id, reaction);
                updatedReactions[reaction] = (currentReactions[reaction] || 0) + 1;
            }
            
            onMessageUpdate(message.id, { reactions: updatedReactions });
            setShowReactions(false);
            onClose();
        } catch (error) {
            console.error('Error handling reaction:', error);
        }
    };

    if (isEditing) {
        return (
            <div ref={menuRef} className="fixed" style={{ top: position.y, left: position.x }}>
                <div className="bg-white rounded-lg shadow-lg p-4">
                    <input
                        type="text"
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                        autoFocus
                    />
                    <div className="flex justify-end mt-2 space-x-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleEdit}
                            className="px-3 py-1 bg-[#01AA85] text-white rounded-lg hover:bg-[#018a6d]"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div ref={menuRef} className="fixed" style={{ top: position.y, left: position.x }}>
                <div className="bg-white rounded-lg shadow-lg p-2">
                    {message.senderId === currentUser.uid && (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                <RiEditLine className="mr-2" />
                                Edit
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="flex items-center w-full px-4 py-2 text-red-600 hover:bg-gray-100 rounded-lg"
                            >
                                <RiDeleteBinLine className="mr-2" />
                                Delete
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowReactions(!showReactions)}
                        className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        <RiEmotionLine className="mr-2" />
                        Add Reaction
                    </button>
                </div>
                {showReactions && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg p-2">
                        <div className="flex flex-wrap gap-2 max-w-[200px]">
                            {reactions.map((reaction) => (
                                <button
                                    key={reaction}
                                    onClick={() => handleReaction(reaction)}
                                    className={`text-2xl hover:scale-110 transition-transform ${
                                        message.reactions?.[reaction] ? 'opacity-100' : 'opacity-50'
                                    }`}
                                >
                                    {reaction}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Delete Message"
                message="Are you sure you want to delete this message?"
            />
        </>
    );
};

export default MessageContextMenu; 