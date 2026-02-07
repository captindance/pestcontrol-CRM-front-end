import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import EmailVerification from './components/EmailVerification.jsx';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>
);
