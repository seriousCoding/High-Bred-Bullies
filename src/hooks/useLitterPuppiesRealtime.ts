
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Puppy } from "@/types";

/**
 * Returns live list of puppies for a litter, with realtime updates.
 * @param litterId 
 */
export function useLitterPuppiesRealtime(litterId: string) {
  const [puppies, setPuppies] = useState<Puppy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    async function fetchPuppies() {
      const { data, error } = await supabase
        .from("puppies")
        .select("*")
        .eq("litter_id", litterId);

      if (!error && isMounted && data) {
        setPuppies(data as Puppy[]);
      }
      setIsLoading(false);
    }
    fetchPuppies();
    return () => { isMounted = false; };
  }, [litterId]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-puppies-list-${litterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puppies",
          filter: `litter_id=eq.${litterId}`,
        },
        (payload) => {
          setPuppies((prev) => {
            const { old: oldRow, new: newRow, eventType } = payload;

            // Type guards
            const hasId = (row: any): row is { id: string } =>
              row && typeof row.id === "string";

            switch (eventType) {
              case "INSERT":
                if (hasId(newRow) && !prev.find((p) => p.id === newRow.id)) {
                  return [...prev, newRow as Puppy];
                }
                return prev;
              case "UPDATE":
                if (hasId(newRow)) {
                  return prev.map((p) => p.id === newRow.id ? { ...p, ...newRow } : p);
                }
                return prev;
              case "DELETE":
                if (hasId(oldRow)) {
                  return prev.filter((p) => p.id !== oldRow.id);
                }
                return prev;
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [litterId]);

  // Convenience
  const availableCount = puppies.filter(p => p.is_available).length;
  const reservedCount = puppies.length - availableCount;

  return { puppies, availableCount, reservedCount, isLoading };
}
