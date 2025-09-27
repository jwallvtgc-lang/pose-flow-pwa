import { useState } from 'react';
import { X, Menu, Home, Video, BarChart3, History, Trophy, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Video, label: 'Record Swing', path: '/score' },
    { icon: BarChart3, label: 'Analytics', path: '/progress', badge: 'New' },
    { icon: History, label: 'Swing History', path: '/recent-swings' },
    { icon: Trophy, label: 'Achievements', path: '/achievements' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <>
      {/* Menu Button */}
      <button
        onClick={toggleMenu}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Menu"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMenu}
        />
      )}

      {/* Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">SS</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">SwingSense Pro</h2>
              <p className="text-sm text-gray-600">Smart Baseball Analytics</p>
            </div>
          </div>
          <button
            onClick={toggleMenu}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-6">
          <ul className="space-y-4">
            {menuItems.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <item.icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-gray-800 font-medium text-lg">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}