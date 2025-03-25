import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Search, Clock, Navigation } from "lucide-react";
import MapView from "@/components/map/MapView";
import LocationSearch from "@/components/rider/LocationSearch";
import RideDetails from "@/components/rider/RideDetails";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

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
  const [estimatedFare, setEstimatedFare] = useState<number>(0);
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

      console.log("Checking for active ride requests for user:", data.session.user.id);
      
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

      console.log("Active ride requests:", rideRequests);

      if (rideRequests && rideRequests.length > 0) {
        const activeRide = rideRequests[0];
        setCurrentRideId(activeRide.id);
        
        let riderLongitude = 77.2090;
        let riderLatitude = 28.6139;
        
        if (activeRide.rider_location && typeof activeRide.rider_location === 'object' && !Array.isArray(activeRide.rider_location)) {
          const locationData = activeRide.rider_location as Record<string, Json>;
          riderLongitude = typeof locationData.longitude === 'number' ? locationData.longitude : riderLongitude;
          riderLatitude = typeof locationData.latitude === 'number' ? locationData.latitude : riderLatitude;
        }
        
        setPickup({
          name: activeRide.pickup_location,
          coordinates: [riderLongitude, riderLatitude]
        });
        
        const dropoffCoordinates = calculateDestinationCoordinates(riderLongitude, riderLatitude, activeRide.destination);
        
        setDropoff({
          name: activeRide.destination,
          coordinates: dropoffCoordinates
        });

        setEstimatedFare(activeRide.estimated_price);

        console.log("Active ride status:", activeRide.status);
        
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

  const calculateDestinationCoordinates = (
    pickupLng: number, 
    pickupLat: number, 
    destinationName: string
  ): [number, number] => {
    let hash = 0;
    for (let i = 0; i < destinationName.length; i++) {
      hash = ((hash << 5) - hash) + destinationName.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const offsetLngFactor = (Math.abs(hash % 100) / 100) * 0.015 + 0.005;
    const offsetLatFactor = (Math.abs((hash >> 8) % 100) / 100) * 0.015 + 0.005;
    
    const lngDirection = hash % 2 === 0 ? 1 : -1;
    const latDirection = (hash >> 1) % 2 === 0 ? 1 : -1;
    
    return [
      pickupLng + (offsetLngFactor * lngDirection),
      pickupLat + (offsetLatFactor * latDirection)
    ];
  };

  useEffect(() => {
    if (!currentRideId) return;

    console.log("Setting up real-time updates for ride:", currentRideId);
    
    const enableRealtime = async () => {
      try {
        await supabase.rpc('enable_realtime_for_table', undefined);
        console.log("Realtime enabled for ride_requests table");
      } catch (error) {
        console.error("Error enabling realtime:", error);
      }
    };
    
    enableRealtime();
      
    const channel = supabase
      .channel(`ride_status_${currentRideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `id=eq.${currentRideId}`
        },
        (payload) => {
          console.log("Ride update received in real-time:", payload);
          const updatedRide = payload.new;
          
          if (updatedRide.status) {
            console.log(`Status changed to: ${updatedRide.status}`);
            
            switch(updatedRide.status) {
              case 'accepted':
                setRideStatus('driverAssigned');
                toast({
                  title: "Driver Found!",
                  description: "A driver has accepted your ride request.",
                  duration: 5000,
                });
                if (updatedRide.driver_id) {
                  fetchDriverInfo(updatedRide.driver_id);
                }
                break;
              case 'in_progress':
                setRideStatus('inProgress');
                toast({
                  title: "Ride Started",
                  description: "Your ride is now in progress.",
                  duration: 5000,
                });
                break;
              case 'completed':
                setRideStatus('completed');
                toast({
                  title: "Ride Completed",
                  description: "Your ride has been completed.",
                  duration: 5000,
                });
                break;
              case 'cancelled':
                setRideStatus('idle');
                setCurrentRideId(null);
                toast({
                  title: "Ride Cancelled",
                  description: "Your ride has been cancelled.",
                  variant: "destructive",
                  duration: 5000,
                });
                break;
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [currentRideId, toast]);

  const fetchDriverInfo = async (driverId: string) => {
    console.log("Fetching driver info for driver:", driverId);
    
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
      console.log("Driver info retrieved:", data);
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

      const calculatedFare = calculateFare(pickup.coordinates, dropoff.coordinates);
      setEstimatedFare(calculatedFare);
      
      const riderLocation: Record<string, number> = { 
        longitude: pickup.coordinates[0], 
        latitude: pickup.coordinates[1] 
      };
      
      console.log("Creating ride request with fare:", calculatedFare);
      
      const { data, error } = await supabase
        .from('ride_requests')
        .insert({
          rider_id: session.session.user.id,
          pickup_location: pickup.name,
          destination: dropoff.name,
          rider_location: riderLocation,
          estimated_price: calculatedFare,
          estimated_time: 5,
          ride_type: 'standard',
          status: 'pending'
        })
        .select();

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        console.log("Ride request created:", data[0]);
        setCurrentRideId(data[0].id);
        
        try {
          await supabase.rpc('enable_realtime_for_table', undefined);
          console.log("Realtime enabled for ride_requests table");
        } catch (error) {
          console.error("Error enabling realtime:", error);
        }
      }

      toast({
        title: "Ride Requested",
        description: "Looking for drivers near you...",
        duration: 5000,
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
        duration: 5000,
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

  const calculateFare = (
    pickupCoords: [number, number],
    dropoffCoords: [number, number]
  ): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = pickupCoords[1];
    const lon1 = pickupCoords[0];
    const lat2 = dropoffCoords[1];
    const lon2 = dropoffCoords[0];
    
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    
    const baseFare = 20;
    const distanceFare = Math.round(distance * 15);
    
    return baseFare + distanceFare;
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
      const driverLng = pickup ? pickup.coordinates[0] - 0.005 : 0;
      const driverLat = pickup ? pickup.coordinates[1] - 0.005 : 0;
      
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
      const driverLng = pickup.coordinates[0] - 0.005;
      const driverLat = pickup.coordinates[1] - 0.005;
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
    
    if (rideStatus === "idle" && pickup && dropoff) {
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
              estimatedFare={estimatedFare}
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
