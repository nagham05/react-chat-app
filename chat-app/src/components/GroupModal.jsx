import React, { useState, useEffect } from 'react';
import { useGroup } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaUserMinus, FaCrown } from 'react-icons/fa';
import { RiCloseFill, RiImageAddFill, RiGroupLine } from 'react-icons/ri';
import defaultAvatar from "../assets/defaultavatar.png";

const GroupModal = ({ isOpen, onClose, group = null, mode = 'create' }) => {
  const { createGroup, updateGroup, addMembers, removeMembers, makeAdmin, removeAdmin } = useGroup();
  const { currentUser } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupAdmins, setGroupAdmins] = useState([]);
  const [groupImage, setGroupImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [groupImageUrl, setGroupImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [memberDetails, setMemberDetails] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && group) {
        setGroupName(group.name);
        setGroupMembers(group.members || []);
        setGroupAdmins(group.admins || []);
        fetchGroupMembers();
      } else {
        setGroupName('');
        setSelectedUsers([]);
        fetchAvailableUsers();
      }
    }
  }, [isOpen, mode, group]);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      if (!group?.members?.length) return;
      
      try {
        const details = await Promise.all(
          group.members.map(async (memberId) => {
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
        
        setMemberDetails(details.filter(member => member !== null));
      } catch (error) {
        console.error('Error fetching member details:', error);
      }
    };

    fetchMemberDetails();
  }, [group?.members]);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'Users');
      const q = query(usersRef, where('uid', '!=', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableUsers(users);
    } catch (err) {
      console.error('Error fetching available users:', err);
      setError('Failed to fetch available users');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'Users');
      const memberPromises = group.members.map(async (memberId) => {
        const userDoc = await getDoc(doc(db, 'Users', memberId));
        if (userDoc.exists()) {
          return {
            id: memberId,
            ...userDoc.data()
          };
        }
        return null;
      });
      
      const members = (await Promise.all(memberPromises)).filter(Boolean);
      setGroupMembers(members);
    } catch (err) {
      console.error('Error fetching group members:', err);
      setError('Failed to fetch group members');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError("");
      
      // Get all users except current user and existing group members
      const usersRef = collection(db, 'Users');
      const q = query(
        usersRef, 
        where('uid', '!=', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => 
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !group.members.includes(user.uid)
        );
      
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchError('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleCreateGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!groupName.trim()) {
        setError('Group name is required');
        return;
      }
      
      if (selectedUsers.length === 0) {
        setError('Please select at least one member');
        return;
      }
      
      await createGroup(groupName, selectedUsers);
      onClose();
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!groupName.trim()) {
        setError('Group name is required');
        return;
      }
      
      await updateGroup(group.id, { name: groupName });
      onClose();
    } catch (err) {
      console.error('Error updating group:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (selectedUsers.length === 0) {
        setError('Please select at least one member to add');
        return;
      }
      
      await addMembers(group.id, selectedUsers);
      setSelectedUsers([]);
      await fetchGroupMembers();
      const details = await Promise.all(
        selectedUsers.map(async (userId) => {
          const userDoc = await getDoc(doc(db, 'Users', userId));
          if (userDoc.exists()) {
            return {
              uid: userId,
              ...userDoc.data()
            };
          }
          return null;
        })
      );
      
      const newMembers = details.filter(member => member !== null);
      setMemberDetails(prev => [...prev, ...newMembers]);
    } catch (err) {
      console.error('Error adding members:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      setLoading(true);
      setError(null);
      
      await removeMembers(group.id, [memberId]);
      await fetchGroupMembers();
      setMemberDetails(prev => prev.filter(member => member.uid !== memberId));
    } catch (err) {
      console.error('Error removing member:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeAdmin = async (memberId) => {
    try {
      setLoading(true);
      setError(null);
      
      await makeAdmin(group.id, memberId);
      fetchGroupMembers();
    } catch (err) {
      console.error('Error making admin:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (memberId) => {
    try {
      setLoading(true);
      setError(null);
      
      await removeAdmin(group.id, memberId);
      fetchGroupMembers();
    } catch (err) {
      console.error('Error removing admin:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = availableUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedUsers.includes(user.uid)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-[#00170cb7]" onClick={onClose}>
      <div className="relative p-4 w-full max-w-md max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg p-6 w-[90%] max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[#2A3D39]">
              {mode === 'create' ? 'Create New Group' : 'Edit Group'}
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <RiCloseFill size={24} />
            </button>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
              placeholder="Enter group name"
            />
          </div>
          
          {mode === 'create' ? (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Select Members
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowUserList(true)}
                    onBlur={() => {
                      setTimeout(() => setShowUserList(false), 200);
                    }}
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                    placeholder="Search users..."
                  />
                  
                  {showUserList && (
                    <div className="absolute z-10 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                      {filteredUsers.map(user => (
                        <div
                          key={user.uid}
                          className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                          onClick={() => {
                            setSelectedUsers([...selectedUsers, user.uid]);
                            setSearchTerm('');
                          }}
                        >
                          <img
                            src={user.profile_pic || defaultAvatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-full mr-2"
                          />
                          <span>{user.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2">Selected Members:</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(userId => {
                    const user = availableUsers.find(u => u.uid === userId);
                    return user ? (
                      <div
                        key={userId}
                        className="bg-[#D9F2ED] text-[#01AA85] px-2 py-1 rounded-full flex items-center"
                      >
                        <img
                          src={user.profile_pic || defaultAvatar}
                          alt={user.name}
                          className="w-4 h-4 rounded-full mr-1"
                        />
                        <span className="text-xs">{user.name}</span>
                        <button
                          onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                          className="ml-1 text-[#01AA85] hover:text-[#018a6d]"
                        >
                          <RiCloseFill size={10} />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleCreateGroup}
                  disabled={loading}
                  className="px-4 py-2 bg-[#01AA85] text-white rounded hover:bg-[#018f6f] transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2">Group Members:</h3>
                <div className="max-h-60 overflow-y-auto">
                  {groupMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 border-b"
                    >
                      <div className="flex items-center">
                        <img
                          src={member.profile_pic || defaultAvatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-gray-500">
                            {groupAdmins.includes(member.id) ? 'Admin' : 'Member'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        {member.id !== group.creator && (
                          <>
                            {groupAdmins.includes(member.id) ? (
                              <button
                                onClick={() => handleRemoveAdmin(member.id)}
                                className="text-[#01AA85] hover:text-[#018a6d] transition-colors duration-200"
                                title="Remove as admin"
                              >
                                <FaCrown />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMakeAdmin(member.id)}
                                className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                                title="Make admin"
                              >
                                <FaCrown />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600 hover:text-red-800 transition-colors duration-200"
                              title="Remove from group"
                            >
                              <FaUserMinus />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Add More Members
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01AA85]"
                    placeholder="Search users..."
                  />
                  
                  {searchLoading && (
                    <div className="absolute right-2 top-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#01AA85]"></div>
                    </div>
                  )}
                  
                  {searchError && (
                    <p className="text-red-500 text-sm mt-1">{searchError}</p>
                  )}
                  
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                          onClick={() => {
                            setSelectedUsers([...selectedUsers, user.id]);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          <img
                            src={user.profile_pic || defaultAvatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-full mr-2"
                          />
                          <span>{user.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {selectedUsers.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-bold mb-2">Selected Users to Add:</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(userId => {
                      const user = availableUsers.find(u => u.uid === userId);
                      return user ? (
                        <div
                          key={userId}
                          className="bg-[#D9F2ED] text-[#01AA85] px-2 py-1 rounded-full flex items-center"
                        >
                          <img
                            src={user.profile_pic || defaultAvatar}
                            alt={user.name}
                            className="w-4 h-4 rounded-full mr-1"
                          />
                          <span className="text-xs">{user.name}</span>
                          <button
                            onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                            className="ml-1 text-[#01AA85] hover:text-[#018a6d]"
                          >
                            <RiCloseFill size={10} />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                  
                  <button
                    onClick={handleAddMembers}
                    disabled={loading}
                    className="mt-2 px-4 py-2 bg-[#01AA85] text-white rounded hover:bg-[#018f6f] transition-colors duration-200 text-sm disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Selected Users'}
                  </button>
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={handleUpdateGroup}
                  disabled={loading}
                  className="px-4 py-2 bg-[#01AA85] text-white rounded hover:bg-[#018f6f] transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupModal; 