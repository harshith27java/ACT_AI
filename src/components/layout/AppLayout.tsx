import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, FolderKanban, ClipboardCheck, Settings, LogOut, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/review", label: "Review Queue", icon: ClipboardCheck },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
            <ArrowRightLeft size={16} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold leading-none text-gray-900">ACT</p>
            <p className="mt-0.5 text-[11px] leading-none text-gray-500">Content Transformation</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main navigation">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100",
                )
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-gray-200 px-3 py-3">
          <div className="px-3 py-1.5">
            <p className="truncate text-sm font-medium text-gray-900">{profile?.full_name || "User"}</p>
            <p className="truncate text-xs text-gray-500">{profile?.role ?? "OPERATOR"}</p>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100",
              )
            }
          >
            <Settings size={16} aria-hidden /> Settings
          </NavLink>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <LogOut size={16} aria-hidden /> Sign Out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
