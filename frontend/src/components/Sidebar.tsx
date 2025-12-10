'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearAuth, getStoredUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { User } from '@/types/api';
import Image from 'next/image';
import ProfileModal from './ProfileModal';
import BillingModal from './BillingModal';
import AboutModal from './AboutModal';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    // Update localStorage
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Agent Library', href: '/agent-library', icon: '👥' },
    { name: 'Minutes Library', href: '/minutes', icon: '📝' },
    { name: 'Meeting Process', href: '/meeting-process', icon: '📚' },
    { name: 'New Meeting', href: '/meetings/new', icon: '➕' },
  ];

  // Add admin link for privileged users
  const adminNavigation = user && ['super', 'admin', 'manager'].includes(user.role)
    ? [{ name: 'Administration', href: '/admin', icon: '⚙️' }]
    : [];

  const allNavigation = [...navigation, ...adminNavigation];

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        <span className="text-xl">{isMobileMenuOpen ? '✕' : '☰'}</span>
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
      {/* Logo and Title */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-gray-200">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <Image src="/logo.svg" alt="Logo" width={32} height={32} />
        </div>
        {!isCollapsed && <span className="text-lg font-bold text-gray-900">Meeting Sim</span>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto p-1 hover:bg-gray-100 rounded hidden lg:block"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="text-gray-600">{isCollapsed ? '→' : '←'}</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {allNavigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        {user && !isCollapsed && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full mb-3 px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.full_name || user.email}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </button>

            {/* User Menu Popup */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span>👤</span>
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowBillingModal(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <span>💳</span>
                  <span>Billing</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAboutModal(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <span>ℹ️</span>
                  <span>About</span>
                </button>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <span>🚪</span>
          {!isCollapsed && 'Logout'}
        </button>
      </div>
    </div>

    {/* Modals */}
    <ProfileModal
      isOpen={showProfileModal}
      onClose={() => setShowProfileModal(false)}
      user={user!}
      onUpdate={handleUserUpdate}
    />
    <BillingModal
      isOpen={showBillingModal}
      onClose={() => setShowBillingModal(false)}
    />
    <AboutModal
      isOpen={showAboutModal}
      onClose={() => setShowAboutModal(false)}
    />
    </>
  );
}
