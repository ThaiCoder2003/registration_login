import { useEffect, useCallback } from 'react';
import axios from 'axios';

// --- CONFIGURATION ---
const getBaseUrl = () => {
    const localApi = 'http://localhost:4000/authentication';
    // Use the standard CRA environment variable access pattern (process.env)
    const envApiUrl = typeof process.env.REACT_APP_API_URL !== 'undefined' ? process.env.REACT_APP_API_URL : localApi;
    return envApiUrl.trim();
};

const API_BASE_URL = `${getBaseUrl()}`;
export const TOKEN_KEY = 'authToken';

// --- AXIOS INSTANCE SETUP (Global client) ---
export const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
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

export const useAxiosInterceptorClient = (clearAuthState, displayMessage) => {
    
    const apiCall = useCallback(async (config) => {
        try {
            const response = await axiosInstance.request(config);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
        }
    }, []);

    useEffect(() => {
        const requestInterceptor = axiosInstance.interceptors.request.use(config => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        }, error => Promise.reject(error));

        const responseInterceptor = axiosInstance.interceptors.response.use(response => response, async (error) => {
            const originalRequest = error.config;
            
            if (error.response?.status === 401 && !originalRequest._retry) {
                
                if (originalRequest.url === '/refresh-token' || originalRequest.url === '/login') {
                    clearAuthState();
                    return Promise.reject(error);
                }

                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        originalRequest._retry = true;
                        return axiosInstance(originalRequest);
                    }).catch(err => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const refreshResponse = await axiosInstance.post('/refresh-token');
                    const newAccessToken = refreshResponse.data.accessToken;

                    localStorage.setItem(TOKEN_KEY, newAccessToken);
                    isRefreshing = false;
                    processQueue(null, newAccessToken);

                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axiosInstance(originalRequest);
                    
                } catch (refreshError) {
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