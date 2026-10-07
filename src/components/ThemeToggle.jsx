// Sun/moon switch between the light and dark themes. useTheme owns the rule;
// this only shows which way a click goes.

import { Moon, Sun } from 'lucide-react';

const ThemeToggle = ({ isDark, onToggle, className = '' }) => {
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-center p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-all duration-200 shadow-sm ${className}`}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
};

export default ThemeToggle;
