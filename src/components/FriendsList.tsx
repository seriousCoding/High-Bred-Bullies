
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageSquare } from 'lucide-react';
import FriendsManager from './friends/FriendsManager';
import MessagingCenter from './MessagingCenter';

const FriendsList: React.FC = () => {
  const [activeTab, setActiveTab] = useState('friends');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleStartConversation = (friendId: string) => {
    setSelectedConversation(friendId);
    setActiveTab('messages');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Friends & Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Friends
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="friends" className="mt-4">
              <FriendsManager onStartConversation={handleStartConversation} />
            </TabsContent>
            
            <TabsContent value="messages" className="mt-4">
              <MessagingCenter preSelectedConversation={selectedConversation} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FriendsList;
