"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

type Booking = {
  id: number;
  created_at: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount?: number;
};

type Guest = {
  id: number;
  booking_id: number;
  name: string;
  age: number;
  phone: string;
};

type MergedBookingData = Booking & {
  primary_guest_name: string;
  primary_guest_phone: string;
};

function BillsHistoryPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL SATYAM SWAGAT",
  });

  const [data, setData] = useState<MergedBookingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"All Time" | "Date">("Date");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("hotelSettings");
      if (savedSettings) {
        try {
          setHotelSettings(JSON.parse(savedSettings));
        } catch (e) {}
      }
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
        fetchData();
      }
    };
    checkSession();
  }, [router]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch ONLY Checked-Out bookings (which are the generated bills)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("Bookings")
        .select("*")
        .eq('status', 'Checked-Out')
        .order("created_at", { ascending: false });

      if (bookingsError) throw bookingsError;

      const { data: guestsData, error: guestsError } = await supabase
        .from("Guests")
        .select("*")
        .order("id", { ascending: true });

      if (guestsError) throw guestsError;

      const merged: MergedBookingData[] = (bookingsData || []).map((booking: Booking) => {
        const relatedGuests = (guestsData || []).filter(
          (g: Guest) => g.booking_id === booking.id
        );
        
        const primaryGuestName = relatedGuests.length > 0 
          ? relatedGuests[0].name 
          : "Walk-in Guest";
          
        const primaryGuestPhone = relatedGuests.length > 0 
          ? relatedGuests[0].phone 
          : "";

        return {
          ...booking,
          primary_guest_name: primaryGuestName,
          primary_guest_phone: primaryGuestPhone,
        };
      });

      setData(merged);
    } catch (err: any) {
      console.error(err);
      alert("Failed to load billing history");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter((booking) => {
    if (filterMode === "All Time") return true;
    
    // Check if the booking was generated (checked out) on the selected date.
    // We will use check_out_date or created_at. Usually created_at is when the record was made,
    // but check_out_date is the date of the bill. Let's use check_out_date to match the bill.
    const bOut = new Date(booking.check_out_date);
    const filterD = new Date(selectedDate);
    
    // Reset time to compare just the dates
    bOut.setHours(0, 0, 0, 0);
    filterD.setHours(0, 0, 0, 0);
    
    return bOut.getTime() === filterD.getTime();
  });

  const totalBills = filteredData.length;
  const totalRevenue = filteredData.reduce((sum, b) => sum + (b.total_amount || 0), 0);

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
      <AdminSidebar activePath="/admin/bills" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Generated Bills History</h2>
          <button 
            onClick={fetchData} 
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          
          {/* Controls & Metrics */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 border-r pr-4">
                <button
                  onClick={() => setFilterMode("Date")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterMode === "Date" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  By Date
                </button>
                <button
                  onClick={() => setFilterMode("All Time")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterMode === "All Time" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  All Time
                </button>
              </div>
              
              {filterMode === "Date" && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select Date:</span>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-indigo-100 border-l-4 border-l-indigo-500">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Bills Generated</p>
                <p className="text-2xl font-black text-gray-800">{totalBills}</p>
              </div>
              <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-emerald-100 border-l-4 border-l-emerald-500">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Billed</p>
                <p className="text-2xl font-black text-emerald-600">Rs. {totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice / Booking ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Guest Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Check-Out Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Billed Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <div className="flex justify-center mb-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                        Loading history...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                        No bills were generated on {filterMode === "Date" ? new Date(selectedDate).toLocaleDateString() : "record"}.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                          INV-{booking.id.toString().padStart(4, '0')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">
                          {booking.primary_guest_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {booking.primary_guest_phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {new Date(booking.check_out_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-black text-right">
                          Rs. {(booking.total_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(BillsHistoryPage), { ssr: false });
