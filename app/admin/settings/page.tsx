"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function AdminSettings() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [settings, setSettings] = useState({
    hotelName: "",
    hotelAddress: "",
    managementCompany: "",
    gstin: "",
    contact: "",
    gstPercentage: 0,
    extraBedCharge: 350
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();

    // Load settings from local storage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("hotelSettings");
      if (saved) {
        try {
          setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
        } catch (e) {
          console.error("Failed to parse settings");
        }
      }
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: (name === 'gstPercentage' || name === 'extraBedCharge') ? parseFloat(value) || 0 : value
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem("hotelSettings", JSON.stringify(settings));
    setTimeout(() => {
      setIsSaving(false);
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 500);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/settings" hotelName={settings.hotelName} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Hotel Settings</h2>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {successMsg && (
              <div className="p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMsg}
              </div>
            )}

            {/* Hotel Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Hotel Information
              </h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Hotel Name</label>
                  <input
                    type="text"
                    name="hotelName"
                    value={settings.hotelName}
                    onChange={handleChange}
                    placeholder="Enter your hotel name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Hotel Address</label>
                  <input
                    type="text"
                    name="hotelAddress"
                    value={settings.hotelAddress}
                    onChange={handleChange}
                    placeholder="Enter hotel full address"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Management Company (Optional)</label>
                  <input
                    type="text"
                    name="managementCompany"
                    value={settings.managementCompany}
                    onChange={handleChange}
                    placeholder="e.g. ABC Hospitality Pvt. Ltd."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                  <p className="text-xs text-gray-400 mt-1">Shown on bills as &quot;Managed by ...&quot;</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reception Contact</label>
                  <input
                    type="text"
                    name="contact"
                    value={settings.contact}
                    onChange={handleChange}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Billing Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Bill Generator Configuration
              </h3>
              
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">GSTIN Number (Optional)</label>
                    <input
                      type="text"
                      name="gstin"
                      value={settings.gstin}
                      onChange={handleChange}
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Default GST Percentage (%)</label>
                    <input
                      type="number"
                      name="gstPercentage"
                      value={settings.gstPercentage}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      placeholder="e.g. 12"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Default Extra Bed Charge (Rs.)</label>
                  <input
                    type="number"
                    name="extraBedCharge"
                    value={settings.extraBedCharge}
                    onChange={handleChange}
                    min="0"
                    placeholder="e.g. 350"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-md"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(AdminSettings), { ssr: false });
