import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth, googleProvider } from "../services/firebase";
import {
  createOrUpdateUserProfile,
  getUserProfile,
} from "../services/firestoreService";
import { clearOnboardingPending } from "../utils/onboardingSession";

const AuthContext = createContext(null);

const PROFILE_CACHE_KEY = "breakdownAssistProfileCache";

/* ---------------- CACHE ---------------- */

const readCachedProfile = (uid) => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.uid === uid) return parsed.profile;

    return null;
  } catch {
    return null;
  }
};

const writeCachedProfile = (uid, profile) => {
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ uid, profile })
    );
  } catch {}
};

const clearCachedProfile = () => {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {}
};

/* ---------------- PROVIDER ---------------- */

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(undefined);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setProfile(null);
        clearCachedProfile();
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      const cached = readCachedProfile(user.uid);

      if (cached) {
        setProfile(cached);
      }

      try {
        const firestoreProfile = await getUserProfile(user.uid);

        if (firestoreProfile) {
          setProfile(firestoreProfile);
          writeCachedProfile(user.uid, firestoreProfile);
          if (firestoreProfile.role) {
            clearOnboardingPending(user.uid);
          }
        } else {
          setProfile(cached ?? null);
        }
      } catch (err) {
        console.error("Profile fetch failed:", err);

        if (cached) {
          setProfile(cached);
        } else {
          setProfile(null);
        }
      }

      setLoading(false);
      setProfileLoading(false);
    });

    return unsubscribe;
  }, []);

  /* ---------------- AUTH METHODS ---------------- */

  const signUpWithEmail = async (email, password) => {
    await setPersistence(auth, browserLocalPersistence);
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithEmail = async (email, password) => {
    await setPersistence(auth, browserLocalPersistence);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const existing = await getUserProfile(user.uid);

    if (!existing) {
      await createOrUpdateUserProfile(user.uid, {
        name: user.displayName || "Google User",
        email: user.email,
        role: null,
      });
    }

    return {
      result,
      needsRoleSelection: !existing?.role,
    };
  };

  const logout = async () => {
    clearCachedProfile();
    return signOut(auth);
  };

  const refreshProfile = async (uid) => {
    setProfileLoading(true);

    const userId = uid || currentUser?.uid;

    if (!userId) return;

    const firestoreProfile = await getUserProfile(userId);

    setProfile(firestoreProfile);

    if (firestoreProfile) {
      writeCachedProfile(userId, firestoreProfile);
      if (firestoreProfile.role) {
        clearOnboardingPending(userId);
      }
    }

    setProfileLoading(false);

    return firestoreProfile;
  };

  const value = useMemo(
    () => ({
      currentUser,
      profile,
      loading,
      profileLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      logout,
      refreshProfile,
    }),
    [currentUser, profile, loading, profileLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
