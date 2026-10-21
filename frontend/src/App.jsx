import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { TooltipManager } from './components/ui/TooltipManager';
import AppRoutes from './routes/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <TooltipManager />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
