import { Link, useLocation } from "wouter";
import { useState } from "react";

const navItems = [
  { icon: "dashboard", label: "Dashboard", path: "/" },
  { icon: "trending_up", label: "Markets", path: "/markets" },
  { icon: "account_balance_wallet", label: "Portfolio", path: "/portfolio" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "history", label: "History", path: "/history" },
  { icon: "settings", label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <aside className="w-16 md:w-64 bg-card-bg border-r border-[#3A3A3A] flex flex-col">
      <div className="p-4 border-b border-[#3A3A3A] flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z" fill="#0052FF"/>
            <path d="M16.498 13.5V18.5C16.498 18.7761 16.2742 19 15.998 19H15.498C15.2219 19 14.998 18.7761 14.998 18.5V13.5C14.998 13.2239 15.2219 13 15.498 13H15.998C16.2742 13 16.498 13.2239 16.498 13.5Z" fill="white"/>
            <path d="M19.498 13.5V18.5C19.498 18.7761 19.2742 19 18.998 19H18.498C18.2219 19 17.998 18.7761 17.998 18.5V13.5C17.998 13.2239 18.2219 13 18.498 13H18.998C19.2742 13 19.498 13.2239 19.498 13.5Z" fill="white"/>
            <path d="M13.498 13.5V18.5C13.498 18.7761 13.2742 19 12.998 19H12.498C12.2219 19 11.998 18.7761 11.998 18.5V13.5C11.998 13.2239 12.2219 13 12.498 13H12.998C13.2742 13 13.498 13.2239 13.498 13.5Z" fill="white"/>
          </svg>
          <span className="ml-2 text-white font-semibold hidden md:block">Coinbase Pro</span>
        </Link>
        <button className="text-gray-400 hover:text-white md:hidden" onClick={toggleMobileMenu}>
          <span className="material-icons">menu</span>
        </button>
      </div>
      
      <nav className={`flex-1 overflow-y-auto py-4 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
        <ul>
          {navItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link 
                href={item.path} 
                className={`flex items-center px-4 py-3 rounded-md ${
                  location === item.path 
                    ? 'text-[#0052FF] bg-[#0052FF] bg-opacity-10' 
                    : 'text-gray-300 hover:bg-[#0052FF] hover:bg-opacity-10 hover:text-white'
                }`}
              >
                <span className="material-icons w-6 h-6">{item.icon}</span>
                <span className={`ml-2 ${location === item.path ? 'font-medium' : ''} hidden md:block`}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-[#3A3A3A]">
        <div className="flex items-center justify-between md:justify-start">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-[#3A3A3A] flex items-center justify-center text-white">
              <span className="material-icons text-sm">person</span>
            </div>
            <span className="ml-2 text-sm font-medium text-gray-300 hidden md:block">User</span>
          </div>
          <button className="ml-4 text-gray-400 hover:text-white">
            <span className="material-icons text-xl">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
