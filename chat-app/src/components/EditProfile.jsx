import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiImageAddFill, RiCloseFill } from 'react-icons/ri';
import supabase from '../supabase';
import defaultAvatar from '../assets/defaultavatar.png';

const EditProfile = ({ onClose }) => {
    const { currentUser, updateUserProfile } = useAuth();
    const [name, setName] = useState(currentUser?.name || '');
    const [bio, setBio] = useState(currentUser?.bio || '');
    const [profilePic, setProfilePic] = useState(currentUser?.profile_pic || defaultAvatar);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            setError('');

            // Upload image to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.uid}-${Math.random()}.${fileExt}`;
            const filePath = `profile-pictures/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('chat-app')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('chat-app')
                .getPublicUrl(filePath);

            setProfilePic(publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            setError('Failed to upload image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError('');

            await updateUserProfile({
                name,
                bio,
                profile_pic: profilePic
            });

            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-center items-center bg-[#00170cb7]" onClick={onClose}>
            <div className="relative p-4 w-full max-w-md max-h-full" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-[#2A3D39]">Edit Profile</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <RiCloseFill size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <img
                                    src={profilePic}
                                    alt="Profile"
                                    className="w-32 h-32 rounded-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="absolute bottom-0 right-0 bg-[#01AA85] text-white p-2 rounded-full hover:bg-[#018a6d] transition-colors"
                                >
                                    <RiImageAddFill size={20} />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                                placeholder="Enter your name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bio
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                                placeholder="Tell us about yourself"
                                rows="3"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#01AA85] text-white py-2 rounded-lg hover:bg-[#018a6d] transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProfile; 