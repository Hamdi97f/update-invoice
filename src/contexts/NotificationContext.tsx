import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationContextType {
  showNotification: (message: string, type?: Notification['type']) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = { id, message, type };
    setNotifications((prev) => [...prev, newNotification]);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`relative flex items-center p-4 rounded-lg shadow-lg min-w-[300px] max-w-sm transition-all duration-300 ease-out transform animate-in slide-in-from-right ${
              notif.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
              notif.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
              notif.type === 'info' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
              'bg-yellow-50 border border-yellow-200 text-yellow-800'
            }`}
          >
            {notif.type === 'success' && <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0" />}
            {notif.type === 'error' && <AlertCircle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0" />}
            {notif.type === 'info' && <Info className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" />}
            {notif.type === 'warning' && <AlertTriangle className="w-5 h-5 mr-3 text-yellow-600 flex-shrink-0" />}
            
            <p className="text-sm font-medium flex-1">{notif.message}</p>
            <button 
              onClick={() => removeNotification(notif.id)} 
              className="ml-4 text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};