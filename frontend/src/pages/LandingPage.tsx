import React from 'react';
import { ScrollPortal } from '../components/landing/ScrollPortal';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#05030a] text-slate-100 selection:bg-purple-600/40 selection:text-white">
      <ScrollPortal />
    </div>
  );
};
