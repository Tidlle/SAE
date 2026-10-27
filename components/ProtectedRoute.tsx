import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isFirstAccessPending } from '../lib/session';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isAuthenticated = localStorage.getItem('usuarioAutenticado') === 'true';
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect to login but save the attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Conta nova: nenhuma tela abre antes de assinar o termo
    if (isFirstAccessPending()) {
        return <Navigate to="/primeiro-acesso" replace />;
    }

    return <>{children}</>;
};
