import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateDestinationCoordinates } from "../utils/locationUtils";
import { Json } from "@/integrations/supabase/types";

export type RideStatus = "idle" | "searching" | "driverAssigned" | "enRoute" | "arrived" | "inProgress" | "completed";

export interface Location {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface DriverInfo {
  name: string;
  rating: number;
  vehicle: string;
  vehicleColor: string;
  arrivalTime: string;
}

export const useRideState = () => {
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
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

  useEffect(() => {
    if (!currentRideId) return;

    console.log("Setting up real-time updates for ride:", currentRideId);
    
    const enableRealtime = async () => {
      try {
        await supabase.rpc('enable_realtime_for_table', { table: 'ride_requests' } as any);
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

  return {
    rideStatus,
    setRideStatus,
    pickup,
    setPickup,
    dropoff,
    setDropoff,
    currentRideId,
    setCurrentRideId,
    driverInfo,
    setDriverInfo,
    estimatedFare,
    setEstimatedFare,
    fetchDriverInfo
  };
};
