import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import AIChatInterface from '@/components/AIChatInterface';
import { useIsMobile } from '@/hooks/use-mobile';

const FloatingAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen) {
    return (
      <div className={`fixed z-50 ${isMobile ? 'bottom-4 right-4' : 'bottom-6 right-6'}`}>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
        >
          Need Help? Chat with AI
        </Button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className={`fixed z-50 ${isMobile ? 'bottom-4 right-4' : 'bottom-6 right-6'}`}>
        <Card className="w-80 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                AI Assistant
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(false)}
                  className="h-6 w-6 p-0"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 ${
      isMobile 
        ? 'bottom-4 right-4 left-4' 
        : 'bottom-6 right-6'
    }`}>
      <Card className={`shadow-xl flex flex-col ${
        isMobile 
          ? 'h-[80vh] w-full' 
          : 'w-96 h-[600px]'
      }`}>
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              AI Assistant
            </span>
            <div className="flex items-center gap-1">
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-6 w-6 p-0"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="h-full px-4 pb-4">
            <AIChatInterface />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FloatingAIChat;
