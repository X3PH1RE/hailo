
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import RiderDashboard from "@/components/rider/RiderDashboard";
import DriverDashboard from "@/components/driver/DriverDashboard";
import Header from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [userMode, setUserMode] = useState<"rider" | "driver">("rider");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // For demonstration purposes - replace with actual Supabase auth
    const checkAuthStatus = () => {
      // Simulation of auth check - will be replaced with Supabase auth
      setIsLoggedIn(false);
    };

    checkAuthStatus();
  }, []);

  const handleModeChange = (value: string) => {
    setUserMode(value as "rider" | "driver");
    toast({
      title: `Switched to ${value} mode`,
      description: `You are now in ${value} mode`,
      duration: 2000,
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <Header isLoggedIn={isLoggedIn} />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        {!isLoggedIn ? (
          <AuthSection />
        ) : (
          <>
            <Tabs
              defaultValue="rider"
              value={userMode}
              onValueChange={handleModeChange}
              className="w-full"
            >
              <div className="flex justify-center mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="rider">Rider Mode</TabsTrigger>
                  <TabsTrigger value="driver">Driver Mode</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="rider" className="mt-2">
                <RiderDashboard />
              </TabsContent>
              
              <TabsContent value="driver" className="mt-2">
                <DriverDashboard />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      
      <footer className="bg-white py-4 border-t border-gray-200">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2023 Hailo - College Ride-Sharing Platform</p>
        </div>
      </footer>
    </div>
  );
};

// Auth Section Component
const AuthSection = () => {
  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl my-16">
      <div className="p-8">
        <div className="flex justify-center mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-purple-800">Hailo</h1>
            <p className="text-lg text-gray-600 mt-2">College Ride-Sharing Platform</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Welcome to Hailo</h2>
            <p className="text-gray-600 mt-2">Sign in with your college email to continue</p>
          </div>
          
          <div className="space-y-4">
            <Button 
              variant="default" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              Sign in with College Email
            </Button>
            
            <div className="text-center text-sm text-gray-500">
              <p>Only .edu.in email domains are allowed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
