import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { LogIn, User, UserPlus, RefreshCw, LogOut } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import axios from 'axios';

// --- React Query Client Setup ---
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            refetchOnWindowFocus: true, 
        },
    },
});

// ---------------------------------------------------------------------
// --- HOOK: useMessage (Handles UI notifications) ---
// ---------------------------------------------------------------------
const useMessage = () => {
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'

    const displayMessage = useCallback((msg, type) => {
        setMessage(msg);
        setMessageType(type);
        // Clear message after 5 seconds
        const timeoutId = setTimeout(() => setMessage(''), 5000);
        return () => clearTimeout(timeoutId);
    }, []);

    return { message, messageType, displayMessage };
};

// ---------------------------------------------------------------------
// --- HOOK/UTILITY: useAxiosClient (Handles Interceptors and Refresh) ---
// ---------------------------------------------------------------------

// --- CONFIGURATION ---
const getBaseUrl = () => {
    const localApi = 'http://localhost:4000/authentication';
    // Use an environment variable if available, otherwise default to local
    const envApiUrl = typeof process.env.REACT_APP_API_URL !== 'undefined' ? process.env.REACT_APP_API_URL : localApi;
    return envApiUrl.trim();
};

const API_BASE_URL = `${getBaseUrl()}`;
const TOKEN_KEY = 'authToken';

// --- AXIOS INSTANCE SETUP (Global client) ---
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    // Required to send the HTTP-only Refresh Token cookie
    withCredentials: true, 
});

// Global state for refresh queue management
let isRefreshing = false;
let failedQueue = [];

// Utility to process waiting requests after a successful or failed refresh
const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

/**
 * useAxiosInterceptorClient hook: Handles all network logic, 
 * including token attachment and the complex 401 refresh mechanism.
 */
const useAxiosInterceptorClient = (clearAuthState, displayMessage) => {
    
    // Core function to execute API calls
    const apiCall = useCallback(async (config) => {
        try {
            const response = await axiosInstance.request(config);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            // Throw a simple Error with the processed message
            throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
        }
    }, []);

    // Setup effect for interceptors
    useEffect(() => {
        // Interceptor 1: Attach Access Token to requests
        const requestInterceptor = axiosInstance.interceptors.request.use(config => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        }, error => Promise.reject(error));

        // Interceptor 2: Handle 401 Unauthorized errors and token refresh
        const responseInterceptor = axiosInstance.interceptors.response.use(response => response, async (error) => {
            const originalRequest = error.config;
            
            if (error.response?.status === 401 && !originalRequest._retry) {
                
                // If login or refresh itself failed, just clear auth state
                if (originalRequest.url === '/refresh-token' || originalRequest.url === '/login') {
                    clearAuthState();
                    return Promise.reject(error);
                }

                if (isRefreshing) {
                    // Refresh is in progress, queue this request
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        originalRequest._retry = true;
                        return axiosInstance(originalRequest);
                    }).catch(err => Promise.reject(err));
                }

                // Start the refresh process
                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const refreshResponse = await axiosInstance.post('/refresh-token');
                    const newAccessToken = refreshResponse.data.accessToken;

                    localStorage.setItem(TOKEN_KEY, newAccessToken);
                    isRefreshing = false;
                    processQueue(null, newAccessToken);

                    // Retry the original request
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axiosInstance(originalRequest);
                    
                } catch (refreshError) {
                    // Failed to refresh, clear everything and force re-login
                    isRefreshing = false;
                    processQueue(refreshError);
                    clearAuthState();
                    displayMessage("Session expired. Please log in again.", 'error');
                    return Promise.reject(refreshError); 
                }
            }
            return Promise.reject(error);
        });

        return () => {
            axiosInstance.interceptors.request.eject(requestInterceptor);
            axiosInstance.interceptors.response.eject(responseInterceptor);
        };
    }, [clearAuthState, displayMessage]); 

    return { apiCall };
};

// ---------------------------------------------------------------------
// --- HOOK/CONTEXT: useAuth (Combines all logic) ---
// ---------------------------------------------------------------------

const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

/**
 * useAuthLogic: Manages core authentication state and combines messaging and network logic.
 */
const useAuthLogic = () => {
    const queryClient = useQueryClient();
    const { message, messageType, displayMessage } = useMessage();
    
    // Core Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState(isAuthenticated ? 'profile' : 'login');

    // --- State Manipulation Handlers ---
    
    const setAuthState = useCallback((newAccessToken, userData) => {
        localStorage.setItem(TOKEN_KEY, newAccessToken);
        setIsAuthenticated(true);
        setUser(userData);
        setActiveTab('profile');
    }, []);

    const clearAuthState = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setIsAuthenticated(false);
        setUser(null);
        setActiveTab('login');
        // Invalidate all queries on logout to ensure no stale data remains
        queryClient.clear();
    }, [queryClient]);


    // --- Network Integration ---
    // The Axios interceptor logic needs the state clearing and messaging functions
    const { apiCall } = useAxiosInterceptorClient(clearAuthState, displayMessage);

    // --- Mutations (React Query) ---
    
    // 1. Login Mutation
    const loginMutation = useMutation({
        mutationFn: (credentials) => apiCall({ method: 'POST', url: '/login', data: credentials }),
        onSuccess: (data) => {
            setAuthState(data.accessToken, data.user);
            displayMessage('Login successful! Welcome.', 'success');
        },
        onError: (error) => {
            displayMessage(`Login Failed: ${error.message}`, 'error');
        }
    });

    // 2. Register Mutation
    const registerMutation = useMutation({
        mutationFn: (userData) => apiCall({ method: 'POST', url: '/register', data: userData }),
        onSuccess: () => {
            displayMessage('Registration successful! You can now log in.', 'success');
            setActiveTab('login');
        },
        onError: (error) => {
            displayMessage(`Registration Failed: ${error.message}`, 'error');
        }
    });
    
    // 3. Logout Function (Manual Mutation/Action)
    const handleLogout = useCallback(async () => {
        try {
            // Invalidate session on server first
            await axiosInstance.post('/logout'); 
        } catch (error) {
            console.error("Server logout failed, but clearing local state anyway:", error);
        } finally {
            clearAuthState();
            displayMessage('Logged out successfully.', 'success');
        }
    }, [clearAuthState, displayMessage]);

    // --- Data Fetching (React Query) ---

    // Query for Protected User Profile Data
    const { data: profileData, isLoading: isProfileLoading, refetch: refetchProfile, isError: isProfileError } = useQuery({
        queryKey: ['profile'],
        queryFn: () => apiCall({ method: 'GET', url: '/profile' }),
        enabled: isAuthenticated, // Only run if authenticated
        staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    });
    
    // Effect to update the local 'user' state with fresh data after a successful profile fetch
    useEffect(() => {
        if (profileData?.authenticatedUser) {
            setUser(profileData.authenticatedUser);
        }
    }, [profileData]);


    // --- Exposed Auth Values ---
    return {
        isAuthenticated, 
        user, 
        activeTab, 
        message, 
        messageType,
        setActiveTab,
        handleLogout, 
        displayMessage, 
        apiCall, 
        
        // React Query Status/Functions
        loginMutation,
        registerMutation,
        profileQuery: { profileData, isProfileLoading, refetchProfile, isProfileError },
    };
};

// --- Auth Provider Component ---
const AuthProvider = ({ children }) => {
    const auth = useAuthLogic();

    // The context value must be non-null for components consuming useAuth
    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
};

// ---------------------------------------------------------------------
// --- PRESENTATION COMPONENTS ---
// ---------------------------------------------------------------------

const LoginForm = () => {
    const { loginMutation } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = (data) => {
        loginMutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <input
                    {...register("email", { required: "Email is required" })}
                    type="email"
                    placeholder="Email"
                    className={`w-full p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            
            <div>
                <input
                    {...register("password", { required: "Password is required" })}
                    type="password"
                    placeholder="Password"
                    className={`w-full p-3 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>

            <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md hover:shadow-lg disabled:bg-indigo-400 flex items-center justify-center space-x-2"
            >
                <LogIn size={20} />
                <span>{loginMutation.isPending ? 'Logging In...' : 'Login'}</span>
            </button>
        </form>
    );
};

const RegisterForm = () => {
    const { registerMutation } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = (data) => {
        registerMutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <input
                    {...register("name")}
                    type="text"
                    placeholder="Name (Optional)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 transition duration-150"
                />
            </div>
            
            <div>
                <input
                    {...register("email", { 
                        required: "Email is required",
                        pattern: {
                            value: /^\S+@\S+$/i,
                            message: "Invalid email address"
                        }
                    })}
                    type="email"
                    placeholder="Email"
                    className={`w-full p-3 border rounded-lg focus:ring-green-500 focus:border-green-500 transition duration-150 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            
            <div>
                <input
                    {...register("password", { 
                        required: "Password is required",
                        minLength: {
                            value: 6,
                            message: "Password must be at least 6 characters"
                        }
                    })}
                    type="password"
                    placeholder="Password (Min 6 chars)"
                    className={`w-full p-3 border rounded-lg focus:ring-green-500 focus:border-green-500 transition duration-150 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>
            
            <button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition duration-150 shadow-md hover:shadow-lg disabled:bg-green-400 flex items-center justify-center space-x-2"
            >
                <UserPlus size={20} />
                <span>{registerMutation.isPending ? 'Registering...' : 'Register'}</span>
            </button>
        </form>
    );
};

const ProfileView = () => {
    const { handleLogout, displayMessage, apiCall, profileQuery } = useAuth();
    const { profileData, isProfileLoading, refetchProfile } = profileQuery;
    const [isTestingRefresh, setIsTestingRefresh] = useState(false);
    
    // Manual test function that relies on the apiCall being intercepted/refreshed
    const testRefresh = async () => {
        setIsTestingRefresh(true);
        try {
            const response = await apiCall({ method: 'GET', url: '/profile' });
            displayMessage(`Refresh Test Succeeded! Protected data accessed: ${response.message}`, 'success');
        } catch (error) {
            displayMessage(`Refresh Test Failed: ${error.message}`, 'error');
        } finally {
            setIsTestingRefresh(false);
        }
    };

    if (isProfileLoading) return (
        <p className="text-center text-indigo-600 flex items-center justify-center space-x-2">
            <RefreshCw size={16} className="animate-spin" />
            <span>Loading Profile Data (React Query)...</span>
        </p>
    );

    if (!profileData) return (
        <div className="space-y-4">
            <p className="text-center text-red-500">Could not retrieve profile. 🔄</p>
            <button onClick={() => refetchProfile()} className="w-full p-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                Retry Fetch
            </button>
        </div>
    );

    const user = profileData.authenticatedUser;

    return (
        <div className="space-y-6">
            <div className="space-y-4 bg-gray-50 p-6 rounded-xl shadow-inner border border-gray-200">
                <h3 className="text-xl font-semibold text-indigo-800 flex items-center space-x-2">
                    <User size={20} />
                    <span>Protected Profile Data (Cached by RQ)</span>
                </h3>
                <p className="text-gray-700">{profileData.message}</p>
                <div className="border-t border-gray-200 pt-4 space-y-3">
                    <p><strong>Name:</strong> {user.name || 'N/A'}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p className="text-sm"><strong>User ID (sub):</strong> <span className="bg-gray-200 p-1 rounded font-mono text-xs break-all">{user.sub}</span></p>
                    <p className="text-sm"><strong>Token Issued At:</strong> {new Date(user.iat * 1000).toLocaleString()}</p>
                </div>
            </div>
            
            <button
                onClick={testRefresh}
                disabled={isTestingRefresh}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-150 shadow-md hover:shadow-lg disabled:bg-blue-400 flex items-center justify-center space-x-2"
            >
                <RefreshCw size={20} className={isTestingRefresh ? 'animate-spin' : ''} />
                <span>{isTestingRefresh ? 'Testing Refresh...' : 'Test Auto Token Refresh'}</span>
            </button>
            
            <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
            >
                <LogOut size={20} />
                <span>Logout (Invalidates Tokens)</span>
            </button>
        </div>
    );
};

// Simple reusable button component for tabs
const TabButton = ({ label, tabName, activeTab, setActiveTab, Icon }) => (
    <button
        onClick={() => setActiveTab(tabName)}
        className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition duration-200 ease-in-out flex items-center justify-center space-x-1 ${
            activeTab === tabName 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-gray-700 hover:bg-gray-300'
        }`}
    >
        <Icon size={16} />
        <span>{label}</span>
    </button>
);


// ---------------------------------------------------------------------
// --- MAIN APP COMPONENT (Router/Layout) ---
// ---------------------------------------------------------------------
const AuthRouter = () => {
    // IMPORTANT: useAuth() MUST be called inside the AuthProvider wrapper.
    const { isAuthenticated, activeTab, message, messageType, setActiveTab } = useAuth(); 

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
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 flex items-center justify-center space-x-3">
                    <User size={28} className="text-indigo-600" />
                    <span>Secure Auth Demo (RQ + RHF)</span>
                </h1>
                
                {/* Message Box */}
                {message && (
                    <div 
                        className={`p-4 mb-6 rounded-xl text-sm font-medium transition duration-300 shadow-lg ${
                            messageType === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 'bg-red-100 text-red-800 border-l-4 border-red-500'
                        }`}
                        role="alert"
                    >
                        {message}
                    </div>
                )}

                {/* Tab Navigation (Only show if not authenticated) */}
                {!isAuthenticated && (
                    <div className="flex justify-center space-x-2 mb-8 p-1 bg-gray-200 rounded-full shadow-inner">
                        <TabButton 
                            label="Login" 
                            tabName="login" 
                            activeTab={activeTab} 
                            setActiveTab={setActiveTab}
                            Icon={LogIn}
                        />
                        <TabButton 
                            label="Register" 
                            tabName="register" 
                            activeTab={activeTab} 
                            setActiveTab={setActiveTab}
                            Icon={UserPlus}
                        />
                    </div>
                )}

                {/* Content Area */}
                {renderContent()}

                <p className="mt-8 text-xs text-center text-gray-500 border-t pt-4">
                    API Base URL: <span className="font-mono break-all text-indigo-700 font-semibold">{API_BASE_URL}</span>
                    <br/>
                    Structure: **React Query Provider** wraps **Auth Provider** which manages state via **`useAuthLogic`**.
                </p>
            </div>
        </div>
    );
};


// The Root App component that provides context wrappers
const App = () => (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
            <AuthRouter />
        </AuthProvider>
    </QueryClientProvider>
);

export default App;