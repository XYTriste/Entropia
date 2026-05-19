import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Play,
  BarChart3,
  Edit3,
  SwitchCamera,
  Upload,
  ClipboardList,
  Moon,
  Sun,
} from 'lucide-react';
import MobileDrawer from './MobileDrawer';
import { useTheme } from './ThemeContext';

const navItems = [
  { label: '仪表盘', path: '/dashboard', icon: LayoutDashboard },
  { label: '基础数据', path: '/base-data', icon: Settings },
  { label: '智能排考', path: '/scheduler', icon: Play },
  { label: '排考结果', path: '/results', icon: BarChart3 },
  { label: '手动微调', path: '/adjustments', icon: Edit3 },
  { label: '教师调剂', path: '/transfer', icon: SwitchCamera },
  { label: '导入导出', path: '/import-export', icon: Upload },
  { label: '审计日志', path: '/audit-logs', icon: ClipboardList },
];

export default function Header() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass-panel shadow-lg'
          : 'bg-white/40 dark:bg-[#161B22]/60 backdrop-blur-md border-b border-white/40'
      } dark:bg-[#161B22]/80 dark:border-[#30363D]/40`}
      style={{
        boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Mobile: Hamburger + Logo */}
        <div className="flex items-center gap-3 md:hidden">
          <MobileDrawer />
          <img src="/images/logo.png" alt="云智排考" className="w-7 h-7 object-contain" />
          <span className="font-display text-base font-semibold text-[#1F2328] dark:text-[#E6EDF3] dark:text-[#E6EDF3]">云智排考</span>
        </div>

        {/* Desktop: Logo */}
        <div className="hidden md:flex items-center gap-3">
          <img src="/images/logo.png" alt="云智排考" className="w-8 h-8 object-contain" />
          <span className="font-display text-lg font-semibold text-[#1F2328] dark:text-[#E6EDF3] tracking-wide dark:text-[#E6EDF3]">
            云智排考
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative px-4 py-2 rounded-xl transition-all duration-300 group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-xl transition-all duration-300"
                    style={{
                      background: 'rgba(212, 163, 115, 0.12)',
                      boxShadow: '0 0 12px rgba(212, 163, 115, 0.15)',
                    }}
                  />
                )}
                <div className="relative flex items-center gap-2">
                  <Icon
                    size={16}
                    className={`transition-colors duration-300 ${
                      isActive
                        ? 'text-[#D4A373]'
                        : hoveredIndex === index
                        ? 'text-[#D4A373]'
                        : 'text-[#8C959F] dark:text-[#8B949E]'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium transition-colors duration-300 ${
                      isActive
                        ? 'text-[#D4A373]'
                        : hoveredIndex === index
                        ? 'text-[#D4A373]'
                        : 'text-[#8C959F] dark:text-[#8B949E]'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {!isActive && hoveredIndex === index && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full animate-pulse"
                    style={{ backgroundColor: '#D4A373' }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Theme Toggle + User */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/60 dark:bg-[#21262D]/80 dark:bg-[#30363D]/60 hover:bg-[#D4A373]/10 dark:hover:bg-[#D4A373]/20 transition-all"
            title={theme === 'light' ? '切换到夜间模式' : '切换到日间模式'}
          >
            {theme === 'light' ? (
              <Moon size={16} className="text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373]" />
            ) : (
              <Sun size={16} className="text-[#D4A373]" />
            )}
          </button>

          {/* User - desktop */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#C8CDD3] dark:border-[#484F58] dark:border-[#30363D] flex items-center justify-center bg-white/80 dark:bg-[#21262D] dark:bg-[#21262D]">
              <span className="text-xs font-medium text-[#8C959F] dark:text-[#8B949E] dark:text-[#8B949E]">管</span>
            </div>
            <span className="text-sm text-[#8C959F] dark:text-[#8B949E] dark:text-[#8B949E]">管理员</span>
          </div>

          {/* Mobile: user avatar only */}
          <div className="flex md:hidden items-center">
            <div className="w-8 h-8 rounded-full border border-[#C8CDD3] dark:border-[#484F58] dark:border-[#30363D] flex items-center justify-center bg-white/80 dark:bg-[#21262D] dark:bg-[#21262D]">
              <span className="text-xs font-medium text-[#8C959F] dark:text-[#8B949E] dark:text-[#8B949E]">管</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
