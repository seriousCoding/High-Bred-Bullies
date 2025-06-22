
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallPromptProps {
  onDismiss: () => void;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
  const { installApp } = usePWA();

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Install High Bred Bullies</h3>
              <p className="text-xs text-muted-foreground">Get quick access from your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={installApp} className="text-xs">
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAInstallPrompt;
