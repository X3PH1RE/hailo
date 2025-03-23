
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Bell, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  isLoggedIn: boolean;
}

const Header = ({ isLoggedIn }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleSignIn = () => {
    navigate("/");
    toast({
      title: "Sign in",
      description: "Please sign in to continue",
    });
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "You have been signed out."
      });
      navigate("/");
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-purple-800 cursor-pointer" onClick={() => handleNavigate("/")}>Hailo</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {isLoggedIn ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleNavigate("/history")}>Ride History</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/help")}>Help</Button>
                
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
                </Button>
                
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-100 text-purple-800">US</AvatarFallback>
                      </Avatar>
                      <span>User</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleNavigate("/profile")}>Profile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleNavigate("/settings")}>Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleSignIn}
              >
                Sign In
              </Button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white px-4 py-2 shadow-lg border-t border-gray-100">
          <nav className="flex flex-col space-y-3 py-3">
            {isLoggedIn ? (
              <>
                <div className="flex items-center space-x-3 px-2 py-2 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-purple-100 text-purple-800">US</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">User Name</div>
                    <div className="text-sm text-gray-500">user@college.edu.in</div>
                  </div>
                </div>
                
                <Button variant="ghost" className="justify-start px-2" onClick={() => handleNavigate("/history")}>Ride History</Button>
                <Button variant="ghost" className="justify-start px-2" onClick={() => handleNavigate("/notifications")}>Notifications</Button>
                <Button variant="ghost" className="justify-start px-2" onClick={() => handleNavigate("/help")}>Help</Button>
                <Button variant="ghost" className="justify-start px-2" onClick={() => handleNavigate("/profile")}>Profile</Button>
                <Button variant="ghost" className="justify-start px-2" onClick={() => handleNavigate("/settings")}>Settings</Button>
                <Button variant="ghost" className="justify-start px-2 text-red-600" onClick={handleSignOut}>Log out</Button>
              </>
            ) : (
              <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleSignIn}>Sign In</Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
