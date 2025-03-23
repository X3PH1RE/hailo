
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Clock, Navigation } from "lucide-react";
import MapView from "@/components/map/MapView";
import LocationSearch from "@/components/rider/LocationSearch";
import RideDetails from "@/components/rider/RideDetails";
import { useToast } from "@/hooks/use-toast";

type RideStatus = "idle" | "searching" | "driverAssigned" | "enRoute" | "arrived" | "inProgress" | "completed";

const RiderDashboard = () => {
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [pickup, setPickup] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const [dropoff, setDropoff] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const { toast } = useToast();

  const handleRequestRide = () => {
    if (!pickup || !dropoff) {
      toast({
        title: "Missing Location",
        description: "Please select both pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    setRideStatus("searching");

    // Simulate finding a driver after 3 seconds
    setTimeout(() => {
      setRideStatus("driverAssigned");
      toast({
        title: "Driver Found!",
        description: "Rahul is on the way to pick you up.",
      });
    }, 3000);
  };

  const handleCancelRide = () => {
    setRideStatus("idle");
    toast({
      title: "Ride Cancelled",
      description: "Your ride request has been cancelled.",
    });
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
        lngLat: [driverLng, driverLat],
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
