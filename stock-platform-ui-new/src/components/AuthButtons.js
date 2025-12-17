import React, { useState, useEffect } from 'react';
import { signInWithGitHub, signOutUser, onAuthChange } from '../services/supabase-auth-service';

function AuthButtons() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => setCurrentUser(user));
    return () => unsubscribe(); 
  }, []);

  if (currentUser) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-300">
          {currentUser.user_metadata?.full_name || currentUser.email}님
        </span>
        <button onClick={signOutUser} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">
          Logout
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signInWithGitHub} 
      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
    >
      Sign in with GitHub
    </button>
  );
}

export default AuthButtons;