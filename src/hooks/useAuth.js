import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfessor, setIsProfessor] = useState(false);
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Check if this user is a professor
        try {
          const profRef = doc(db, 'professors', firebaseUser.email);
          const profSnap = await getDoc(profRef);
          if (profSnap.exists()) {
            const data = profSnap.data();
            setIsProfessor(true);
            setPermissions(data.profile?.permissions || null);
          } else {
            setIsProfessor(false);
            setPermissions(null);
          }
        } catch (err) {
          console.error('Error checking professor status:', err);
          setIsProfessor(false);
          setPermissions(null);
        }
      } else {
        setUser(null);
        setIsProfessor(false);
        setPermissions(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = () => signInWithPopup(auth, googleProvider);
  const signOut = () => firebaseSignOut(auth);

  return { user, loading, isProfessor, permissions, signIn, signOut };
}
