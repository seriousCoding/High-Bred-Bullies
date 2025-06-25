
# Real-Time Puppy Count Synchronization: Investigation & Solution

## 1. The Problem

The puppy availability count displayed on the `LitterCard` components on the homepage and the main litters page was not updating in real-time when a puppy was reserved on the `LitterDetailPage`.

- **Observed Behavior:** A user reserves a puppy, the count on the `LitterDetailPage` updates correctly, but the counts on the homepage and litters page remain unchanged until a full page reload.
- **Root Cause:** The homepage and litters page were listening for real-time changes on the `litters` table. However, reserving a puppy only updated the `puppies` table. The `available_puppies` column in the `litters` table was not being updated, so no real-time event was being broadcast for those pages to listen to. An additional issue was that the frontend logic did not correctly handle cases where a litter with 0 available puppies became available again.

## 2. The Investigation

The investigation revealed a disconnect between the data modification and the real-time listeners.

- The `LitterDetailPage` worked because it was directly subscribed to changes in the `puppies` table for that specific litter.
- The `Index` (homepage) and `LittersPage` components fetch their data from the `litters` table. Without a change event on this table, their data would never be refreshed in real-time.

A simple increment/decrement of the `available_puppies` count directly from the frontend is not a reliable solution, as it can lead to data inconsistencies (race conditions, failed updates, etc.). The source of truth (the database) must be responsible for maintaining data integrity.

## 3. The Solution

A two-part solution was implemented to create a robust, reliable, and efficient real-time update system.

### Part 1: Database Trigger (Backend)

The core of the solution is a PostgreSQL trigger on the `puppies` table.

- **Function (`update_litter_puppy_count`):** A database function was created to accurately recalculate the total number of available puppies for a given litter by querying the `puppies` table (`COUNT(*) WHERE is_available = TRUE`). This is more robust than a simple increment/decrement, as it prevents data from becoming out of sync.
- **Trigger (`on_puppy_change_update_litter_count`):** This trigger is fired `AFTER` any `INSERT`, `DELETE`, or `UPDATE` on the `puppies` table. It calls the function above, ensuring that any change to a puppy's status automatically updates the `available_puppies` count in the corresponding `litters` table row.

This makes the `litters` table's `available_puppies` count a reliable, auto-updating reflection of the state of the `puppies` table.

### Part 2: Real-Time Listeners (Frontend)

With the backend automatically updating the `litters` table, the frontend just needed to listen for those changes.

- **Subscription:** The `Index` and `LittersPage` components were updated to subscribe to `UPDATE` events on the `litters` table using Supabase Realtime.
- **Cache Invalidation:** When an update event is received, the component uses the `queryClient.invalidateQueries` method from React Query. This tells React Query that the cached data for litters is stale and triggers a fresh, automatic re-fetch from the database. This approach is highly robust, as it ensures the list on the page always reflects the exact server state, correctly handling cases where a sold-out litter becomes available again or a newly available litter sells out.

This approach is highly efficient, providing an instantaneous UI update without requiring complex client-side logic.

## 4. Final Result

The combination of a database trigger for data integrity and real-time cache invalidation for UI updates provides a seamless, accurate, and performant user experience. The puppy availability counts are now always in sync across the entire application.
