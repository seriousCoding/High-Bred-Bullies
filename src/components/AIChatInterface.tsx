
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MapPin, MessageCircle, Users, Stethoscope, Trees, Heart, Calendar, Phone } from 'lucide-react';
const API_BASE_URL = window.location.origin;
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const AIChatInterface = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "👋 Hi! I'm your High Bred Bullies assistant. I can help you with:\n\n🏆 **High Table Community** - How to post, connect with other pet owners\n💬 **Breeder Questions** - What to ask, red flags to watch for\n📍 **Local Pet Services** - Find vets, dog parks, training centers\n🐕 **Pet Care Tips** - Health, training, and care advice\n📅 **Pickup & Delivery** - Scheduling and logistics help\n\nWhat can I help you with today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('');
  const [breederContact, setBreederContact] = useState(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch breeder contact information for authenticated users
    const fetchBreederContact = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('order_breeder_contacts')
          .select('*')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        if (data && !error) {
          setBreederContact(data);
        }
      } catch (error) {
        console.log('No breeder contact found or user has no orders');
      }
    };

    fetchBreederContact();
  }, [user]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await response.json();
            const location = `${data.city}, ${data.principalSubdivision}`;
            setUserLocation(location);
            toast.success(`Location detected: ${location}`);
          } catch (error) {
            console.error('Error getting location:', error);
            toast.error('Could not detect location automatically');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Please enter your location manually');
        }
      );
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setConversationHistory(prev => [...prev, { role: 'user', content: inputMessage }]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: inputMessage,
          userLocation,
          conversationHistory,
          breederContact,
          context: 'high_bred_bullies_assistant'
        }
      });

      if (error) throw error;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: data.response }]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Provide a helpful fallback response instead of just showing an error
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble connecting to my AI service right now. Here are some quick answers to common questions:\n\n**High Table Posting:** Only pet owners can create posts. Sign in and purchase a pet to unlock community features.\n\n**Finding Breeders:** Look for verified breeders, ask about health testing, and request to meet the parents.\n\n**Local Services:** Try searching '[your city] veterinarian' or '[your city] dog park' online.\n\nPlease try your question again in a moment!",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      toast.error('Connection issue - provided fallback response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: 'High Table Help', icon: Users, message: 'How do I use High Table to connect with other pet owners?' },
    { label: 'Breeder Questions', icon: MessageCircle, message: 'What important questions should I ask a breeder?' },
    { label: 'Find Vets', icon: Stethoscope, message: 'Help me find veterinarians near me' },
    { label: 'Dog Parks', icon: Trees, message: 'Find dog parks and pet-friendly areas nearby' },
    { label: 'Pet Care Tips', icon: Heart, message: 'Give me tips for caring for my new puppy' },
    { label: 'Pickup Help', icon: Calendar, message: 'Help me understand the pickup and delivery process' }
  ];

  return (
    <div className="flex flex-col h-full max-h-full">
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {userLocation ? (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <MapPin className="h-2 w-2" />
              {userLocation}
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={getUserLocation}
              className="flex items-center gap-1 text-xs h-6"
            >
              <MapPin className="h-2 w-2" />
              Detect Location
            </Button>
          )}
          {breederContact && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Phone className="h-2 w-2" />
              Breeder Contact Available
            </Badge>
          )}
        </div>
        <Input
          placeholder="Enter your city and state (e.g., Austin, TX)..."
          value={userLocation}
          onChange={(e) => setUserLocation(e.target.value)}
          className="text-xs h-8"
        />
      </div>

      <div className="flex-1 mb-3 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-2 ${
                    message.isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-xs">
                    {message.content}
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-2 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-2 flex-shrink-0">
        <div className="grid grid-cols-2 gap-1">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => setInputMessage(action.message)}
              className="flex items-center gap-1 text-xs h-7"
            >
              <action.icon className="h-2 w-2" />
              {action.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about pets, breeders, or local services..."
            disabled={isLoading}
            className="flex-1 text-xs h-8"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatInterface;
