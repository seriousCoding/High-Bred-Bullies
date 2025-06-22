
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Litter } from "@/types";

// Fetch a single litter by id and subscribe to real-time updates.
export function useLitterRealtime(litterId: string, initialLitter?: Litter) {
  const [litter, setLitter] = useState<Litter | undefined>(initialLitter);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchLitter() {
      const { data, error } = await supabase
        .from("litters")
        .select(
          `
          id,
          name,
          breed,
          birth_date,
          available_puppies,
          total_puppies,
          price_per_male,
          price_per_female,
          image_url,
          dam_image_url,
          sire_image_url,
          breeders (
            business_name
          )
        `
        )
        .eq("id", litterId)
        .maybeSingle();
      if (error) {
        // Optionally handle the error!
        return;
      }
      if (isMounted && data) setLitter(data as Litter);
    }
    fetchLitter();
    return () => {
      isMounted = false;
    };
  }, [litterId]);

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-littercard-${litterId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "litters",
          filter: `id=eq.${litterId}`,
        },
        (payload) => {
          // payload.new is the updated litter
          setLitter((prev) =>
            prev
              ? { ...prev, ...payload.new }
              : ((payload.new as Litter) ?? prev)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [litterId]);

  return { litter };
}

