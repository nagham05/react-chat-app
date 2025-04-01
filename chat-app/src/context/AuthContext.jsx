import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  deleteDoc
} from 'firebase/firestore';
import supabase from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    signup,
    login,
    logout,
    uploadProfilePicture,
    sendMessage,
    getMessages,
    blockUser,
    unblockUser,
    isUserBlocked
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 