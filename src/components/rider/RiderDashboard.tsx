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

interface LocationData {
  longitude: number;
  latitude: number;
}

const RiderDashboard = () => {
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [pickup, setPickup] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const [dropoff, setDropoff] = useState<{ name: string; coordinates: [number, number] } | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<{
    name: string;
    rating: number;
    vehicle: string;
    vehicleColor: string;
    arrivalTime: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast({
          title: "Not logged in",
          description: "Please sign in to use the rider dashboard",
          variant: "destructive",
        });
        return;
      }

      const { data: rideRequests, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_id', data.session.user.id)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching ride requests:", error);
        return;
      }

      if (rideRequests && rideRequests.length > 0) {
        const activeRide = rideRequests[0];
        setCurrentRideId(activeRide.id);
        
        const riderLocation = activeRide.rider_location as LocationData | null;
        
        setPickup({
          name: activeRide.pickup_location,
          coordinates: [
            riderLocation?.longitude || 77.2090, 
            riderLocation?.latitude || 28.6139
          ]
        });
        
        setDropoff({
          name: activeRide.destination,
          coordinates: [77.2190, 28.6079] // Default coordinates if not available
        });

        switch(activeRide.status) {
          case 'pending':
            setRideStatus('searching');
            break;
          case 'accepted':
            setRideStatus('driverAssigned');
            if (activeRide.driver_id) {
              fetchDriverInfo(activeRide.driver_id);
            }
            break;
          case 'in_progress':
            setRideStatus('inProgress');
            if (activeRide.driver_id) {
              fetchDriverInfo(activeRide.driver_id);
            }
            break;
          default:
            setRideStatus('idle');
        }
      }
    };
    
    checkAuth();
  }, [toast]);

  useEffect(() => {
    if (!currentRideId) return;

    const channel = supabase
      .channel('ride_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `id=eq.${currentRideId}`
        },
        (payload) => {
          const updatedRide = payload.new;
          console.log("Ride updated in real-time:", updatedRide);
          
          switch(updatedRide.status) {
            case 'accepted':
              setRideStatus('driverAssigned');
              toast({
                title: "Driver Found!",
                description: "A driver has accepted your ride request.",
              });
              if (updatedRide.driver_id) {
                fetchDriverInfo(updatedRide.driver_id);
              }
              break;
            case 'in_progress':
              setRideStatus('inProgress');
              break;
            case 'completed':
              setRideStatus('completed');
              break;
            case 'cancelled':
              setRideStatus('idle');
              setCurrentRideId(null);
              toast({
                title: "Ride Cancelled",
                description: "Your ride has been cancelled.",
                variant: "destructive"
              });
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRideId, toast]);

  const fetchDriverInfo = async (driverId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driverId)
      .single();

    if (error) {
      console.error("Error fetching driver info:", error);
      setDriverInfo({
        name: "Driver",
        rating: 4.8,
        vehicle: "Honda Activa",
        vehicleColor: "Blue",
        arrivalTime: "5 min"
      });
      return;
    }

    if (data) {
      setDriverInfo({
        name: data.full_name || "Driver",
        rating: 4.8,
        vehicle: "Honda Activa",
        vehicleColor: "Blue",
        arrivalTime: "5 min"
      });
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !dropoff) {
      toast({
        title: "Missing Location",
        description: "Please select both pickup and dropoff locations.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Not logged in",
          description: "Please sign in to request a ride",
          variant: "destructive",
        });
        return;
      }

      setRideStatus("searching");

      const estimatedPrice = calculateFare();
      const { data, error } = await supabase
        .from('ride_requests')
        .insert({
          rider_id: session.session.user.id,
          pickup_location: pickup.name,
          destination: dropoff.name,
          rider_location: { 
            longitude: pickup.coordinates[0], 
            latitude: pickup.coordinates[1] 
          },
          estimated_price: estimatedPrice,
          estimated_time: 5,
          ride_type: 'standard',
          status: 'pending'
        })
        .select();

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setCurrentRideId(data[0].id);
      }

      toast({
        title: "Ride Requested",
        description: "Looking for drivers near you...",
      });
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
    if (!currentRideId) {
      setRideStatus("idle");
      return;
    }

    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('id', currentRideId);

      if (error) {
        throw error;
      }

      setCurrentRideId(null);
      setRideStatus("idle");
      toast({
        title: "Ride Cancelled",
        description: "Your ride request has been cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast({
        title: "Error",
        description: "Failed to cancel ride. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmPickup = async () => {
    if (!currentRideId) return;

    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'in_progress' })
        .eq('id', currentRideId);

      if (error) {
        throw error;
      }

      setRideStatus("inProgress");
    } catch (error) {
      console.error("Error updating ride status:", error);
      toast({
        title: "Error",
        description: "Failed to update ride status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDropoff = async () => {
    if (!currentRideId) return;

    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'completed' })
        .eq('id', currentRideId);

      if (error) {
        throw error;
      }

      setRideStatus("completed");
    } catch (error) {
      console.error("Error completing ride:", error);
      toast({
        title: "Error",
        description: "Failed to complete ride. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteRide = () => {
    setCurrentRideId(null);
    setRideStatus("idle");
  };

  const calculateFare = (): number => {
    if (!pickup || !dropoff) return 0;
    
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = pickup.coordinates[1];
    const lon1 = pickup.coordinates[0];
    const lat2 = dropoff.coordinates[1];
    const lon2 = dropoff.coordinates[0];
    
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    const fare = Math.round(distance * 12);
    return fare;
  };

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

  const getRouteToDisplay = () => {
    if (!pickup || !dropoff) return undefined;
    
    if (rideStatus === "driverAssigned" || rideStatus === "enRoute") {
      const driverLng = pickup.coordinates[0] + 0.005;
      const driverLat = pickup.coordinates[1] + 0.005;
      return {
        start: [driverLng, driverLat] as [number, number],
        end: pickup.coordinates,
      };
    }
    
    if (rideStatus === "inProgress") {
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
              driverInfo={driverInfo || (rideStatus !== "searching" ? {
                name: "Driver",
                rating: 4.8,
                vehicle: "Honda Activa",
                vehicleColor: "Blue",
                arrivalTime: "5 min"
              } : undefined)}
              onCancel={handleCancelRide}
              onConfirmPickup={handleConfirmPickup}
              onConfirmDropoff={handleConfirmDropoff}
              onComplete={handleCompleteRide}
            />
          )}
        </CardContent>
      </Card>
      
      <MapView 
        markers={getMapMarkers()}
        drawRoute={getRouteToDisplay()}
        zoom={14}
      />

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
