import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LockerProvider } from './context/LockerContext';
import Layout from './components/layout/Layout';

// Redesigned Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LockerControl from './pages/LockerControl';
import ParcelMonitoring from './pages/ParcelMonitoring';
import GeneratePIN from './pages/GeneratePIN';
import DeliveryQRLink from './pages/DeliveryQRLink';
import DeliveryAccess from './pages/DeliveryAccess';
import SecurityMonitoring from './pages/SecurityMonitoring';
import ActivityHistory from './pages/ActivityHistory';
import AccountSettings from './pages/AccountSettings';

export default function App() {
  return (
    <LockerProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Owner Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Public Delivery Courier Access Route (NO LOGIN REQUIRED) */}
          <Route path="/delivery-access" element={<DeliveryAccess />} />

          {/* Protected Owner Management Portal Shell */}
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/locker-control" element={<LockerControl />} />
            <Route path="/parcel-monitoring" element={<ParcelMonitoring />} />
            <Route path="/generate-pin" element={<GeneratePIN />} />
            <Route path="/delivery-qr" element={<DeliveryQRLink />} />
            <Route path="/security-monitoring" element={<SecurityMonitoring />} />
            <Route path="/activity-history" element={<ActivityHistory />} />
            <Route path="/account-settings" element={<AccountSettings />} />

            {/* Backwards-compatibility redirects */}
            <Route path="/access" element={<Navigate to="/locker-control" replace />} />
            <Route path="/parcel" element={<Navigate to="/parcel-monitoring" replace />} />
            <Route path="/security" element={<Navigate to="/security-monitoring" replace />} />
            <Route path="/buzzer" element={<Navigate to="/security-monitoring" replace />} />
            <Route path="/reminders" element={<Navigate to="/parcel-monitoring" replace />} />
            <Route path="/history" element={<Navigate to="/activity-history" replace />} />
            <Route path="/settings" element={<Navigate to="/account-settings" replace />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </LockerProvider>
  );
}
