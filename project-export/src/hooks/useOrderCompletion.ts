
import { useEffect } from 'react';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

export const useOrderCompletion = () => {
  useEffect(() => {
    // For now, we remove the real-time order completion monitoring
    // This functionality can be reimplemented with polling if needed
    // or handled server-side when orders are marked as completed
    
    console.log('Order completion monitoring initialized (JWT mode)');

    return () => {
      console.log('Order completion monitoring cleanup');
    };
  }, []);
};
