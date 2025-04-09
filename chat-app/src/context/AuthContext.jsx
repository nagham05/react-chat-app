import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import supabase from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sign up function
  async function signup(email, password, name) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'Users', user.uid), {
        uid: user.uid,
        email,
        name,
        profile_pic: null,
        createdAt: new Date().toISOString()
      });

      return user;
    } catch (error) {
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  }

  // Logout function
  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  }

  // Upload profile picture
  async function uploadProfilePicture(file, userId) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('chat-app')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-app')
        .getPublicUrl(filePath);

      await setDoc(doc(db, 'Users', userId), {
        profile_pic: publicUrl
      }, { merge: true });

      return publicUrl;
    } catch (error) {
      throw error;
    }
  }

  // Upload file to Supabase storage
  const uploadFile = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${currentUser.uid}-${Date.now()}.${fileExt}`;
      const filePath = `chat-files/${uniqueFileName}`;

      const { data, error } = await supabase.storage
        .from('chat-app')
        .upload(filePath, file);

      if (error) {
        throw new Error('Error uploading file: ' + error.message);
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('chat-app')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  // Send message
  async function sendMessage(content, receiverId, type = 'text', fileUrl = null, fileName = null) {
    try {
      const message = {
        content: type === 'file' || type === 'image' ? fileUrl : content,
        receiverId,
        senderId: currentUser.uid,
        sentAt: new Date().toISOString(),
        type,
        ...(type === 'file' && { fileName }),
        ...(type === 'image' && { fileName: fileName || 'image.jpg' })
      };

      await addDoc(collection(db, 'Messages'), message);
      return message;
    } catch (error) {
      throw error;
    }
  }

  // Get messages between two users
  async function getMessages(otherUserId, lastMessage = null, limit = 20) {
    try {
      let q = query(
        collection(db, 'Messages'),
        where('senderId', 'in', [currentUser.uid, otherUserId]),
        where('receiverId', 'in', [currentUser.uid, otherUserId]),
        orderBy('sentAt', 'desc'),
        limit(limit)
      );

      if (lastMessage) {
        q = query(q, startAfter(lastMessage));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw error;
    }
  }

  // Block user
  async function blockUser(blockedId) {
    try {
      const blockedRef = collection(db, 'Blocked');
      await addDoc(blockedRef, {
        blockerId: currentUser.uid,
        blockedId: blockedId,
        blockedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  // Unblock user
  async function unblockUser(blockedId) {
    try {
      const blockedRef = collection(db, 'Blocked');
      const q = query(
        blockedRef,
        where('blockerId', '==', currentUser.uid),
        where('blockedId', '==', blockedId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        await deleteDoc(doc(db, 'Blocked', querySnapshot.docs[0].id));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }

  // Check if user is blocked
  async function isUserBlocked(userId) {
    try {
      const q = query(
        collection(db, 'Blocked'),
        where('blockerId', '==', currentUser.uid),
        where('blockedId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      throw error;
    }
  }

  // Reset password function
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  // Edit message
  const editMessage = async (messageId, newContent) => {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      // Get the message document first
      const messageRef = doc(db, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      // Update the message content and add edited flag
      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    try {
      console.log('deleteMessage called with ID:', messageId);
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      // Get the message document first
      const messageRef = doc(db, 'Messages', messageId);
      console.log('Fetching message document...');
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        console.error('Message document not found');
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      console.log('Message data:', messageData);

      // Delete associated files from Supabase storage based on message type
      if ((messageData.type === 'image' || messageData.type === 'file') && messageData.content) {
        try {
          console.log('Attempting to delete file from storage...');
          // Get the full path from the content URL
          const urlParts = messageData.content.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const folder = messageData.type === 'image' ? 'chat-images' : 'chat-files';
          const filePath = `${folder}/${fileName}`;
          console.log('File path to delete:', filePath);

          const { error } = await supabase.storage
            .from('chat-app')
            .remove([filePath]);
          
          if (error) {
            console.error(`Error deleting ${messageData.type} from storage:`, error);
          } else {
            console.log('File deleted from storage successfully');
          }
        } catch (storageError) {
          console.error(`Error deleting ${messageData.type} from storage:`, storageError);
        }
      }

      // Delete the message document from Firestore
      console.log('Deleting message document from Firestore...');
      await deleteDoc(messageRef);
      console.log('Message document deleted successfully');
    } catch (error) {
      console.error('Error in deleteMessage:', error);
      throw error;
    }
  };

  // Add reaction to message
  const addReaction = async (messageId, reaction) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const messageRef = doc(db, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      const currentReactions = messageData.reactions || {};
      
      // Handle old format where reactions are stored as numbers
      if (typeof currentReactions[reaction] === 'number') {
        // Convert old format to new format
        currentReactions[reaction] = {
          users: [currentUser.uid]
        };
      } else {
        // Initialize the reaction structure if it doesn't exist
        if (!currentReactions[reaction]) {
          currentReactions[reaction] = { users: [] };
        }

        // Ensure the users array exists
        if (!currentReactions[reaction].users) {
          currentReactions[reaction].users = [];
        }

        // Check if user has already reacted with this emoji
        const hasReacted = currentReactions[reaction].users.includes(currentUser.uid);
        
        if (hasReacted) {
          // Remove the reaction if user already reacted
          currentReactions[reaction].users = currentReactions[reaction].users.filter(
            uid => uid !== currentUser.uid
          );
          
          // Remove the reaction if no users have reacted
          if (currentReactions[reaction].users.length === 0) {
            delete currentReactions[reaction];
          }
        } else {
          // Add the user's reaction
          currentReactions[reaction].users.push(currentUser.uid);
        }
      }

      await updateDoc(messageRef, { reactions: currentReactions });
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Remove reaction from message
  const removeReaction = async (messageId, reaction) => {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      // Get the message document first
      const messageRef = doc(db, 'Messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      const currentReactions = messageData.reactions || {};
      
      // Check if the reaction exists and has users array
      if (currentReactions[reaction]?.users?.includes(currentUser.uid)) {
        // Remove the user's reaction
        currentReactions[reaction].users = currentReactions[reaction].users.filter(
          id => id !== currentUser.uid
        );
        
        // If no one has reacted with this emoji anymore, remove it
        if (currentReactions[reaction].users.length === 0) {
          delete currentReactions[reaction];
        }
        
        // Update the message with the new reactions
        await updateDoc(messageRef, {
          reactions: currentReactions
        });
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      const messageRef = doc(db, 'Messages', messageId);
      await updateDoc(messageRef, {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  };

  const getUnreadCount = async (userId) => {
    try {
      const messagesRef = collection(db, 'Messages');
      const q = query(
        messagesRef,
        where('receiverId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      const userRef = doc(db, 'Users', currentUser.uid);
      await updateDoc(userRef, {
        name: profileData.name,
        bio: profileData.bio,
        profile_pic: profileData.profile_pic,
        updatedAt: serverTimestamp()
      });

      // Update local user state
      setCurrentUser(prev => ({
        ...prev,
        ...profileData
      }));
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'Users', user.uid));
        if (userDoc.exists()) {
          setCurrentUser({ ...user, ...userDoc.data() });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    error,
    signup,
    login,
    logout,
    resetPassword,
    updateProfile,
    uploadProfilePicture,
    uploadFile,
    sendMessage,
    getMessages,
    blockUser,
    unblockUser,
    isUserBlocked,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markMessageAsRead,
    getUnreadCount,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 