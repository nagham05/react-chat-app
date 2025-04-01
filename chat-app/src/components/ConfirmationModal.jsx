import React from 'react';
import { RiCloseFill } from "react-icons/ri";

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[90%] max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-[#2A3D39]">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    >
                        <RiCloseFill size={24} />
                    </button>
                </div>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-[#01AA85] text-white rounded hover:bg-[#018f6f] transition-colors duration-200"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal; 