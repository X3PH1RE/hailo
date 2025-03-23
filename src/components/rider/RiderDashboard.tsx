
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Search, Clock, Navigation } from "lucide-react";
import MapView from "@/components/map/MapView";
import LocationSearch from "@/components/rider/LocationSearch";
import RideDetails from "@/components/rider/RideDetails";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type RideStatus = "idle" | "searching" | "driverAssigned" | "enRoute" | "arrived" | "inProgress" | "completed";

const RiderDashboard = () => {
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [pickup, setPickup] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const [dropoff, setDropoff] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const { toast } = useToast();

  // Check for authenticated user
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // User is not authenticated
        toast({
          title: "Not logged in",
          description: "Please sign in to use the rider dashboard",
          variant: "destructive",
        });
      }
    };
    
    checkAuth();
  }, [toast]);
  
  const handleRequestRide = async () => {
    if (!pickup || !dropoff) {
      toast({
        title: "Missing Location",
        description: "Please select both pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    setRideStatus("searching");

    try {
      // Save ride request to Supabase
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        const { error } = await supabase
          .from('ride_requests')
          .insert({
            rider_id: session.session.user.id,
            pickup_location: pickup.name,
            destination: dropoff.name,
            rider_location: { 
              longitude: pickup.coordinates[0], 
              latitude: pickup.coordinates[1] 
            },
            estimated_price: calculateFare(),
            estimated_time: 5, // 5 minutes
            ride_type: 'standard',
            status: 'pending'
          });

        if (error) {
          throw error;
        }
      }

      // Simulate finding a driver after 3 seconds
      setTimeout(() => {
        setRideStatus("driverAssigned");
        toast({
          title: "Driver Found!",
          description: "Rahul is on the way to pick you up.",
        });
      }, 3000);
    } catch (error) {
      console.error("Error creating ride request:", error);
      toast({
        title: "Error",
        description: "Failed to create ride request. Please try again.",
        variant: "destructive",
      });
      setRideStatus("idle");
    }
  };

  const handleCancelRide = async () => {
    // Update ride status in Supabase if needed
    setRideStatus("idle");
    toast({
      title: "Ride Cancelled",
      description: "Your ride request has been cancelled.",
    });
  };

  // Calculate ride fare based on distance (simplified calculation)
  const calculateFare = (): number => {
    if (!pickup || !dropoff) return 0;
    
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
    return fare;
  };

  // Calculate markers based on current state
  const getMapMarkers = () => {
    const markers = [];
    
    if (pickup) {
      markers.push({
        id: "pickup",
        lngLat: pickup.coordinates,
        type: "pickup" as const,
      });
    }
    
    if (dropoff) {
      markers.push({
        id: "dropoff",
        lngLat: dropoff.coordinates,
        type: "dropoff" as const,
      });
    }
    
    if (rideStatus === "driverAssigned" || rideStatus === "enRoute") {
      // Simulate driver location (slightly away from pickup)
      const driverLng = pickup ? pickup.coordinates[0] + 0.005 : 0;
      const driverLat = pickup ? pickup.coordinates[1] + 0.005 : 0;
      
      markers.push({
        id: "driver",
        lngLat: [driverLng, driverLat] as [number, number],
        type: "driver" as const,
      });
    }
    
    return markers;
  };

  // Get route to draw
  const getRouteToDisplay = () => {
    if (!pickup || !dropoff) return undefined;
    
    if (rideStatus === "driverAssigned" || rideStatus === "enRoute") {
      // Draw route from driver to pickup
      const driverLng = pickup.coordinates[0] + 0.005;
      const driverLat = pickup.coordinates[1] + 0.005;
      return {
        start: [driverLng, driverLat] as [number, number],
        end: pickup.coordinates,
      };
    }
    
    if (rideStatus === "inProgress") {
      // Draw route from pickup to dropoff
      return {
        start: pickup.coordinates,
        end: dropoff.coordinates,
      };
    }
    
    return undefined;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">Find a Ride</CardTitle>
        </CardHeader>
        <CardContent>
          {rideStatus === "idle" ? (
            <div className="space-y-4">
              <LocationSearch 
                label="Pickup Location"
                icon={<MapPin className="h-5 w-5 text-gray-500" />}
                onLocationSelect={(location) => setPickup(location)}
                placeholder="Current location"
                defaultLocation={pickup}
              />
              
              <LocationSearch 
                label="Destination"
                icon={<Navigation className="h-5 w-5 text-gray-500" />}
                onLocationSelect={(location) => setDropoff(location)}
                placeholder="Where are you going?"
                defaultLocation={dropoff}
              />
              
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 mt-4"
                size="lg"
                onClick={handleRequestRide}
                disabled={!pickup || !dropoff}
              >
                Request Ride
              </Button>
            </div>
          ) : (
            <RideDetails 
              rideStatus={rideStatus}
              pickup={pickup}
              dropoff={dropoff}
              driverInfo={rideStatus !== "searching" ? {
                name: "Rahul",
                rating: 4.8,
                vehicle: "Honda Activa",
                vehicleColor: "Blue",
                arrivalTime: "5 min"
              } : undefined}
              onCancel={handleCancelRide}
              onConfirmPickup={() => setRideStatus("inProgress")}
              onConfirmDropoff={() => setRideStatus("completed")}
              onComplete={() => setRideStatus("idle")}
            />
          )}
        </CardContent>
      </Card>
      
      <MapView 
        markers={getMapMarkers()}
        drawRoute={getRouteToDisplay()}
        zoom={14}
      />

      {/* Bottom cards for quick actions */}
      {rideStatus === "idle" && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm hover:shadow transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Schedule</h3>
                <p className="text-sm text-gray-500">Plan ahead</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm hover:shadow transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Search className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Campus Spots</h3>
                <p className="text-sm text-gray-500">Quick rides</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RiderDashboard;
