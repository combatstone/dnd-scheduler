// components/Navbar.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, provider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
      <Link href="/" className="text-2xl font-bold hover:text-blue-400">
        D&D Scheduler
      </Link>
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user.displayName || user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Login with Google
          </button>
        )}
      </div>
    </nav>
  );
}