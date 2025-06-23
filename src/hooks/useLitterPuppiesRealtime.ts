
import { useState, useEffect } from "react";
import { Puppy } from "@/types";

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

/**
 * Returns live list of puppies for a litter, with realtime updates.
 * @param litterId 
 */
export function useLitterPuppiesRealtime(litterId: string) {
  const [puppies, setPuppies] = useState<Puppy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch with periodic updates
  useEffect(() => {
    let isMounted = true;
    
    async function fetchPuppies() {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/litters/${litterId}/puppies`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Error fetching puppies:', response.statusText);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        if (isMounted && data) {
          // Ensure data is an array before setting
          const puppiesArray = Array.isArray(data) ? data : [];
          setPuppies(puppiesArray as Puppy[]);
        }
      } catch (error) {
        console.error('Error fetching puppies:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPuppies();

    // Poll for updates every 30 seconds (replacing real-time subscription)
    const interval = setInterval(fetchPuppies, 30000);

    return () => { 
      isMounted = false;
      clearInterval(interval);
    };
  }, [litterId]);

  // Convenience with null safety
  const availableCount = puppies?.filter(p => p.is_available).length || 0;
  const reservedCount = (puppies?.length || 0) - availableCount;

  return { puppies, availableCount, reservedCount, isLoading };
}
