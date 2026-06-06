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
    hotelName: "HOTEL SATYAM SWAGAT",
    hotelAddress: "ARYA NAGAR HARIDWAR UTTARAKHAND",
    gstin: "",
    contact: "+91 9528255318",
    gstPercentage: 0,
    extraBedCharge: 350
  });
  
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
  const [dateFilter, setDateFilter] = useState("All Time");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MergedBookingData | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editAgreedPrice, setEditAgreedPrice] = useState("");
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
        .order("created_at", { ascending: false });

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
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
          agreed_price: editAgreedPrice ? parseFloat(editAgreedPrice) : null
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

  const openBillModal = (booking: MergedBookingData) => {
    setSelectedBooking(booking);
    setRoomNumber("");
    setRoomType("");
    setRatePerNight("");
    setPaymentMode("Cash");
    setGuestGst("");
    setIsModalOpen(true);
  };

  const handleDownloadPDF = async () => {
    if (!selectedBooking) return;
    setIsDownloading(true);
    try {
      const element = invoiceRef.current;
      if (!element) throw new Error("Invoice template not found");

      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 0,
        filename: `Bill_${selectedBooking.id}_${selectedBooking.primary_guest_name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      html2pdf().set(opt).from(element).save().then(async () => {
        try {
          const currentCalc = getCalculations();
          const { error: updateError } = await supabase
            .from("Bookings")
            .update({ status: 'Checked-Out', total_amount: currentCalc.grandTotal })
            .eq('id', selectedBooking.id);
          
          if (updateError) {
            console.error("Failed to update status:", updateError);
            if (updateError.message?.includes("total_amount") || updateError.code === "PGRST204" || updateError.code === "42703") {
              const { error: fallbackError } = await supabase
                .from("Bookings")
                .update({ status: 'Checked-Out' })
                .eq('id', selectedBooking.id);
                
              if (!fallbackError) {
                alert("WARNING: Guest checked out, but Revenue was NOT saved. You must add a 'total_amount' (numeric) column to your Supabase Bookings table for the Revenue tab to work!");
                fetchData();
              } else {
                alert("Failed to update booking in database: " + fallbackError.message);
              }
            } else {
              alert("Failed to update booking in database: " + updateError.message);
            }
          } else {
            fetchData();
          }
        } catch (err) {
          console.error("Unexpected error in PDF success handler:", err);
        }
        
        setIsModalOpen(false);
        setIsDownloading(false);
      }).catch((err: any) => {
        console.error("PDF Generation failed:", err);
        alert("Failed to generate PDF: " + (err?.message || JSON.stringify(err)));
        setIsDownloading(false);
      });

    } catch (err: any) {
      console.error("PDF Initialization failed:", err);
      alert("Failed to start PDF: " + (err?.message || JSON.stringify(err)));
      setIsDownloading(false);
    }
  };

  // Calculations for Live Preview
  const getCalculations = () => {
    if (!selectedBooking) return { checkIn: "", checkOut: "", duration: 1, rate: 0, subtotal: 0, gstAmount: 0, grandTotal: 0, advance: 0, balance: 0, extraBedTotal: 0 };
    
    const checkInDate = new Date(selectedBooking.check_in_date);
    const checkOutDate = new Date(selectedBooking.check_out_date);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    let duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (duration === 0) duration = 1;

    const rate = parseFloat(ratePerNight) || 0;
    const extraBedTotal = isExtraBed ? ((hotelSettings.extraBedCharge || 350) * duration) : 0;
    
    const subtotal = (rate * duration) + extraBedTotal;
    const gstAmount = subtotal * ((hotelSettings.gstPercentage || 0) / 100);
    const grandTotal = subtotal + gstAmount;

    return {
      checkIn: checkInDate.toLocaleDateString(),
      checkOut: checkOutDate.toLocaleDateString(),
      duration,
      rate,
      subtotal,
      gstAmount,
      grandTotal,
      extraBedTotal
    };
  };

  const calc = getCalculations();

  const filteredData = data.filter((booking) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      booking.id.toString().includes(query) || 
      booking.primary_guest_name.toLowerCase().includes(query);

    let matchesDate = true;
    if (dateFilter !== "All Time") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(booking.check_in_date);
      
      if (dateFilter === "Today") {
        matchesDate = bookingDate >= today && bookingDate < new Date(today.getTime() + 86400000);
      } else if (dateFilter === "This Week") {
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        firstDayOfWeek.setHours(0, 0, 0, 0);
        matchesDate = bookingDate >= firstDayOfWeek;
      } else if (dateFilter === "This Month") {
        matchesDate = bookingDate.getMonth() === new Date().getMonth() && bookingDate.getFullYear() === new Date().getFullYear();
      } else {
        const selectedDate = new Date(dateFilter);
        selectedDate.setHours(0, 0, 0, 0);
        
        const bIn = new Date(booking.check_in_date);
        bIn.setHours(0, 0, 0, 0);
        const bOut = new Date(booking.check_out_date);
        bOut.setHours(0, 0, 0, 0);
        
        matchesDate = selectedDate >= bIn && selectedDate <= bOut;
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
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Recent Bookings</h2>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Bookings</span>
              <span className="text-3xl font-bold text-gray-900">{filteredData.length}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Active Guests</span>
              <span className="text-3xl font-bold text-indigo-600">{filteredData.filter(b => b.status !== 'Checked-Out').length}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Available Rooms</span>
              <span className="text-3xl font-bold text-emerald-600">{25 - filteredData.filter(b => b.status !== 'Checked-Out').length}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Revenue</span>
              <span className="text-3xl font-bold text-amber-600">Rs. {filteredData.reduce((acc, b) => acc + (b.status === 'Checked-Out' ? (b.total_amount || 0) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
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
            
            <div className="w-full sm:w-auto flex items-center gap-2">
              <input
                type="date"
                value={["All Time", "Today", "This Week", "This Month"].includes(dateFilter) ? "" : dateFilter}
                onChange={(e) => setDateFilter(e.target.value || "All Time")}
                className="w-full sm:w-auto p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-gray-700"
              />
              <select
                value={["All Time", "Today", "This Week", "This Month"].includes(dateFilter) ? dateFilter : "Custom"}
                onChange={(e) => {
                  if (e.target.value !== "Custom") {
                    setDateFilter(e.target.value);
                  }
                }}
                className="w-full sm:w-auto p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-gray-700"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today's Check-ins</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom" disabled hidden>Custom Date</option>
              </select>
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
                    <th className="px-6 py-4">Check-Out</th>
                    <th className="px-6 py-4">Room No</th>
                    <th className="px-6 py-4">Agreed Price</th>
                    <th className="px-6 py-4">Total Guests</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <div className="flex justify-center mb-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                        </div>
                        Loading bookings...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(booking.check_out_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                          {booking.room_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                          {booking.agreed_price ? `Rs. ${booking.agreed_price}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <span className="bg-gray-100 text-gray-700 py-1 px-3 rounded-full text-xs font-semibold">
                            {booking.total_guests} Guest{booking.total_guests !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {booking.status === 'Checked-Out' ? (
                            <span className="bg-gray-100 text-gray-600 py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider">Checked-Out</span>
                          ) : (
                            <span className="bg-green-100 text-green-700 py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Checked-In
                            </span>
                          )}
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
                              onClick={() => openBillModal(booking)}
                              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-all hover:shadow"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Generate Bill
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
      </main>

      {/* Premium Live Preview Bill Generation Modal */}
      {isModalOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
            
            {/* Left Column: Controls */}
            <div className="w-full md:w-1/3 p-6 border-r border-gray-100 bg-gray-50 overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Generate PDF Bill</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-5 flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Type</label>
                  <input
                    type="text"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="e.g. Deluxe AC"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Rate per Night (Rs)</label>
                  <input
                    type="number"
                    value={ratePerNight}
                    onChange={(e) => setRatePerNight(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={guestGst}
                    onChange={(e) => setGuestGst(e.target.value)}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent outline-none transition-all text-sm text-gray-900 bg-white uppercase"
                  />
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="extraBed"
                    checked={isExtraBed}
                    onChange={(e) => setIsExtraBed(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="extraBed" className="ml-2 text-sm font-bold text-gray-700 cursor-pointer">
                    Add Extra Bed (Rs. {hotelSettings.extraBedCharge || 350}/night)
                  </label>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-gray-200">
                <button
                  onClick={handleDownloadPDF}
                  disabled={!roomNumber || !roomType || !ratePerNight || isDownloading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF Bill
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Live PDF Preview */}
            <div className="w-full md:w-2/3 bg-gray-300 overflow-auto p-4 md:p-8 flex items-start justify-center relative inner-shadow">
              {/* Actual HTML Template that gets converted */}
              <div 
                ref={invoiceRef}
                id="invoice-template" 
                className="relative shrink-0 flex flex-col" 
                style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', backgroundColor: '#ffffff' }}
              >
                {/* Header */}
                <div className="text-center mb-8 pt-4 relative">
                  <div className="flex justify-center mb-4">
                    <img src="/logo.png" alt="Hotel Logo" className="h-24 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <h1 className="text-4xl font-extrabold tracking-wider uppercase" style={{ color: '#111827' }}>{hotelSettings.hotelName}</h1>
                  <p className="text-sm font-semibold mt-1 uppercase tracking-widest" style={{ color: '#6b7280' }}>Managed by Triloki Hospitality</p>
                  <p className="text-sm font-medium mt-2 tracking-wide uppercase" style={{ color: '#4b5563' }}>{hotelSettings.hotelAddress}</p>
                  
                  {hotelSettings.gstin && (
                    <p className="text-sm font-bold mt-1 uppercase tracking-widest" style={{ color: '#1f2937' }}>GSTIN: {hotelSettings.gstin}</p>
                  )}

                  <div className="mt-6">
                    <h2 className="text-xl font-bold tracking-widest border-b-[3px] inline-block pb-1 px-4" style={{ color: '#1f2937', borderColor: '#78350f' }}>
                      BOOKING CONFIRMATION
                    </h2>
                  </div>

                  {/* Invoice Number */}
                  <div className="text-right mt-4 mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#6b7280' }}>Invoice No.</p>
                    <p className="text-sm font-bold" style={{ color: '#111827' }}>INV-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{selectedBooking.id.toString().padStart(4, '0')}</p>
                  </div>
                </div>

                {/* Guest Details */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: '#78350f' }}>Guest Details</h3>
                  <table className="w-full text-left border-collapse border text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead style={{ backgroundColor: '#78350f', color: '#ffffff' }}>
                      <tr>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Guest Name</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Contact Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-4 border font-semibold" style={{ borderColor: '#d1d5db', color: '#111827' }}>{selectedBooking.primary_guest_name}</td>
                        <td className="py-3 px-4 border font-semibold" style={{ borderColor: '#d1d5db', color: '#111827' }}>{selectedBooking.primary_guest_phone || 'N/A'}</td>
                      </tr>
                      {guestGst && (
                        <tr>
                          <td className="py-2 px-4 border font-bold uppercase text-xs" style={{ borderColor: '#d1d5db', color: '#111827', backgroundColor: '#fffbeb' }}>Guest GSTIN</td>
                          <td className="py-2 px-4 border font-bold uppercase" style={{ borderColor: '#d1d5db', color: '#111827' }}>{guestGst}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Stay Details */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: '#78350f' }}>Stay Details</h3>
                  <table className="w-full text-left border-collapse border text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead style={{ backgroundColor: '#78350f', color: '#ffffff' }}>
                      <tr>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Check-in</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Check-out</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Room Type</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-4 border font-medium" style={{ borderColor: '#d1d5db', color: '#111827' }}>{calc.checkIn}</td>
                        <td className="py-3 px-4 border font-medium" style={{ borderColor: '#d1d5db', color: '#111827' }}>{calc.checkOut}</td>
                        <td className="py-3 px-4 border font-medium" style={{ borderColor: '#d1d5db', color: '#111827' }}>{roomType || '-'}</td>
                        <td className="py-3 px-4 border font-medium" style={{ borderColor: '#d1d5db', color: '#111827' }}>{calc.duration} Night(s)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Room & Pricing Details */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: '#78350f' }}>Room & Pricing Details</h3>
                  <table className="w-full text-left border-collapse border text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead style={{ backgroundColor: '#78350f', color: '#ffffff' }}>
                      <tr>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Description</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Qty</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Rate/Night</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Room Charges (Room {roomNumber || '-'})</td>
                        <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>{calc.duration}</td>
                        <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {calc.rate.toFixed(2)}</td>
                        <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {(calc.rate * calc.duration).toFixed(2)}</td>
                      </tr>
                      {isExtraBed && (
                        <tr>
                          <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Extra Bed Charge</td>
                          <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>{calc.duration}</td>
                          <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {(hotelSettings.extraBedCharge || 350).toFixed(2)}</td>
                          <td className="py-3 px-4 border" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {calc.extraBedTotal.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td colSpan={3} className="py-2 px-4 border font-bold text-right uppercase text-xs" style={{ borderColor: '#d1d5db', color: '#111827' }}>Subtotal</td>
                        <td className="py-2 px-4 border font-bold" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {calc.subtotal.toFixed(2)}</td>
                      </tr>
                      {hotelSettings.gstPercentage > 0 && (
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <td colSpan={3} className="py-2 px-4 border font-bold text-right uppercase text-xs" style={{ borderColor: '#d1d5db', color: '#111827' }}>GST ({hotelSettings.gstPercentage}%)</td>
                          <td className="py-2 px-4 border font-bold" style={{ borderColor: '#d1d5db', color: '#111827' }}>Rs. {calc.gstAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: '#fffbeb' }}>
                        <td colSpan={3} className="py-3 px-4 border font-bold text-right uppercase text-xs" style={{ borderColor: '#fde68a', color: '#78350f' }}>Grand Total</td>
                        <td className="py-3 px-4 border font-bold" style={{ borderColor: '#fde68a', color: '#78350f' }}>Rs. {calc.grandTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Payment Information */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: '#78350f' }}>Payment Information</h3>
                  <table className="w-full text-left border-collapse border text-sm" style={{ borderColor: '#d1d5db' }}>
                    <thead style={{ backgroundColor: '#78350f', color: '#ffffff' }}>
                      <tr>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Payment Mode</th>
                        <th className="py-2.5 px-4 border font-bold uppercase tracking-wide text-xs" style={{ borderColor: '#78350f' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-4 border font-bold uppercase" style={{ borderColor: '#d1d5db', color: '#111827' }}>{paymentMode}</td>
                        <td className="py-3 px-4 border font-bold" style={{ borderColor: '#d1d5db', color: '#15803d' }}>PAID: Rs. {calc.grandTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer pinned to bottom or pushed down naturally */}
                <div className="mt-auto pt-8">
                  <hr className="border-t-2 mb-4" style={{ borderColor: '#e5e7eb' }} />
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#1f2937' }}>Important Information:</h3>
                  <ul className="text-xs space-y-1.5 list-disc pl-5 mb-6 font-medium" style={{ color: '#4b5563' }}>
                    <li>Check-in time is 12:00 Noon.</li>
                    <li>Valid Government ID is required for all guests at check-in.</li>
                    <li>Strictly no smoking inside the rooms.</li>
                  </ul>
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-bold" style={{ color: '#78350f' }}>Reception Contact: {hotelSettings.contact}</p>
                    <div className="text-right">
                      <p className="text-xs border-t pt-1 px-4 inline-block" style={{ color: '#9ca3af', borderColor: '#d1d5db' }}>Authorized Signatory</p>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      )}

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
                              <a href={guest.id_image_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer">
                                <img src={guest.id_image_url} alt={`${guest.name} ID Front`} className="w-full object-contain max-h-[250px] rounded shadow-sm bg-white" />
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
                              <a href={guest.id_image_back_url} target="_blank" rel="noreferrer" className="block w-full relative cursor-pointer">
                                <img src={guest.id_image_back_url} alt={`${guest.name} ID Back`} className="w-full object-contain max-h-[250px] rounded shadow-sm bg-white" />
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
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Guest Details</h4>
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
