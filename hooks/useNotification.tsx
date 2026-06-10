import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from '../components/Icons';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    (message: string, type: NotificationType = 'info', duration: number = 5000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setNotifications((prev) => [...prev, { id, message, type, duration }]);

      if (duration !== Infinity) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  const success = useCallback((message: string, duration?: number) => showNotification(message, 'success', duration), [showNotification]);
  const error = useCallback((message: string, duration?: number) => showNotification(message, 'error', duration), [showNotification]);
  const info = useCallback((message: string, duration?: number) => showNotification(message, 'info', duration), [showNotification]);
  const warning = useCallback((message: string, duration?: number) => showNotification(message, 'warning', duration), [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification, success, error, info, warning }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border ${
                notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-50' :
                notification.type === 'error' ? 'bg-rose-900/90 border-rose-500 text-rose-50' :
                notification.type === 'warning' ? 'bg-amber-900/90 border-amber-500 text-amber-50' :
                'bg-zinc-800/90 border-zinc-600 text-zinc-50'
              }`}
            >
              <div className="mt-0.5">
                {notification.type === 'success' && <CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
                {notification.type === 'error' && <AlertCircleIcon className="w-5 h-5 text-rose-400" />}
                {notification.type === 'warning' && <AlertCircleIcon className="w-5 h-5 text-amber-400" />}
                {notification.type === 'info' && <InfoIcon className="w-5 h-5 text-sky-400" />}
              </div>
              <div className="flex-1 text-sm font-medium">
                {notification.message}
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="mt-0.5 text-zinc-400 hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
