
import { useState, useEffect } from "react";
import { Litter } from "@/types";

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

// Fetch a single litter by id and subscribe to real-time updates.
export function useLitterRealtime(litterId: string, initialLitter?: Litter) {
  const [litter, setLitter] = useState<Litter | undefined>(initialLitter);

  // Initial fetch with periodic updates
  useEffect(() => {
    let isMounted = true;
    
    async function fetchLitter() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/litters/${litterId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Error fetching litter:', response.statusText);
          return;
        }

        const data = await response.json();
        if (isMounted && data) setLitter(data as Litter);
      } catch (error) {
        console.error('Error fetching litter:', error);
      }
    }

    fetchLitter();

    // Poll for updates every 30 seconds (replacing real-time subscription)
    const interval = setInterval(fetchLitter, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [litterId]);

  return { litter };
}

