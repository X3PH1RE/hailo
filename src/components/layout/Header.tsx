
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

interface HeaderProps {
  isLoggedIn: boolean;
}

const Header = ({ isLoggedIn }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-purple-800">Hailo</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {isLoggedIn ? (
              <>
                <Button variant="ghost" size="sm">Ride History</Button>
                <Button variant="ghost" size="sm">Help</Button>
                
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
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Log out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button variant="default" size="sm" className="bg-purple-600 hover:bg-purple-700">
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
                
                <Button variant="ghost" className="justify-start px-2">Ride History</Button>
                <Button variant="ghost" className="justify-start px-2">Notifications</Button>
                <Button variant="ghost" className="justify-start px-2">Help</Button>
                <Button variant="ghost" className="justify-start px-2">Settings</Button>
                <Button variant="ghost" className="justify-start px-2 text-red-600">Log out</Button>
              </>
            ) : (
              <Button className="w-full bg-purple-600 hover:bg-purple-700">Sign In</Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
