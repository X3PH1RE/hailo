import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Clock, MapPin, Navigation, Phone, Star, User, X } from "lucide-react";
import MapView from "@/components/map/MapView";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const toggleDriverStatus = () => {
    if (!isOnline) {
      setIsOnline(true);
      setDriverStatus("online");
      toast({
        title: "You're Online",
        description: "You'll start receiving ride requests.",
      });
      
      setTimeout(() => {
        if (driverStatus === "online") {
          generateRideRequests();
        }
      }, 3000);
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

  const generateRideRequests = () => {
    const newRequests: RideRequest[] = [
      {
        id: "r1",
        rider: {
          name: "Priya",
          rating: 4.7,
        },
        pickup: {
          name: "University Library, North Campus",
          coordinates: [77.2150, 28.6129],
        },
        dropoff: {
          name: "Girls Hostel, South Campus",
          coordinates: [77.2190, 28.6079],
        },
        distance: "2.3 km",
        fare: "₹48",
        timestamp: new Date(),
      },
      {
        id: "r2",
        rider: {
          name: "Vikram",
          rating: 4.3,
        },
        pickup: {
          name: "Engineering Building, Block B",
          coordinates: [77.2130, 28.6169],
        },
        dropoff: {
          name: "College Cafeteria",
          coordinates: [77.2110, 28.6149],
        },
        distance: "1.2 km",
        fare: "₹25",
        timestamp: new Date(),
      },
    ];
    
    setRideRequests(newRequests);
  };

  const acceptRide = (ride: RideRequest) => {
    setCurrentRide(ride);
    setRideRequests([]);
    setDriverStatus("rideAccepted");
    
    toast({
      title: "Ride Accepted",
      description: `Navigating to pick up ${ride.rider.name}`,
    });
  };

  const declineRide = (rideId: string) => {
    setRideRequests(rideRequests.filter((ride) => ride.id !== rideId));
    
    toast({
      description: "Ride request declined",
    });
    
    if (rideRequests.length === 1) {
      setTimeout(() => {
        if (driverStatus === "online") {
          generateRideRequests();
        }
      }, 5000);
    }
  };

  const getMapMarkers = () => {
    const markers = [];
    
    if (driverStatus !== "offline" && navigator.geolocation) {
      markers.push({
        id: "driver",
        lngLat: [77.2090, 28.6139],
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
                    onClick={() => setDriverStatus("inProgress")}
                  >
                    Confirm Pickup
                  </Button>
                )}
                
                {driverStatus === "inProgress" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setDriverStatus("completed")}
                  >
                    Complete Ride
                  </Button>
                )}
                
                {driverStatus === "completed" && (
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      setCurrentRide(null);
                      setDriverStatus("online");
                      
                      const status: DriverStatus = "online";
                      if (status === "online") {
                        generateRideRequests();
                      }
                    }}
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
