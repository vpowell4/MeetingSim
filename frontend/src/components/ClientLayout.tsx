'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if we should show sidebar
  const showSidebar = pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register') && pathname !== '/';

  return (
    <>
      {showSidebar && <Sidebar />}
      <div className={showSidebar ? 'lg:pl-64' : ''}>
        {children}
      </div>
    </>
  );
}
