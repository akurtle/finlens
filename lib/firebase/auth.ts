"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";
import type { UserSession } from "@/lib/types";

export function subscribeUserSession(
  onChange: (session: UserSession | null) => void,
  onReady?: () => void
) {
  const auth = getFirebaseAuth();

  if (!auth) {
    onChange(null);
    onReady?.();
    return () => undefined;
  }

  return onAuthStateChanged(auth, (user) => {
    onChange(user ? toSession(user) : null);
    onReady?.();
  });
}

export async function ensureSignedIn() {
  const auth = getFirebaseAuth();

  if (!auth) {
    return null;
  }

  if (auth.currentUser) {
    return toSession(auth.currentUser);
  }

  const credential = await signInAnonymously(auth);
  return toSession(credential.user);
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();

  if (!auth) {
    return null;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return toSession(credential.user);
}

export async function signOutUser() {
  const auth = getFirebaseAuth();

  if (!auth) {
    return;
  }

  await signOut(auth);
}

function toSession(user: User): UserSession {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName,
    email: user.email,
    providerId: user.providerData[0]?.providerId ?? null
  };
}
