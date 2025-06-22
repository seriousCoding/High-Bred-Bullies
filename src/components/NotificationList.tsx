
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  type: string;
}

export default function NotificationList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["user-notifications", user?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Mark notification as read
  const readMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications", user?.id] });
    },
  });

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications", user?.id] });
      toast.success("Notification deleted");
    },
    onError: () => {
      toast.error("Failed to delete notification");
    },
  });

  const handleDelete = (notifId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteMutation.mutate(notifId);
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="mb-8 bg-white border shadow transition-all">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <Bell className="text-primary w-5 h-5" />
        <CardTitle className="text-lg">Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading notifications...</div>
        ) : isError ? (
          <div className="text-red-500 text-sm">Failed to load notifications.</div>
        ) : notifications && notifications.length === 0 ? (
          <div className="text-muted-foreground text-sm">No notifications yet.</div>
        ) : (
          <ul className="space-y-2">
            {notifications?.map((notif) => (
              <li
                key={notif.id}
                className={`rounded-md px-3 py-2 cursor-pointer relative group ${
                  notif.is_read
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 border-l-4 border-primary"
                }`}
                onClick={() => {
                  if (!notif.is_read) readMutation.mutate(notif.id);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-base">{notif.title}</div>
                    <div className="text-sm">{notif.message}</div>
                    <div className="text-xs text-right text-muted-foreground">
                      {new Date(notif.created_at).toLocaleString()}
                      {notif.is_read ? " · Read" : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                    onClick={(e) => handleDelete(notif.id, e)}
                    disabled={deleteMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
