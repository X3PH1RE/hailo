
import { supabase } from "@/integrations/supabase/client";
import { RideRequest } from "../utils/driverUtils";

export const toggleDriverStatus = async (
  isOnline: boolean, 
  setIsOnline: (status: boolean) => void,
  setDriverStatus: (status: string) => void,
  fetchAvailableRides: () => Promise<void>,
  toast: any
) => {
  if (!isOnline) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast({
        title: "Not logged in",
        description: "Please sign in to use the driver dashboard",
        variant: "destructive",
      });
      return;
    }
    
    setIsOnline(true);
    setDriverStatus("online");
    toast({
      title: "You're Online",
      description: "You'll start receiving ride requests.",
      duration: 5000,
    });
    
    fetchAvailableRides();
  } else {
    setIsOnline(false);
    setDriverStatus("offline");
    toast({
      title: "You're Offline",
      description: "You won't receive new ride requests.",
      duration: 5000,
    });
  }
};

export const acceptRide = async (
  ride: RideRequest,
  setCurrentRide: (ride: RideRequest) => void,
  setCurrentRideId: (id: string) => void,
  setRideRequests: (requests: RideRequest[]) => void,
  setDriverStatus: (status: string) => void,
  toast: any
) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast({
        title: "Not logged in",
        description: "Please sign in to accept rides",
        variant: "destructive",
      });
      return;
    }
    
    const driverLocation: Record<string, number> = {
      longitude: 77.2090,
      latitude: 28.6139
    };
    
    console.log("Accepting ride with ID:", ride.id);
    
    // Enable realtime for the ride_requests table
    try {
      await supabase.rpc('enable_realtime_for_table', { table: 'ride_requests' });
      console.log("Realtime notifications enabled for ride_requests table");
    } catch (error) {
      console.error("Error enabling realtime:", error);
    }
    
    const { error } = await supabase
      .from('ride_requests')
      .update({
        driver_id: session.session.user.id,
        status: 'accepted',
        driver_location: driverLocation
      })
      .eq('id', ride.id);

    if (error) {
      throw error;
    }

    setCurrentRide(ride);
    setCurrentRideId(ride.id);
    setRideRequests([]);
    setDriverStatus("rideAccepted");
    
    toast({
      title: "Ride Accepted",
      description: `Navigating to pick up ${ride.rider.name}`,
      duration: 5000,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    toast({
      title: "Error",
      description: "Failed to accept ride. Please try again.",
      variant: "destructive",
    });
  }
};

export const declineRide = (
  rideId: string, 
  rideRequests: RideRequest[], 
  setRideRequests: (requests: RideRequest[]) => void,
  toast: any
) => {
  setRideRequests(rideRequests.filter((ride) => ride.id !== rideId));
  
  toast({
    description: "Ride request declined",
    duration: 3000,
  });
};

export const confirmPickup = async (
  currentRideId: string | null, 
  setDriverStatus: (status: string) => void,
  toast: any
) => {
  if (!currentRideId) return;
  
  try {
    const { error } = await supabase
      .from('ride_requests')
      .update({ status: 'in_progress' })
      .eq('id', currentRideId);

    if (error) {
      throw error;
    }

    setDriverStatus("inProgress");
  } catch (error) {
    console.error("Error updating ride status:", error);
    toast({
      title: "Error",
      description: "Failed to update ride status. Please try again.",
      variant: "destructive",
    });
  }
};

export const completeRide = async (
  currentRideId: string | null, 
  setDriverStatus: (status: string) => void,
  toast: any
) => {
  if (!currentRideId) return;
  
  try {
    const { error } = await supabase
      .from('ride_requests')
      .update({ status: 'completed' })
      .eq('id', currentRideId);

    if (error) {
      throw error;
    }

    setDriverStatus("completed");
  } catch (error) {
    console.error("Error completing ride:", error);
    toast({
      title: "Error",
      description: "Failed to complete ride. Please try again.",
      variant: "destructive",
    });
  }
};
