import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="auth-loading">
        Chargement...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="p-8 text-center" data-testid="forbidden-page">
        <h2 className="text-2xl font-bold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">Vous n'avez pas les droits pour cette page.</p>
      </div>
    );
  }
  return children;
}
