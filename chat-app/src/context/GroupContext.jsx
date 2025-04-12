import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

const GroupContext = createContext();

export function useGroup() {
  return useContext(GroupContext);
}

export function GroupProvider({ children }) {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indexError, setIndexError] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Get all groups where the current user is a member
  const getGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      setIndexError(false);

      if (!currentUser) {
        throw new Error('User must be logged in to get groups');
      }

      const groupsRef = collection(db, 'Groups');
      const q = query(groupsRef, where('members', 'array-contains', currentUser.uid));
      
      const querySnapshot = await getDocs(q);
      const groupsData = [];
      
      for (const doc of querySnapshot.docs) {
        const groupData = { id: doc.id, ...doc.data() };
        
        try {
          // Get the last message for each group
          const messagesRef = collection(db, 'Groups', doc.id, 'Messages');
          const messagesQuery = query(
            messagesRef, 
            where('type', '==', 'text'),
            orderBy('sentAt', 'desc'), 
            limit(1)
          );
          const messagesSnapshot = await getDocs(messagesQuery);
          
          if (!messagesSnapshot.empty) {
            const lastMessage = messagesSnapshot.docs[0].data();
            groupData.lastMessage = lastMessage.content;
            groupData.lastMessageTime = lastMessage.sentAt?.toDate 
              ? lastMessage.sentAt.toDate() 
              : lastMessage.sentAt;
            groupData.lastMessageType = lastMessage.type;
            groupData.lastMessageSender = lastMessage.senderName;
          }
        } catch (err) {
          if (err.code === 'failed-precondition') {
            setIndexError(true);
            console.warn('Index not ready for group messages:', doc.id);
          } else {
            console.error('Error getting group messages:', err);
          }
        }
        
        groupsData.push(groupData);
      }
      
      setGroups(groupsData);
      return groupsData;
    } catch (err) {
      console.error('Error getting groups:', err);
      if (err.code === 'failed-precondition') {
        setIndexError(true);
      } else {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time listener for groups
  useEffect(() => {
    if (!currentUser) return;

    const groupsRef = collection(db, 'Groups');
    const q = query(groupsRef, where('members', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const groupsData = [];
        
        for (const doc of snapshot.docs) {
          const groupData = { id: doc.id, ...doc.data() };
          
          try {
            // Get the last message for each group
            const messagesRef = collection(db, 'Groups', doc.id, 'Messages');
            const messagesQuery = query(
              messagesRef, 
              where('type', '==', 'text'),
              orderBy('sentAt', 'desc'), 
              limit(1)
            );
            const messagesSnapshot = await getDocs(messagesQuery);
            
            if (!messagesSnapshot.empty) {
              const lastMessage = messagesSnapshot.docs[0].data();
              groupData.lastMessage = lastMessage.content;
              groupData.lastMessageTime = lastMessage.sentAt?.toDate 
                ? lastMessage.sentAt.toDate() 
                : lastMessage.sentAt;
              groupData.lastMessageType = lastMessage.type;
              groupData.lastMessageSender = lastMessage.senderName;
            }
          } catch (err) {
            if (err.code === 'failed-precondition') {
              setIndexError(true);
              console.warn('Index not ready for group messages:', doc.id);
            } else {
              console.error('Error getting group messages:', err);
            }
          }
          
          groupsData.push(groupData);
        }
        
        setGroups(groupsData);
      } catch (err) {
        console.error('Error updating groups:', err);
        if (err.code === 'failed-precondition') {
          setIndexError(true);
        } else {
          setError(err.message);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Create a new group
  const createGroup = async (groupName, members) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to create a group');
      }

      // Add the current user as the creator and a member
      const groupMembers = [currentUser.uid, ...members];
      
      // Create the group document
      const groupRef = await addDoc(collection(db, 'Groups'), {
        name: groupName,
        creator: currentUser.uid,
        members: groupMembers,
        admins: [currentUser.uid], // Creator is automatically an admin
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null
      });

      // Create a welcome message
      await addDoc(collection(db, 'Groups', groupRef.id, 'Messages'), {
        content: `${currentUser.name} created the group`,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        type: 'system',
        sentAt: serverTimestamp()
      });

      return groupRef.id;
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get a specific group by ID
  const getGroup = async (groupId) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to get group details');
      }

      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      return { id: groupDoc.id, ...groupDoc.data() };
    } catch (err) {
      console.error('Error getting group:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update group details
  const updateGroup = async (groupId, updates) => {
    try {
      const groupRef = doc(db, 'Groups', groupId);
      await updateDoc(groupRef, updates);
      
      // Update the local state to reflect changes immediately
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, ...updates } : group
        )
      );
      
      // If the current group is being updated, update it as well
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(prev => ({ ...prev, ...updates }));
      }
      
      return true;
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  };

  // Add members to a group
  const addMembers = async (groupId, memberIds) => {
    try {
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      const currentMembers = groupData.members || [];
      const newMembers = [...new Set([...currentMembers, ...memberIds])];
      
      await updateDoc(groupRef, { members: newMembers });
      
      // Add a system message about the new members
      const membersCollection = collection(db, 'Groups', groupId, 'Messages');
      const memberNames = await Promise.all(
        memberIds.map(async (memberId) => {
          const userDoc = await getDoc(doc(db, 'Users', memberId));
          return userDoc.exists() ? userDoc.data().name : 'Unknown User';
        })
      );
      
      await addDoc(membersCollection, {
        type: 'system',
        content: `${currentUser.name} added ${memberNames.join(', ')} to the group`,
        sentAt: serverTimestamp(),
        senderId: currentUser.uid
      });
      
      // Update the local state to reflect changes immediately
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, members: newMembers } : group
        )
      );
      
      // If the current group is being updated, update it as well
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(prev => ({ ...prev, members: newMembers }));
      }
      
      return true;
    } catch (error) {
      console.error('Error adding members:', error);
      throw error;
    }
  };

  // Remove members from a group
  const removeMembers = async (groupId, memberIds) => {
    try {
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      const currentMembers = groupData.members || [];
      const newMembers = currentMembers.filter(id => !memberIds.includes(id));
      
      // Ensure the creator is not removed
      if (newMembers.length === 0) {
        throw new Error('Cannot remove all members from the group');
      }
      
      await updateDoc(groupRef, { members: newMembers });
      
      // Add a system message about the removed members
      const membersCollection = collection(db, 'Groups', groupId, 'Messages');
      const memberNames = await Promise.all(
        memberIds.map(async (memberId) => {
          const userDoc = await getDoc(doc(db, 'Users', memberId));
          return userDoc.exists() ? userDoc.data().name : 'Unknown User';
        })
      );
      
      await addDoc(membersCollection, {
        type: 'system',
        content: `${currentUser.name} removed ${memberNames.join(', ')} from the group`,
        sentAt: serverTimestamp(),
        senderId: currentUser.uid
      });
      
      // Update the local state to reflect changes immediately
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, members: newMembers } : group
        )
      );
      
      // If the current group is being updated, update it as well
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(prev => ({ ...prev, members: newMembers }));
      }
      
      return true;
    } catch (error) {
      console.error('Error removing members:', error);
      throw error;
    }
  };

  // Leave a group
  const leaveGroup = async (groupId) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to leave a group');
      }

      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      
      // Check if the user is a member of the group
      if (!groupData.members.includes(currentUser.uid)) {
        throw new Error('You are not a member of this group');
      }
      
      // Check if the user is the creator of the group
      if (groupData.createdBy === currentUser.uid) {
        throw new Error('Group creator cannot leave the group. You must delete the group instead.');
      }
      
      // Remove the user from the members array
      const updatedMembers = groupData.members.filter(memberId => memberId !== currentUser.uid);
      
      // Remove the user from the admins array if they are an admin
      const updatedAdmins = groupData.admins.filter(adminId => adminId !== currentUser.uid);
      
      // Update the group document
      await updateDoc(groupRef, {
        members: updatedMembers,
        admins: updatedAdmins,
        updatedAt: serverTimestamp()
      });
      
      // If this was the last message, update the group's last message
      if (groupData.lastMessageSender === currentUser.displayName) {
        // Get the new last message
        const messagesRef = collection(db, 'Groups', groupId, 'Messages');
        const q = query(messagesRef, where('type', '==', 'text'), orderBy('sentAt', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const lastMessage = querySnapshot.docs[0].data();
          await updateDoc(groupRef, {
            lastMessage: lastMessage.content,
            lastMessageTime: lastMessage.sentAt,
            lastMessageSender: lastMessage.senderName,
            updatedAt: serverTimestamp()
          });
        } else {
          // No more messages
          await updateDoc(groupRef, {
            lastMessage: null,
            lastMessageTime: null,
            lastMessageSender: null,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Refresh the groups list
      await getGroups();
      
      return true;
    } catch (err) {
      console.error('Error leaving group:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete a group
  const deleteGroup = async (groupId) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to delete a group');
      }

      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      
      // Check if the user is the creator
      if (groupData.creator !== currentUser.uid) {
        throw new Error('Only the group creator can delete the group');
      }
      
      // Delete the group
      await deleteDoc(groupRef);
      
      return true;
    } catch (err) {
      console.error('Error deleting group:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send a message to a group
  const sendGroupMessage = async (groupId, content, type = 'text', fileUrl = null, fileName = null) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to send a message');
      }

      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      
      // Check if the user is a member of the group
      if (!groupData.members.includes(currentUser.uid)) {
        throw new Error('You are not a member of this group');
      }
      
      // Create the message
      const messageData = {
        content,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        type,
        sentAt: serverTimestamp(),
        ...(fileUrl && { fileUrl }),
        ...(fileName && { fileName })
      };
      
      // Add the message to the group's Messages subcollection
      const messageRef = await addDoc(collection(db, 'Groups', groupId, 'Messages'), messageData);
      
      // Update the group's last message with a JavaScript Date object for proper sorting
      const currentTime = new Date();
      await updateDoc(groupRef, {
        lastMessage: content,
        lastMessageTime: currentTime,
        updatedAt: serverTimestamp()
      });
      
      return messageRef.id;
    } catch (err) {
      console.error('Error sending group message:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get messages from a group
  const getGroupMessages = async (groupId, messageLimit = 50, lastMessage = null, callback = null) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to get messages');
      }

      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      
      // Check if the user is a member of the group
      if (!groupData.members.includes(currentUser.uid)) {
        throw new Error('You are not a member of this group');
      }
      
      // Get the messages
      const messagesRef = collection(db, 'Groups', groupId, 'Messages');
      let q = query(messagesRef, orderBy('sentAt', 'asc'), limit(messageLimit));
      
      if (lastMessage) {
        q = query(q, startAfter(lastMessage));
      }
      
      // If a callback is provided, set up a real-time listener
      if (callback) {
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Ensure sentAt is a Firestore Timestamp
              sentAt: data.sentAt || null
            };
          });
          callback(messages);
        });
        
        // Return the unsubscribe function
        return unsubscribe;
      } else {
        // Otherwise, just get the messages once
        const querySnapshot = await getDocs(q);
        const messages = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Ensure sentAt is a Firestore Timestamp
            sentAt: data.sentAt || null
          };
        });
        
        return messages;
      }
    } catch (err) {
      console.error('Error getting group messages:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete a group message
  const deleteGroupMessage = async (groupId, messageId) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to delete a message');
      }

      const messageRef = doc(db, 'Groups', groupId, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Check if the user is the sender of the message or an admin of the group
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      
      if (messageData.senderId !== currentUser.uid && !groupData.admins.includes(currentUser.uid)) {
        throw new Error('You can only delete your own messages or must be an admin');
      }
      
      // Delete the message
      await deleteDoc(messageRef);
      
      // If this was the last message, update the group's last message
      if (messageData.sentAt === groupData.lastMessageTime) {
        // Get the new last message
        const messagesRef = collection(db, 'Groups', groupId, 'Messages');
        const q = query(messagesRef, where('type', '==', 'text'), orderBy('sentAt', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const lastMessage = querySnapshot.docs[0].data();
          await updateDoc(groupRef, {
            lastMessage: lastMessage.content,
            lastMessageTime: lastMessage.sentAt,
            updatedAt: serverTimestamp()
          });
        } else {
          // No more messages
          await updateDoc(groupRef, {
            lastMessage: null,
            lastMessageTime: null,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting group message:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Edit a group message
  const editGroupMessage = async (groupId, messageId, newContent) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to edit a message');
      }

      const messageRef = doc(db, 'Groups', groupId, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Check if the user is the sender of the message
      if (messageData.senderId !== currentUser.uid) {
        throw new Error('You can only edit your own messages');
      }
      
      // Check if the message is a system message
      if (messageData.type === 'system') {
        throw new Error('System messages cannot be edited');
      }
      
      // Update the message
      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      });
      
      // If this was the last message, update the group's last message
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists() && messageData.sentAt === groupDoc.data().lastMessageTime) {
        await updateDoc(groupRef, {
          lastMessage: newContent,
          updatedAt: serverTimestamp()
        });
      }
      
      return true;
    } catch (err) {
      console.error('Error editing group message:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add a reaction to a group message
  const addGroupReaction = async (groupId, messageId, reaction) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to add a reaction');
      }

      const messageRef = doc(db, 'Groups', groupId, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Check if the message is a system message
      if (messageData.type === 'system') {
        throw new Error('Cannot react to system messages');
      }
      
      // Get the current reactions
      const reactions = messageData.reactions || {};
      
      // Check if the user has already reacted with this emoji
      if (reactions[reaction] && reactions[reaction].includes(currentUser.uid)) {
        // Remove the user's reaction
        reactions[reaction] = reactions[reaction].filter(id => id !== currentUser.uid);
        
        // If no one has reacted with this emoji anymore, remove it
        if (reactions[reaction].length === 0) {
          delete reactions[reaction];
        }
      } else {
        // Add the user's reaction
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }
        reactions[reaction].push(currentUser.uid);
      }
      
      // Update the message
      await updateDoc(messageRef, {
        reactions
      });
      
      return true;
    } catch (err) {
      console.error('Error adding group reaction:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Remove a reaction from a group message
  const removeGroupReaction = async (groupId, messageId, reaction) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        throw new Error('User must be logged in to remove a reaction');
      }

      const messageRef = doc(db, 'Groups', groupId, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Check if the message is a system message
      if (messageData.type === 'system') {
        throw new Error('Cannot react to system messages');
      }
      
      // Get the current reactions
      const reactions = messageData.reactions || {};
      
      // Check if the user has reacted with this emoji
      if (reactions[reaction] && reactions[reaction].includes(currentUser.uid)) {
        // Remove the user's reaction
        reactions[reaction] = reactions[reaction].filter(id => id !== currentUser.uid);
        
        // If no one has reacted with this emoji anymore, remove it
        if (reactions[reaction].length === 0) {
          delete reactions[reaction];
        }
        
        // Update the message
        await updateDoc(messageRef, {
          reactions
        });
      }
      
      return true;
    } catch (err) {
      console.error('Error removing group reaction:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Make a user an admin
  const makeAdmin = async (groupId, memberId) => {
    try {
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      const currentAdmins = groupData.admins || [];
      
      if (currentAdmins.includes(memberId)) {
        return true; // Already an admin
      }
      
      const newAdmins = [...currentAdmins, memberId];
      await updateDoc(groupRef, { admins: newAdmins });
      
      // Add a system message about the new admin
      const membersCollection = collection(db, 'Groups', groupId, 'Messages');
      const userDoc = await getDoc(doc(db, 'Users', memberId));
      const userName = userDoc.exists() ? userDoc.data().name : 'Unknown User';
      
      await addDoc(membersCollection, {
        type: 'system',
        content: `${currentUser.name} made ${userName} an admin`,
        sentAt: serverTimestamp(),
        senderId: currentUser.uid
      });
      
      // Update the local state to reflect changes immediately
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, admins: newAdmins } : group
        )
      );
      
      // If the current group is being updated, update it as well
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(prev => ({ ...prev, admins: newAdmins }));
      }
      
      return true;
    } catch (error) {
      console.error('Error making admin:', error);
      throw error;
    }
  };

  // Remove a user as an admin
  const removeAdmin = async (groupId, memberId) => {
    try {
      const groupRef = doc(db, 'Groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data();
      const currentAdmins = groupData.admins || [];
      
      if (!currentAdmins.includes(memberId)) {
        return true; // Not an admin
      }
      
      // Ensure the creator remains an admin
      if (groupData.creator === memberId) {
        throw new Error('Cannot remove admin status from the group creator');
      }
      
      const newAdmins = currentAdmins.filter(id => id !== memberId);
      await updateDoc(groupRef, { admins: newAdmins });
      
      // Add a system message about the removed admin
      const membersCollection = collection(db, 'Groups', groupId, 'Messages');
      const userDoc = await getDoc(doc(db, 'Users', memberId));
      const userName = userDoc.exists() ? userDoc.data().name : 'Unknown User';
      
      await addDoc(membersCollection, {
        type: 'system',
        content: `${currentUser.name} removed ${userName} as admin`,
        sentAt: serverTimestamp(),
        senderId: currentUser.uid
      });
      
      // Update the local state to reflect changes immediately
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, admins: newAdmins } : group
        )
      );
      
      // If the current group is being updated, update it as well
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(prev => ({ ...prev, admins: newAdmins }));
      }
      
      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      throw error;
    }
  };

  const value = {
    groups,
    loading,
    error,
    indexError,
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    addMembers,
    removeMembers,
    leaveGroup,
    deleteGroup,
    sendGroupMessage,
    getGroupMessages,
    deleteGroupMessage,
    editGroupMessage,
    addGroupReaction,
    removeGroupReaction,
    makeAdmin,
    removeAdmin
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        selectedGroup,
        loading,
        error,
        indexError,
        getGroups,
        createGroup,
        addMembers,
        removeMembers,
        leaveGroup,
        deleteGroup,
        sendGroupMessage,
        getGroupMessages,
        editGroupMessage,
        deleteGroupMessage,
        addGroupReaction,
        removeGroupReaction,
        setSelectedGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
} 