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
  X,
  Menu,
} from 'lucide-react';

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

export default function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Hamburger Button - only visible on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#D4A373]/10 transition-colors"
        aria-label="打开菜单"
      >
        <Menu size={22} className="text-[#1F2328] dark:text-[#E6EDF3]" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-[70] w-[280px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6] dark:border-[#30363D]">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="云智排考" className="w-7 h-7 object-contain" />
            <span className="font-display text-base font-semibold text-[#1F2328] dark:text-[#E6EDF3]">云智排考</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D] transition-colors"
          >
            <X size={18} className="text-[#8C959F] dark:text-[#8B949E]" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#D4A373]/10 text-[#D4A373]'
                    : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] hover:text-[#1F2328] dark:text-[#E6EDF3]'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#F3F4F6] dark:border-[#30363D]">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full border border-[#C8CDD3] dark:border-[#484F58] flex items-center justify-center bg-white/80 dark:bg-[#21262D]">
              <span className="text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">管</span>
            </div>
            <span className="text-sm text-[#8C959F] dark:text-[#8B949E]">管理员</span>
          </div>
        </div>
      </div>
    </>
  );
}
