/**
 * Smart Package Locker - Frontend API Service Layer
 * Communicates directly with Node.js Express Backend
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('smart_locker_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('smart_locker_token', token);
    } else {
      localStorage.removeItem('smart_locker_token');
    }
  }

  getHeaders(isPublic = false) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (!isPublic) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async request(endpoint, options = {}, isPublic = false) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getHeaders(isPublic), ...(options.headers || {}) };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle unauthorized token expiry
        if (response.status === 401 && !isPublic && !endpoint.includes('/auth/login')) {
          this.setToken(null);
          localStorage.removeItem('smart_locker_owner');
          window.location.href = '/login';
        }
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Auth Endpoints
  async login(usernameOrEmail, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password })
    }, true);
    if (data.token) {
      this.setToken(data.token);
      localStorage.setItem('smart_locker_owner', JSON.stringify(data.owner));
    }
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
      localStorage.removeItem('smart_locker_owner');
    }
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Owner Profile & Password
  async getProfile() {
    return this.request('/owner/profile');
  }

  async updateProfile(profileData) {
    return this.request('/owner/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async changePassword(passwordData) {
    return this.request('/owner/password', {
      method: 'PUT',
      body: JSON.stringify(passwordData)
    });
  }

  // Dashboard Telemetry
  async getDashboard() {
    return this.request('/dashboard');
  }

  // Locker Control
  async getLockerStatus() {
    return this.request('/locker/status');
  }

  async lockLocker() {
    return this.request('/locker/lock', { method: 'POST' });
  }

  async unlockLocker() {
    return this.request('/locker/unlock', { method: 'POST' });
  }

  // PIN Management
  async generatePin(durationMinutes = 15) {
    return this.request('/access/generate-pin', {
      method: 'POST',
      body: JSON.stringify({ durationMinutes })
    });
  }

  async getPins() {
    return this.request('/access/pins');
  }

  async revokePin(pinId) {
    return this.request('/access/revoke-pin', {
      method: 'POST',
      body: JSON.stringify({ pinId })
    });
  }

  // Public Delivery Access
  async verifyDeliveryPin(pinCode) {
    return this.request('/public/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pinCode })
    }, true);
  }

  async getCommandStatus(commandId) {
    return this.request(`/public/command-status/${commandId}`, {
      method: 'GET'
    }, true);
  }

  // Parcel Monitoring
  async getParcelStatus() {
    return this.request('/parcels/status');
  }

  async updateParcelSettings(irPolarity) {
    return this.request('/parcels/settings', {
      method: 'PUT',
      body: JSON.stringify({ irPolarity })
    });
  }

  async setParcelIn() {
    return this.request('/parcels/manual-in', {
      method: 'POST'
    });
  }

  async setParcelOut() {
    return this.request('/parcels/manual-out', {
      method: 'POST'
    });
  }

  async getParcelHistory() {
    return this.request('/parcels/history');
  }

  // Security Alerts
  async getSecurityAlerts() {
    return this.request('/alerts');
  }

  async setVibrationControl(enabled) {
    return this.request('/alerts/vibration-control', {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  }

  async acknowledgeAlert(alertId) {
    return this.request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    });
  }

  // History Logs
  async getActivityHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/history${query ? `?${query}` : ''}`);
  }

  // Reminders
  async getReminders() {
    return this.request('/reminders');
  }
}

export const api = new ApiService();
export default api;
