
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Dog, Calendar, Building, Heart, XCircle, Clock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Litter } from "@/types";
import { useLitterRealtime } from "@/hooks/useLitterRealtime";
import { useLitterPuppiesRealtime } from "@/hooks/useLitterPuppiesRealtime";

const LitterCard = ({ litter }: { litter: Litter }) => {
  // Use the real-time litter info
  const { litter: liveLitter } = useLitterRealtime(litter.id, litter);

  // Get real-time puppy counts for dynamic availability/reserved display
  const { availableCount, reservedCount, isLoading: isLoadingPuppies } = useLitterPuppiesRealtime(litter.id);

  if (!liveLitter) {
    // Optionally render a fallback UI
    return (
      <Card className="flex flex-col h-full overflow-hidden opacity-50">
        <div className="flex items-center justify-center h-48 bg-muted w-full">
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
        <CardHeader>
          <CardTitle className="text-xl font-bold font-['Playfair_Display']">Loading...</CardTitle>
        </CardHeader>
        <CardContent />
        <CardFooter />
      </Card>
    );
  }

  const birthDate = new Date(liveLitter.birth_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const minPrice = Math.min(liveLitter.price_per_male, liveLitter.price_per_female) / 100;
  const placeholderUrl = `https://placehold.co/400x300/e2e8f0/64748b?text=${encodeURIComponent(liveLitter.breed)}`;

  const isUpcoming = liveLitter.status === 'upcoming';

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-md bg-white border border-gray-200 rounded-xl transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-1">
      <div className="relative">
        <img
          src={liveLitter.image_url || placeholderUrl}
          alt={liveLitter.name}
          className="w-full h-48 object-cover rounded-t-xl"
        />
        <Badge variant="secondary"
          className="absolute top-2 right-2 font-semibold bg-white text-primary border border-gray-200 shadow px-4 py-1 text-base rounded-full"
        >
          From ${minPrice}
        </Badge>
        {isUpcoming && (
          <Badge variant="outline"
            className="absolute top-2 left-2 font-semibold bg-blue-100 text-blue-800 border border-blue-300 shadow px-3 py-1 text-sm rounded-full"
          >
            <Clock className="mr-1 h-3 w-3" />
            Coming Soon
          </Badge>
        )}
      </div>
      <div className="flex flex-col flex-grow justify-between bg-white rounded-b-xl">
        <CardHeader className="px-6 pb-0 pt-4">
          <CardTitle className="text-xl font-bold font-['Playfair_Display'] text-foreground">{liveLitter.name}</CardTitle>
          <CardDescription className="flex items-center mt-1 text-muted-foreground text-base font-medium">
            <Building className="mr-2 h-5 w-5 text-blue-500" />
            {liveLitter.breeders?.business_name || 'Independent Breeder'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow px-6 py-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-base text-muted-foreground font-medium">
              <Dog className="mr-2 h-5 w-5 text-orange-400" />
              <span>Breed: <span className="text-foreground">{liveLitter.breed}</span></span>
            </div>
            <div className="flex items-center text-base text-muted-foreground font-medium">
              <Calendar className="mr-2 h-5 w-5 text-orange-400" />
              <span>{isUpcoming ? 'Expected:' : 'Born:'} <span className="text-foreground">{birthDate}</span></span>
            </div>
            {/* Availability block - only show for active litters */}
            {!isUpcoming && (
              <div className="mt-2 flex gap-2">
                <div className="flex items-center text-lg">
                  <Heart className="mr-2 h-5 w-5 text-green-600" />
                  <span className="text-foreground">{isLoadingPuppies ? '--' : availableCount} {availableCount === 1 ? "puppy" : "puppies"} available</span>
                </div>
                <div className="flex items-center text-lg ml-4">
                  <XCircle className="mr-2 h-5 w-5 text-red-600" />
                  <span className="text-foreground">{isLoadingPuppies ? '--' : reservedCount} {reservedCount === 1 ? "puppy" : "puppies"} reserved</span>
                </div>
              </div>
            )}
            {/* Expected puppies for upcoming litters */}
            {isUpcoming && (
              <div className="mt-2 flex items-center text-lg">
                <Heart className="mr-2 h-5 w-5 text-blue-600" />
                <span className="text-foreground">{liveLitter.total_puppies} {liveLitter.total_puppies === 1 ? "puppy" : "puppies"} expected</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-6 pb-6 pt-2">
          <Button
            asChild={!isUpcoming}
            disabled={isUpcoming}
            className="w-full text-lg font-semibold rounded-lg bg-[#ffa726] hover:bg-[#fb8c00] text-white py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              boxShadow: '0 2px 8px 0 #ffe0b2',
            }}
          >
            {isUpcoming ? (
              <span>Available Soon</span>
            ) : (
              <Link to={`/litters/${liveLitter.id}`}>View Litter</Link>
            )}
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
};

export default LitterCard;
