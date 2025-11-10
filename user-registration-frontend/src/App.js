import React, { useState, useEffect, useCallback } from 'react';

// Get base URL from environment (Vercel injected) or fallback to local
const getBaseUrl = () => {
  const localApi = 'http://localhost:4000/authentication';
  const envApiUrl = import.meta.env?.API_URL;
  const env = import.meta.env?.NODE_ENV || 'development';
  return envApiUrl?.trim() || localApi;
};

// Base URL for the NestJS API (excluding the /authentication endpoint path)
const API_BASE_URL = `${getBaseUrl()}`;
const TOKEN_KEY = 'authToken';

// --- ICONS ---

// --- Main App ---
const App = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Function to set message and clear it after a delay
  const displayMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  // Check auth state on load
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Basic check, ideally you'd validate the token with a dedicated endpoint
      setIsAuthenticated(true);
      setActiveTab('profile');
    }
  }, []);

  // Centralized API call utility (Memoized)
  const apiCall = useCallback(async (endpoint, method, data = null, needsAuth = false) => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (needsAuth && currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: method,
        headers: headers,
        body: data ? JSON.stringify(data) : null,
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle NestJS validation errors (array of strings) or general errors
        const errorMsg = responseData.message || 'An unknown error occurred.';
        throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
      }

      return responseData;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setActiveTab('login');
    displayMessage('Logged out successfully.', 'success');
  };
  
  // --- FORM COMPONENTS ---

  const LoginForm = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        const response = await apiCall('login', 'POST', formData);
        
        // Save token and update state
        localStorage.setItem(TOKEN_KEY, response.accessToken);
        setIsAuthenticated(true);
        setUser(response.user);
        setActiveTab('profile');
        displayMessage('Login successful! Welcome.', 'success');
      } catch (error) {
        displayMessage(`Login Failed: ${error.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          required
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
          required
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400"
        >
          {isLoading ? 'Logging In...' : 'Login'}
        </button>
      </form>
    );
  };

  const RegisterForm = () => {
    const [formData, setFormData] = useState({ email: '', password: '', name: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        await apiCall('register', 'POST', formData);
        displayMessage('Registration successful! You can now log in.', 'success');
        setActiveTab('login');
      } catch (error) {
        displayMessage(`Registration Failed: ${error.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Name (Optional)"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          required
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password (Min 6 chars)"
          required
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition duration-150 disabled:bg-green-400"
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>
    );
  };

  const ProfileView = () => {
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await apiCall('profile', 'GET', null, true);
        setProfileData(response);
        if (!user) setUser(response.user); // only update if needed
      } catch (error) {
        displayMessage(`Failed to load profile: ${error.message}. Please log in again.`, 'error');
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };
    
    useEffect(() => {
      if (isAuthenticated) {
        fetchProfile();
      }
    }, [isAuthenticated]); // Rerun when authenticated state changes

    if (isLoading) return <p className="text-center text-indigo-600">Loading Profile...</p>;
    if (!profileData) return <p className="text-center text-red-500">Could not retrieve profile. Log out and try again.</p>;

    return (
      <div className="space-y-4 bg-gray-50 p-6 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-indigo-800">Protected Data Access</h3>
        <p className="text-gray-700">{profileData.message}</p>
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <p><strong>Name:</strong> {profileData.authenticatedUser.name || 'N/A'}</p>
          <p><strong>Email:</strong> {profileData.authenticatedUser.email}</p>
          <p><strong>User ID:</strong> <span className="text-sm bg-gray-200 p-1 rounded break-all">{profileData.authenticatedUser.sub}</span></p>
          <p><strong>Joined:</strong> {new Date(profileData.authenticatedUser.iat * 1000).toLocaleDateString()}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition duration-150"
        >
          Logout
        </button>
      </div>
    );
  };

  const renderContent = () => {
    if (isAuthenticated) {
      return <ProfileView />;
    }
    
    switch (activeTab) {
      case 'login':
        return <LoginForm />;
      case 'register':
        return <RegisterForm />;
      default:
        return <LoginForm />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border-t-4 border-indigo-600">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Full-Stack Auth Demo
        </h1>
        
        {/* Message Box */}
        {message && (
          <div 
            className={`p-3 mb-4 rounded-lg text-sm ${
              messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
            role="alert"
          >
            {message}
          </div>
        )}

        {/* Tab Navigation */}
        {!isAuthenticated && (
          <div className="flex justify-center space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('login')}
              className={`py-2 px-4 rounded-full text-sm font-medium transition duration-150 ${
                activeTab === 'login' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`py-2 px-4 rounded-full text-sm font-medium transition duration-150 ${
                activeTab === 'register' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Content Area */}
        {renderContent()}

        <p className="mt-6 text-xs text-center text-gray-500 border-t pt-4">
            API Base URL: <span className="font-mono break-all">{API_BASE_URL}</span>
            <br/>
            (Configured for Vercel Frontend ↔ Render Backend)
        </p>
      </div>
    </div>
  );
};

export default App;
