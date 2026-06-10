import React, { useState, useCallback, useContext, useEffect } from 'react';
import { User } from '../types';
import { sheets as googleSheetsService } from '../services/googleSheetsService';

// This custom hook manages the entire authentication flow.
export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true); // Used for initial loading check

    // Check for a logged-in user in sessionStorage on initial load
    useEffect(() => {
        setIsAuthLoading(true);
        try {
            const storedUser = sessionStorage.getItem('cdoCurrentUser');
            if (storedUser) {
                setCurrentUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error("Failed to parse stored user:", error);
            sessionStorage.removeItem('cdoCurrentUser');
        } finally {
            setIsAuthLoading(false);
        }
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        setIsAuthLoading(true);
        try {
            const user = await googleSheetsService.login(username, password);
            if (!user) {
                // If the service returns null, it means login failed (e.g., wrong credentials).
                // We must throw an error here to be caught by the Login component's UI.
                throw new Error('Usuario o contraseña incorrectos.');
            }
            setCurrentUser(user);
            sessionStorage.setItem('cdoCurrentUser', JSON.stringify(user));
        } catch (error) {
             setIsAuthLoading(false);
             // Re-throw to be displayed in the UI.
             throw error;
        }
        setIsAuthLoading(false);
    }, []);

    const logout = useCallback(async () => {
        setIsAuthLoading(true);
        // Clear client-side session.
        setCurrentUser(null);
        sessionStorage.removeItem('cdoCurrentUser');
        setIsAuthLoading(false);
        // The state update will cause ProtectedRoute to redirect to the login page automatically.
        // A page reload is not necessary and can be unreliable in an iframe.
    }, []);

    const getUsers = useCallback(async (): Promise<User[]> => {
        return await googleSheetsService.getUsers();
    }, []);

    const addUser = useCallback(async (user: User) => {
        return await googleSheetsService.addUser(user);
    }, []);

    const updateUser = useCallback(async (user: User) => {
        return await googleSheetsService.updateUser(user);
    }, []);

    const deleteUser = useCallback(async (username: string) => {
        return await googleSheetsService.deleteUser(username);
    }, []);
    

    return {
        currentUser,
        isAuthLoading,
        login,
        logout,
        getUsers,
        addUser,
        updateUser,
        deleteUser,
    };
};

// Context to provide auth state and functions across the app
interface AuthContextType extends ReturnType<typeof useAuth> {}
export const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};