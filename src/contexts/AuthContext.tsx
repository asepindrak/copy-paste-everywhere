"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "next-auth/react";

type AuthContextType = {
  isAuthenticated: boolean;
  user: any;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: status === "authenticated",
        user: session?.user,
        isLoading: status === "loading",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
