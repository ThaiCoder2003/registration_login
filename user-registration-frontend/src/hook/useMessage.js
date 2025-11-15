import { useState, useCallback } from 'react';

export const useMessage = () => {
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'

    const displayMessage = useCallback((msg, type) => {
        setMessage(msg);
        setMessageType(type);
        const timeoutId = setTimeout(() => setMessage(''), 5000);
        return () => clearTimeout(timeoutId);
    }, []);

    return { message, messageType, displayMessage };
};