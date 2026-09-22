import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faUser } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { SignInButton, UserButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import useAppStore from '../../stores/useAppStore';
import packurbagIcon from '../../assets/packurbag_icon.png';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, setUser, openLoginModal } = useAppStore();

  // Only Home (external) and AI Trip Planner (internal)
  const links = [
    { href: 'https://packurbag.in/', label: 'Home', external: true },
    { to: '/schedule-trip', label: 'AI Trip Planner', external: false },
  ];

  return (
    <>
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#121619]/95 backdrop-blur-md shadow-lg no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo — links to packurbag.in */}
        <a href="https://packurbag.in/" className="flex items-center gap-2.5 cursor-pointer group">
          <img
            src={packurbagIcon}
            alt="PackUrBag"
            className="h-9 w-9 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform"
            onError={(e) => { e.target.src = '/files/packurbag_icon.png'; }}
          />
          <span className="text-white font-black text-xl tracking-tight font-display">
            Pack<span className="text-[#f97316]">Ur</span>Bag
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 text-white hover:bg-white/20"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  location.pathname === link.to
                    ? 'bg-white text-[#121619] shadow-md'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium">Hello, {user.name}</span>
              <button
                onClick={() => setUser(null)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs border border-white/20 rounded-full px-3 py-1.5 font-medium transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <SignedOut>
                <button
                  onClick={openLoginModal}
                  className="flex items-center gap-2 bg-[#D4B15A] hover:bg-[#b89542] text-white px-5 py-2 rounded-full font-medium transition-colors text-sm cursor-pointer"
                >
                  <FontAwesomeIcon icon={faUser} />
                  Login / Sign Up
                </button>
              </SignedOut>

              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          )}

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white text-xl p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#121619]/98 backdrop-blur-lg border-t border-white/10"
          >
            <div className="px-4 py-3 space-y-1">
              {links.map(link =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-all"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      location.pathname === link.to
                        ? 'bg-white text-[#121619]'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    </>
  );
}
