
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Clock, MapPin, Navigation, Phone, Star, User, X } from "lucide-react";
import MapView from "@/components/map/MapView";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DriverStatus = "offline" | "online" | "rideAccepted" | "pickingUp" | "inProgress" | "completed";

interface RideRequest {
  id: string;
  rider: {
    name: string;
    rating: number;
  };
  pickup: {
    name: string;
    coordinates: [number, number];
  };
  dropoff: {
    name: string;
    coordinates: [number, number];
  };
  distance: string;
  fare: string;
  timestamp: Date;
}

const DriverDashboard = () => {
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("offline");
  const [isOnline, setIsOnline] = useState(false);
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for authenticated user and active rides
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // User is not authenticated
        toast({
          title: "Not logged in",
          description: "Please sign in to use the driver dashboard",
          variant: "destructive",
        });
        return;
      }

      // Check for existing active rides for this driver
      const { data: activeRides, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('driver_id', data.session.user.id)
        .in('status', ['accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching active rides:", error);
        return;
      }

      if (activeRides && activeRides.length > 0) {
        // Driver has an active ride
        const ride = activeRides[0];
        setIsOnline(true);
        setCurrentRideId(ride.id);
        
        // Convert database ride to UI format
        const formattedRide: RideRequest = {
          id: ride.id,
          rider: {
            name: "Rider", // Will be replaced with actual rider name in fetchRiderInfo
            rating: 4.7,
          },
          pickup: {
            name: ride.pickup_location,
            coordinates: ride.rider_location ? 
              [ride.rider_location.longitude, ride.rider_location.latitude] : 
              [77.2150, 28.6129] // Default coordinates if not available
          },
          dropoff: {
            name: ride.destination,
            coordinates: [77.2190, 28.6079] // Default coordinates, would be actual in a real app
          },
          distance: "2.3 km", // Calculate this in real app
          fare: `₹${ride.estimated_price}`,
          timestamp: new Date(ride.created_at)
        };
        
        setCurrentRide(formattedRide);
        
        // Set driver status based on ride status
        if (ride.status === 'accepted') {
          setDriverStatus('rideAccepted');
        } else if (ride.status === 'in_progress') {
          setDriverStatus('inProgress');
        }
        
        // Fetch rider information
        fetchRiderInfo(ride.rider_id, formattedRide);
      }
    };
    
    checkAuth();
  }, [toast]);

  const fetchRiderInfo = async (riderId: string, formattedRide: RideRequest) => {
    // Fetch rider profile data
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', riderId)
      .single();

    if (error) {
      console.error("Error fetching rider info:", error);
      return;
    }

    if (data) {
      // Update the rider info in the current ride
      const updatedRide = {
        ...formattedRide,
        rider: {
          ...formattedRide.rider,
          name: data.full_name || "Rider"
        }
      };
      setCurrentRide(updatedRide);
    }
  };

  // Listen for real-time changes in ride requests
  useEffect(() => {
    if (!isOnline || driverStatus !== "online") return;

    // Subscribe to new pending ride requests
    const channel = supabase
      .channel('driver_available_rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_requests',
          filter: `status=eq.pending`
        },
        async (payload) => {
          console.log("Ride request change detected:", payload);
          
          // Refresh all pending ride requests
          await fetchAvailableRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, driverStatus]);

  // Listen for changes to the current ride
  useEffect(() => {
    if (!currentRideId) return;

    // Subscribe to changes for the current ride
    const channel = supabase
      .channel('driver_current_ride')
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
          console.log("Current ride updated:", updatedRide);
          
          // Update ride status if needed
          if (updatedRide.status === 'in_progress' && driverStatus === 'rideAccepted') {
            setDriverStatus('inProgress');
          } else if (updatedRide.status === 'completed') {
            setDriverStatus('completed');
          } else if (updatedRide.status === 'cancelled') {
            toast({
              title: "Ride Cancelled",
              description: "The rider has cancelled this ride.",
              variant: "destructive"
            });
            // Reset current ride and go back online
            resetRideState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRideId, driverStatus, toast]);

  const toggleDriverStatus = async () => {
    if (!isOnline) {
      // Check if user is logged in
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
      });
      
      // Fetch available rides
      fetchAvailableRides();
    } else {
      setIsOnline(false);
      setDriverStatus("offline");
      setRideRequests([]);
      toast({
        title: "You're Offline",
        description: "You won't receive new ride requests.",
      });
    }
  };

  const fetchAvailableRides = async () => {
    try {
      // Fetch pending ride requests from Supabase
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*, profiles(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        // Transform database rides to the format needed for UI
        const formattedRequests: RideRequest[] = await Promise.all(data.map(async (ride) => {
          // Fetch rider profile if available
          let riderName = "Rider";
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', ride.rider_id)
              .single();
              
            if (profileData) {
              riderName = profileData.full_name || "Rider";
            }
          } catch (error) {
            console.error("Error fetching rider profile:", error);
          }
          
          return {
            id: ride.id,
            rider: {
              name: riderName,
              rating: 4.7 // Default rating
            },
            pickup: {
              name: ride.pickup_location,
              coordinates: ride.rider_location ? 
                [ride.rider_location.longitude, ride.rider_location.latitude] : 
                [77.2150, 28.6129] // Default coordinates if not available
            },
            dropoff: {
              name: ride.destination,
              coordinates: [77.2190, 28.6079] // Default coordinates
            },
            distance: "2.3 km", // Calculate this in real app
            fare: `₹${ride.estimated_price}`,
            timestamp: new Date(ride.created_at)
          };
        }));
        
        setRideRequests(formattedRequests);
      }
    } catch (error) {
      console.error("Error fetching ride requests:", error);
      toast({
        title: "Error",
        description: "Failed to fetch ride requests.",
        variant: "destructive",
      });
    }
  };

  const acceptRide = async (ride: RideRequest) => {
    try {
      // Check for user session
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Not logged in",
          description: "Please sign in to accept rides",
          variant: "destructive",
        });
        return;
      }
      
      // Update ride in Supabase
      const { error } = await supabase
        .from('ride_requests')
        .update({
          driver_id: session.session.user.id,
          status: 'accepted',
          driver_location: {
            longitude: 77.2090,
            latitude: 28.6139
          } // Default driver location
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

  const declineRide = (rideId: string) => {
    setRideRequests(rideRequests.filter((ride) => ride.id !== rideId));
    
    toast({
      description: "Ride request declined",
    });
  };

  const confirmPickup = async () => {
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

  const completeRide = async () => {
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

  const resetRideState = () => {
    setCurrentRide(null);
    setCurrentRideId(null);
    setDriverStatus("online");
    fetchAvailableRides();
  };

  const getMapMarkers = () => {
    const markers = [];
    
    if (driverStatus !== "offline" && navigator.geolocation) {
      markers.push({
        id: "driver",
        lngLat: [77.2090, 28.6139] as [number, number],
        type: "driver" as const,
      });
    }
    
    if (currentRide) {
      if (driverStatus === "rideAccepted" || driverStatus === "pickingUp") {
        markers.push({
          id: "pickup",
          lngLat: currentRide.pickup.coordinates,
          type: "pickup" as const,
        });
      }
      
      if (driverStatus === "inProgress" || driverStatus === "completed") {
        markers.push({
          id: "dropoff",
          lngLat: currentRide.dropoff.coordinates,
          type: "dropoff" as const,
        });
      }
    }
    
    return markers;
  };

  const getRouteToDisplay = () => {
    if (!currentRide) return undefined;
    
    if (driverStatus === "rideAccepted" || driverStatus === "pickingUp") {
      return {
        start: [77.2090, 28.6139] as [number, number],
        end: currentRide.pickup.coordinates,
      };
    }
    
    if (driverStatus === "inProgress") {
      return {
        start: currentRide.pickup.coordinates,
        end: currentRide.dropoff.coordinates,
      };
    }
    
    return undefined;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-md">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-gray-800">Driver Dashboard</CardTitle>
            <div className="flex items-center space-x-2">
              <Switch
                id="driver-status"
                checked={isOnline}
                onCheckedChange={toggleDriverStatus}
              />
              <Label htmlFor="driver-status" className="text-sm">
                {isOnline ? (
                  <span className="text-green-600 font-semibold">Online</span>
                ) : (
                  <span className="text-gray-400">Offline</span>
                )}
              </Label>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {driverStatus === "offline" && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">You're Offline</h3>
              <p className="text-gray-500 mt-1 mb-4">Go online to start receiving ride requests</p>
              <Button 
                onClick={toggleDriverStatus}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Go Online
              </Button>
            </div>
          )}
          
          {driverStatus === "online" && (
            <>
              {rideRequests.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700">Waiting for Requests</h3>
                  <p className="text-gray-500 mt-1">You'll be notified when new rides are available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-700">New Ride Requests</h3>
                  
                  {rideRequests.map((request) => (
                    <Card key={request.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-800 font-semibold">{request.rider.name.charAt(0)}</span>
                            </div>
                            <div>
                              <h4 className="font-medium">{request.rider.name}</h4>
                              <div className="flex items-center gap-1 text-sm">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{request.rider.rating}</span>
                              </div>
                            </div>
                          </div>
                          
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            {request.distance}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500">Pickup</p>
                              <p className="text-sm line-clamp-1">{request.pickup.name}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-2">
                            <Navigation className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500">Dropoff</p>
                              <p className="text-sm line-clamp-1">{request.dropoff.name}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-gray-500">Fare</p>
                            <p className="font-semibold">{request.fare}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => declineRide(request.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                            
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => acceptRide(request)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
          
          {(driverStatus === "rideAccepted" || driverStatus === "pickingUp" || 
            driverStatus === "inProgress" || driverStatus === "completed") && currentRide && (
            <div className="space-y-4">
              {driverStatus === "rideAccepted" && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-blue-800 font-medium text-center">Pickup the rider</p>
                </div>
              )}
              
              {driverStatus === "inProgress" && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-green-800 font-medium text-center">Ride in progress</p>
                </div>
              )}
              
              {driverStatus === "completed" && (
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-purple-800 font-medium text-center">Ride completed</p>
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-800 font-semibold">{currentRide.rider.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{currentRide.rider.name}</h4>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{currentRide.rider.rating}</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="rounded-full h-8 w-8"
                  onClick={() => {
                    toast({
                      title: "Calling rider",
                      description: "Connecting you to the rider...",
                    });
                  }}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="text-sm">{currentRide.pickup.name}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Navigation className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Dropoff</p>
                    <p className="text-sm">{currentRide.dropoff.name}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t pt-3">
                <div>
                  <p className="text-xs text-gray-500">Fare</p>
                  <p className="font-semibold">{currentRide.fare}</p>
                </div>
                
                {driverStatus === "rideAccepted" && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={confirmPickup}
                  >
                    Confirm Pickup
                  </Button>
                )}
                
                {driverStatus === "inProgress" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={completeRide}
                  >
                    Complete Ride
                  </Button>
                )}
                
                {driverStatus === "completed" && (
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={resetRideState}
                  >
                    Find New Rides
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <MapView 
        markers={getMapMarkers()}
        drawRoute={getRouteToDisplay()}
        zoom={14}
      />
      
      {driverStatus !== "offline" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4">
              <h4 className="text-sm text-gray-500">Today's Earnings</h4>
              <p className="text-xl font-semibold">₹240</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <h4 className="text-sm text-gray-500">Total Rides</h4>
              <p className="text-xl font-semibold">5</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <h4 className="text-sm text-gray-500">Hours Online</h4>
              <p className="text-xl font-semibold">3.5</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <h4 className="text-sm text-gray-500">Rating</h4>
              <div className="flex items-center gap-1">
                <p className="text-xl font-semibold">4.8</p>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
