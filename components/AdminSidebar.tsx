"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { useState } from "react";

interface AdminSidebarProps {
  activePath: string;
  hotelName: string;
}

export default function AdminSidebar({ activePath, hotelName }: AdminSidebarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/admin",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: "Quick Bill",
      path: "/admin/quick-bill",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      name: "Generated Bills",
      path: "/admin/bills",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: "Settings",
      path: "/admin/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      name: "Back to Frontdesk",
      path: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      )
    }
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-4 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden p-0.5">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="font-bold tracking-tight truncate max-w-[200px]">{hotelName || "Admin Panel"}</span>
        </div>
        <button onClick={() => setIsOpen(true)} className="p-2 -mr-2 focus:outline-none text-slate-300 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white shadow-2xl flex flex-col justify-between z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="overflow-y-auto no-scrollbar">
          <div className="p-6 text-center border-b border-slate-800 flex flex-col items-center relative">
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-4 right-4 md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 overflow-hidden shadow-lg p-1 mt-2 md:mt-0">
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Admin Panel
            </h1>
            <p className="text-slate-400 text-sm mt-1">{hotelName || "Hotel App"}</p>
          </div>
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.name}>
                  <a 
                    href={item.path} 
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                      activePath === item.path 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors font-bold border border-transparent hover:border-red-500/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
