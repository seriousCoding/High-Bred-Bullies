
import React from 'react';
import { PawPrint } from 'lucide-react';
import { APP_NAME } from '@/constants/app';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-secondary text-secondary-foreground py-8 mt-16">
      <div className="container mx-auto px-6 text-center">
        <div className="flex justify-center items-center mb-4">
          <PawPrint className="h-6 w-6 mr-2 text-primary" />
          <p className="text-sm"><span className="text-yellow-500 font-semibold">{APP_NAME}</span> &copy; {currentYear}. All Rights Reserved.</p>
        </div>
        <p className="text-xs">Crafted with love for our furry friends.</p>
      </div>
    </footer>
  );
};

export default Footer;
