
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Clock, MapPin, Navigation, Phone, Star, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RideStatus = "idle" | "searching" | "driverAssigned" | "enRoute" | "arrived" | "inProgress" | "completed";

interface RideDetailsProps {
  rideStatus: RideStatus;
  pickup: { name: string; coordinates: [number, number] } | null;
  dropoff: { name: string; coordinates: [number, number] } | null;
  driverInfo?: {
    name: string;
    rating: number;
    vehicle: string;
    vehicleColor: string;
    arrivalTime: string;
  };
  onCancel: () => void;
  onConfirmPickup: () => void;
  onConfirmDropoff: () => void;
  onComplete: () => void;
}

const RideDetails = ({
  rideStatus,
  pickup,
  dropoff,
  driverInfo,
  onCancel,
  onConfirmPickup,
  onConfirmDropoff,
  onComplete,
}: RideDetailsProps) => {
  const [eta, setEta] = useState(driverInfo?.arrivalTime || "5 min");
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Calculate ride fare based on distance (simplified calculation)
  const calculateFare = (): string => {
    if (!pickup || !dropoff) return "₹0";
    
    // Calculate distance using Haversine formula (simplified)
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = pickup.coordinates[1];
    const lon1 = pickup.coordinates[0];
    const lat2 = dropoff.coordinates[1];
    const lon2 = dropoff.coordinates[0];
    
    const R = 6371; // Radius of the Earth in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    
    // Calculate fare (₹12 per km)
    const fare = Math.round(distance * 12);
    return `₹${fare}`;
  };

  useEffect(() => {
    // Simulate progress updates
    if (rideStatus === "searching") {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
          }
          return newProgress > 100 ? 100 : newProgress;
        });
      }, 300);
      
      return () => clearInterval(interval);
    }
  }, [rideStatus]);

  // Simulate ETA updates
  useEffect(() => {
    if (rideStatus === "driverAssigned") {
      const interval = setInterval(() => {
        setEta((prev) => {
          const minutes = parseInt(prev.split(" ")[0]);
          const newMinutes = Math.max(1, minutes - 1);
          return `${newMinutes} min`;
        });
      }, 30000); // Update every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [rideStatus]);

  // Render content based on ride status
  const renderContent = () => {
    switch (rideStatus) {
      case "searching":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Finding Drivers</h3>
              <p className="text-gray-500">Looking for drivers near you...</p>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Estimated fare</p>
                <p className="font-semibold">{calculateFare()}</p>
              </div>
              
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        );
        
      case "driverAssigned":
      case "enRoute":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-800 font-semibold">{driverInfo?.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{driverInfo?.name}</h3>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{driverInfo?.rating}</span>
                  </div>
                </div>
              </div>
              
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => {
                toast({
                  title: "Calling driver",
                  description: "Connecting you to the driver...",
                });
              }}>
                <Phone className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1 rounded">
                  <span className="text-xs font-medium text-blue-800">
                    {driverInfo?.vehicleColor} {driverInfo?.vehicle}
                  </span>
                </div>
                
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                  Arriving in {eta}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Pickup</p>
                  <p className="text-sm text-gray-500 line-clamp-1">{pickup?.name}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-red-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Dropoff</p>
                  <p className="text-sm text-gray-500 line-clamp-1">{dropoff?.name}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t pt-3">
              <div>
                <p className="text-sm">Fare</p>
                <p className="font-semibold">{calculateFare()}</p>
              </div>
              
              {rideStatus === "driverAssigned" ? (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={onConfirmPickup}
                >
                  Confirm Pickup
                </Button>
              )}
            </div>
          </div>
        );
        
      case "inProgress":
        return (
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <p className="text-green-800 font-medium">Ride in Progress</p>
              <p className="text-sm text-green-600">You're on your way to the destination</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Pickup</p>
                  <p className="text-sm text-gray-500 line-clamp-1">{pickup?.name}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-red-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Dropoff</p>
                  <p className="text-sm text-gray-500 line-clamp-1">{dropoff?.name}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t pt-3">
              <div>
                <p className="text-sm">Fare</p>
                <p className="font-semibold">{calculateFare()}</p>
              </div>
              
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={onConfirmDropoff}
              >
                Confirm Arrival
              </Button>
            </div>
          </div>
        );
        
      case "completed":
        return (
          <div className="space-y-4">
            <div className="flex justify-center my-3">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">Ride Completed</h3>
              <p className="text-gray-500">Thank you for riding with Hailo!</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Fare</span>
                <span className="font-semibold">{calculateFare()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Payment</span>
                <span className="font-semibold">Cash</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Driver</span>
                <div className="flex items-center gap-1">
                  <span>{driverInfo?.name}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{driverInfo?.rating}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={onComplete}
              >
                Close
              </Button>
              
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  toast({
                    title: "Rating submitted",
                    description: "Thank you for your feedback!",
                  });
                  onComplete();
                }}
              >
                Rate Driver
              </Button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return <div>{renderContent()}</div>;
};

export default RideDetails;
