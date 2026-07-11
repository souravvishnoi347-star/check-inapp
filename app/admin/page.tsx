"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

type Booking = {
  id: number;
  created_at: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount?: number;
  agreed_price?: number;
  room_number?: string;
  payment_type?: string;
  male_guests?: number;
  female_guests?: number;
};

type Guest = {
  id: number;
  booking_id: number;
  name: string;
  age: number;
  id_image_url: string;
  id_image_back_url?: string;
  phone: string;
};

type MergedBookingData = Booking & {
  primary_guest_name: string;
  primary_guest_phone: string;
  total_guests: number;
  guests: Guest[];
};

import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function AdminDashboard() {
  const router = useRouter();
  
  // Auth & Settings state
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "",
    hotelAddress: "",
    managementCompany: "",
    gstin: "",
    contact: "",
    gstPercentage: 0,
    extraBedCharge: 350
  });

  // New feature stats
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [agentOutstanding, setAgentOutstanding] = useState(0);
  
  // Data state
  const [data, setData] = useState<MergedBookingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MergedBookingData | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [ratePerNight, setRatePerNight] = useState("");
  const [isExtraBed, setIsExtraBed] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [guestGst, setGuestGst] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [selectedBookingForGuests, setSelectedBookingForGuests] = useState<MergedBookingData | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MergedBookingData | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editAgreedPrice, setEditAgreedPrice] = useState("");
  const [editPaymentType, setEditPaymentType] = useState("cash");
  const [editMaleGuests, setEditMaleGuests] = useState("");
  const [editFemaleGuests, setEditFemaleGuests] = useState("");
  const [editGuests, setEditGuests] = useState<Guest[]>([]);

  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Settings
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
        fetchExpenseAndAgentStats();
      }
    };
    
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/admin/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("Bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (bookingsError) throw new Error(bookingsError.message);

      const { data: guestsData, error: guestsError } = await supabase
        .from("Guests")
        .select("*")
        .order("id", { ascending: true });

      if (guestsError) throw new Error(guestsError.message);

      const merged: MergedBookingData[] = (bookingsData || []).map((booking: Booking) => {
        const relatedGuests = (guestsData || []).filter(
          (g: Guest) => g.booking_id === booking.id
        );
        
        const primaryGuestName = relatedGuests.length > 0 
          ? relatedGuests[0].name 
          : "Unknown";
          
        const primaryGuestPhone = relatedGuests.length > 0 
          ? relatedGuests[0].phone 
          : "";

        return {
          ...booking,
          primary_guest_name: primaryGuestName,
          primary_guest_phone: primaryGuestPhone,
          total_guests: relatedGuests.length,
          guests: relatedGuests
        };
      });

      setData(merged);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch data. Ensure your session is valid and RLS allows SELECT.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchExpenseAndAgentStats = async () => {
    try {
      // Fetch today's expenses
      const today = new Date().toISOString().slice(0, 10);
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('expense_date', today);
      
      if (expensesData) {
        const total = expensesData.reduce((sum: number, e: { amount: number }) => sum + (Number(e.amount) || 0), 0);
        setTodayExpenses(total);
      }
    } catch (e) {
      // expenses table may not exist yet, silently ignore
    }

    try {
      // Fetch agent outstanding
      const { data: txData } = await supabase
        .from('agent_transactions')
        .select('transaction_type, amount');
      
      if (txData) {
        const totalCredit = txData.filter((t: { transaction_type: string }) => t.transaction_type === 'credit').reduce((sum: number, t: { amount: number }) => sum + (Number(t.amount) || 0), 0);
        const totalPayments = txData.filter((t: { transaction_type: string }) => t.transaction_type === 'payment').reduce((sum: number, t: { amount: number }) => sum + (Number(t.amount) || 0), 0);
        setAgentOutstanding(totalCredit - totalPayments);
      }
    } catch (e) {
      // agents table may not exist yet, silently ignore
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
    fetchExpenseAndAgentStats();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const handleDeleteBooking = async (bookingId: number) => {
    const password = window.prompt("Enter admin password to delete this booking:");
    if (password === null) return;
    
    if (password !== "admin1458") {
      alert("Incorrect password! Access denied.");
      return;
    }

    if (window.confirm("Are you sure you want to permanently delete this booking?")) {
      try {
        const { error: guestError } = await supabase.from('Guests').delete().eq('booking_id', bookingId);
        if (guestError) throw guestError;

        const { error: bookingError } = await supabase.from('Bookings').delete().eq('id', bookingId);
        if (bookingError) throw bookingError;

        alert("Booking deleted successfully.");
        fetchData();
      } catch (err: any) {
        console.error("Error deleting booking:", err);
        alert("Failed to delete booking: " + err.message);
      }
    }
  };

  const openEditModal = (booking: MergedBookingData) => {
    setEditingBooking(booking);
    setEditCheckIn(booking.check_in_date);
    setEditCheckOut(booking.check_out_date);
    setEditRoomNumber(booking.room_number || "");
    setEditAgreedPrice(booking.agreed_price ? booking.agreed_price.toString() : "");
    setEditPaymentType(booking.payment_type || "cash");
    setEditMaleGuests(booking.male_guests !== undefined ? booking.male_guests.toString() : "0");
    setEditFemaleGuests(booking.female_guests !== undefined ? booking.female_guests.toString() : "0");
    setEditGuests(JSON.parse(JSON.stringify(booking.guests)));
    setIsEditModalOpen(true);
  };

  const handleEditGuestChange = (guestId: number, field: 'name' | 'age', value: string) => {
    setEditGuests(prev => 
      prev.map(g => g.id === guestId ? { ...g, [field]: field === 'age' ? parseInt(value) || 0 : value } : g)
    );
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    try {
      setIsLoading(true);
      const { error: bookingError } = await supabase
        .from('Bookings')
        .update({ 
          check_in_date: editCheckIn, 
          check_out_date: editCheckOut,
          room_number: editRoomNumber || null,
          agreed_price: editAgreedPrice ? parseFloat(editAgreedPrice) : null,
          payment_type: editPaymentType,
          male_guests: parseInt(editMaleGuests) || 0,
          female_guests: parseInt(editFemaleGuests) || 0
        })
        .eq('id', editingBooking.id);
      
      if (bookingError) throw bookingError;

      for (const guest of editGuests) {
        const { error: guestError } = await supabase
          .from('Guests')
          .update({ name: guest.name, age: guest.age })
          .eq('id', guest.id);
        if (guestError) throw guestError;
      }

      alert("Booking updated successfully!");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Error saving edits:", err);
      alert("Failed to save changes: " + err.message);
      setIsLoading(false);
    }
  };

  const openGuestsModal = (booking: MergedBookingData) => {
    setSelectedBookingForGuests(booking);
    setIsGuestsModalOpen(true);
  };



  const filteredData = data.filter((booking) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      booking.id.toString().includes(query) || 
      booking.primary_guest_name.toLowerCase().includes(query);

    let matchesDate = true;
    if (dateFilter !== "All Time") {
      const today = new Date();
      today.setHours(0,0,0,0);

      const bookingDate = new Date(booking.check_in_date);
      bookingDate.setHours(0,0,0,0);

      if (dateFilter === "Today") {
        matchesDate = bookingDate.getTime() === today.getTime();
      } else if (dateFilter === "This Week") {
        const firstDayOfWeek = new Date(today.getTime());
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        matchesDate = bookingDate >= firstDayOfWeek;
      } else if (dateFilter === "This Month") {
        matchesDate = bookingDate.getMonth() === today.getMonth() && bookingDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === "Custom Range") {
        const start = customStartDate ? new Date(customStartDate) : null;
        if (start) start.setHours(0,0,0,0);
        const end = customEndDate ? new Date(customEndDate) : null;
        if (end) end.setHours(23,59,59,999);
        
        if (start && end) {
          matchesDate = bookingDate >= start && bookingDate <= end;
        } else if (start) {
          matchesDate = bookingDate >= start;
        } else if (end) {
          matchesDate = bookingDate <= end;
        }
      }
    }

    return matchesSearch && matchesDate;
  });

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
      <AdminSidebar activePath="/admin" hotelName={hotelSettings.hotelName} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header & Settings Button */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard Overview</h1>
                <p className="text-slate-500 mt-1">Manage bookings, guests, and hotel settings.</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center justify-center p-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
                  title="Refresh Data"
                >
                  <svg className={`w-5 h-5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Recent Bookings</p>
                  <h2 className="text-4xl font-black">{filteredData.length}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-lg shadow-amber-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-amber-100 text-sm font-medium uppercase tracking-wider mb-1">Total Guests</p>
                  <h2 className="text-4xl font-black">{filteredData.reduce((acc, curr) => acc + curr.total_guests, 0)}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-rose-200 relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-rose-100 text-sm font-medium uppercase tracking-wider mb-1">Total Revenue</p>
                  <h2 className="text-3xl font-black">Rs. {filteredData.reduce((acc, curr) => acc + (Number(curr.agreed_price) || 0), 0).toLocaleString('en-IN')}</h2>
                </div>
                <svg className="absolute right-[-10%] top-[-10%] w-32 h-32 text-white opacity-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              </div>
            </div>

            {/* New Feature Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <a href="/admin/expenses" className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today&apos;s Expenses</p>
                  <p className="text-2xl font-black text-gray-800">Rs. {todayExpenses.toLocaleString('en-IN')}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 ml-auto group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
              <a href="/admin/agents" className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Agent Outstanding</p>
                  <p className="text-2xl font-black text-red-600">Rs. {agentOutstanding.toLocaleString('en-IN')}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 ml-auto group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by Guest Name or Booking ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== "Custom Range") {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }
                }}
                className="w-full sm:w-auto p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-gray-700"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today's Check-ins</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom Range">Custom Date Range</option>
              </select>

              {dateFilter === "Custom Range" && (
                <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in slide-in-from-left-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full sm:w-auto p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-gray-700"
                    title="Start Date"
                  />
                  <span className="text-gray-500 font-medium px-1">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full sm:w-auto p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-gray-700"
                    title="End Date"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Booking ID</th>
                    <th className="px-6 py-4">Primary Guest</th>
                    <th className="px-6 py-4">Check In</th>
                    <th className="px-6 py-4">Room No</th>
                    <th className="px-6 py-4">Agreed Price</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Guests</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        <div className="flex justify-center mb-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                        Loading bookings...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        No bookings found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                          #{booking.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                          {booking.primary_guest_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(booking.check_in_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                          {booking.room_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                          {booking.agreed_price ? `Rs. ${booking.agreed_price}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {booking.payment_type === 'credit' ? (
                            <span className="bg-amber-100 text-amber-700 py-1 px-3 rounded-full text-xs font-semibold">Credit</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 py-1 px-3 rounded-full text-xs font-semibold">Cash</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-blue-50 text-blue-700 py-0.5 px-2 rounded text-xs font-semibold">{booking.male_guests || 0}M</span>
                            <span className="bg-pink-50 text-pink-700 py-0.5 px-2 rounded text-xs font-semibold">{booking.female_guests || 0}F</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openGuestsModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-emerald-600 hover:border-emerald-200 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="View IDs"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View IDs
                            </button>

                            <button
                              onClick={() => openEditModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="Edit Booking"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                              title="Delete Booking"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* View Guests / IDs Modal */}
      {isGuestsModalOpen && selectedBookingForGuests && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGuestsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Guest Details & IDs (Booking #{selectedBookingForGuests.id})</h3>
              <button 
                onClick={() => setIsGuestsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedBookingForGuests.guests.map((guest, idx) => (
                  <div key={guest.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900">{guest.name} {idx === 0 ? "(Primary)" : ""}</h4>
                        <p className="text-xs text-gray-500 mt-1">Age: {guest.age} {guest.phone ? `| Phone: ${guest.phone}` : ''}</p>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-4 bg-gray-100 min-h-[250px]">
                      {!guest.id_image_url && !guest.id_image_back_url ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-gray-400 text-sm font-medium">No ID Image Uploaded</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {guest.id_image_url && (
                            <div className="relative group">
                              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Front Side</p>
                              <a href={guest.id_image_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer group-hover:shadow-lg transition-all rounded-lg overflow-hidden border border-slate-200">
                                <img loading="lazy" src={guest.id_image_url} alt={`${guest.name} ID Front`} className="w-full object-contain max-h-[250px] bg-white transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                  <span className="text-white font-medium bg-black/70 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Full Size
                                  </span>
                                </div>
                              </a>
                            </div>
                          )}
                          {guest.id_image_back_url && (
                            <div className="relative group pt-4 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Back Side</p>
                              <a href={guest.id_image_back_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer group-hover:shadow-lg transition-all rounded-lg overflow-hidden border border-slate-200">
                                <img loading="lazy" src={guest.id_image_back_url} alt={`${guest.name} ID Back`} className="w-full object-contain max-h-[250px] bg-white transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                  <span className="text-white font-medium bg-black/70 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Full Size
                                  </span>
                                </div>
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {isEditModalOpen && editingBooking && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Edit Booking #{editingBooking.id}</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Booking Dates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <input 
                        type="date" 
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                      <input 
                        type="date" 
                        value={editCheckOut}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Room & Price Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <input 
                        type="text" 
                        value={editRoomNumber}
                        onChange={(e) => setEditRoomNumber(e.target.value)}
                        placeholder="e.g. 101"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Agreed Price (Rs.)</label>
                      <input 
                        type="number" 
                        value={editAgreedPrice}
                        onChange={(e) => setEditAgreedPrice(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditPaymentType('cash')}
                        className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all border-2 ${
                          editPaymentType === 'cash'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPaymentType('credit')}
                        className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all border-2 ${
                          editPaymentType === 'credit'
                            ? 'bg-amber-50 border-amber-500 text-amber-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        💳 Credit
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Guest Count</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <label className="block text-xs font-semibold text-blue-600 mb-1 uppercase">Male</label>
                      <input 
                        type="number" 
                        value={editMaleGuests}
                        onChange={(e) => setEditMaleGuests(e.target.value)}
                        min="0"
                        className="w-full p-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 bg-white font-bold text-center"
                      />
                    </div>
                    <div className="bg-pink-50 p-3 rounded-lg border border-pink-100">
                      <label className="block text-xs font-semibold text-pink-600 mb-1 uppercase">Female</label>
                      <input 
                        type="number" 
                        value={editFemaleGuests}
                        onChange={(e) => setEditFemaleGuests(e.target.value)}
                        min="0"
                        className="w-full p-2 border border-pink-200 rounded-md focus:ring-2 focus:ring-pink-500 outline-none text-sm text-gray-900 bg-white font-bold text-center"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">Total: {(parseInt(editMaleGuests) || 0) + (parseInt(editFemaleGuests) || 0)} guests</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Primary Guest Details</h4>
                  <div className="space-y-4">
                    {editGuests.map((guest, index) => (
                      <div key={guest.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                            <input 
                              type="text" 
                              value={guest.name}
                              onChange={(e) => handleEditGuestChange(guest.id, 'name', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                            <input 
                              type="number" 
                              value={guest.age}
                              onChange={(e) => handleEditGuestChange(guest.id, 'age', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(AdminDashboard), { ssr: false });
