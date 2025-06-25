
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Heart, UserPlus, CheckCircle, Lock, Crown } from 'lucide-react';

interface HighTableNavCardProps {
  isPetOwner: boolean;
}

const HighTableNavCard = ({ isPetOwner }: HighTableNavCardProps) => {
  return (
    <Card className={`mb-8 ${isPetOwner ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPetOwner ? (
            <>
              <Crown className="h-5 w-5 text-yellow-600" />
              High Table Community
              <CheckCircle className="h-5 w-5 text-green-600" />
            </>
          ) : (
            <>
              <Lock className="h-5 w-5 text-gray-500" />
              High Table Community
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Exclusive</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPetOwner ? (
          <>
            <p className="text-sm text-muted-foreground">
              Welcome to the exclusive High Table community! You have full access to connect with fellow pet owners.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span>Share stories & posts</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                <span>Connect with pet owners</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-500" />
                <span>Direct messaging</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span>Exclusive events</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link to="/high-table">
                  <Heart className="h-4 w-4" />
                  View Feed
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link to="/high-table">
                  <Users className="h-4 w-4" />
                  Find Friends
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2">
                <Link to="/high-table">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              High Table is an exclusive community for pet owners. Purchase a pet to unlock access to this premium feature.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm opacity-60">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <span>Share pet stories</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <span>Connect with owners</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <span>Private messaging</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <span>Exclusive events</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button asChild>
                <Link to="/litters">Browse Available Pets</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/high-table">Preview Community</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HighTableNavCard;
