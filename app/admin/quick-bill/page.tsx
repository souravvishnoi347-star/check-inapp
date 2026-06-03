"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

function QuickBillPage() {
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({
    hotelName: "HOTEL SATYAM SWAGAT",
    hotelAddress: "ARYA NAGAR HARIDWAR UTTARAKHAND",
    gstin: "",
    contact: "+91 9528255318",
    gstPercentage: 0,
    extraBedCharge: 350
  });

  // Form State
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState(new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [ratePerNight, setRatePerNight] = useState("");
  const [isExtraBed, setIsExtraBed] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [guestGst, setGuestGst] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // Temporary booking ID for invoice generation
  const [tempBookingId, setTempBookingId] = useState<number | null>(null);

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
      }
    };
    checkSession();
  }, [router]);

  const getCalculations = () => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    // Calculate nights, strictly minimum 1 night
    const diffTime = end.getTime() - start.getTime();
    let nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (nights <= 0 || isNaN(nights)) nights = 1;
    
    const rate = parseFloat(ratePerNight) || 0;
    
    const extraBedTotal = isExtraBed ? (hotelSettings.extraBedCharge * nights) : 0;
    const subtotal = (rate * nights) + extraBedTotal;
    
    const gstPercent = hotelSettings.gstPercentage || 0;
    const gstAmount = subtotal * (gstPercent / 100);
    const grandTotal = subtotal + gstAmount;

    return {
      duration: nights,
      rate,
      extraBedTotal,
      subtotal,
      gstAmount,
      grandTotal,
      checkIn: start.toLocaleDateString(),
      checkOut: end.toLocaleDateString()
    };
  };

  const handleGenerateBill = async () => {
    if (!guestName || !roomNumber || !roomType || !ratePerNight) {
      alert("Please fill in all required fields (Name, Room No, Room Type, Rate).");
      return;
    }

    setIsDownloading(true);

    try {
      const calc = getCalculations();

      // 1. Insert into Bookings with 'Checked-Out' status
      const { data: bookingData, error: bookingError } = await supabase
        .from("Bookings")
        .insert([{
          status: 'Checked-Out',
          total_amount: calc.grandTotal,
          check_in_date: checkIn,
          check_out_date: checkOut
        }])
        .select()
        .single();

      if (bookingError) {
        // Fallback if total_amount doesn't exist
        if (bookingError.message?.includes("total_amount") || bookingError.code === "PGRST204" || bookingError.code === "42703") {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("Bookings")
            .insert([{
              status: 'Checked-Out',
              check_in_date: checkIn,
              check_out_date: checkOut
            }])
            .select()
            .single();
            
          if (fallbackError) throw fallbackError;
          alert("WARNING: Bill generated but Revenue NOT tracked! Please add 'total_amount' column to Bookings table in Supabase.");
          await processGuestAndPDF(fallbackData.id, calc);
        } else {
          throw bookingError;
        }
      } else {
        await processGuestAndPDF(bookingData.id, calc);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating bill: " + err.message);
      setIsDownloading(false);
    }
  };

  const processGuestAndPDF = async (bookingId: number, calc: any) => {
    setTempBookingId(bookingId);

    // 2. Insert into Guests
    const { error: guestError } = await supabase
      .from("Guests")
      .insert([{
        booking_id: bookingId,
        name: guestName,
        phone: guestPhone || "",
        age: 30, // Default age for quick bill
        id_image_url: ""
      }]);

    if (guestError) {
      console.error("Guest insert error:", guestError);
      // Non-fatal, continue to PDF
    }

    // 3. Wait for state update then generate PDF
    setTimeout(async () => {
      const element = invoiceRef.current;
      if (!element) {
        alert("Invoice template missing.");
        setIsDownloading(false);
        return;
      }

      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `QuickBill_${bookingId}_${guestName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      html2pdf().set(opt).from(element).save().then(() => {
        setIsDownloading(false);
        // Clear form after success
        setGuestName("");
        setGuestPhone("");
        setRoomNumber("");
        setRoomType("");
        setRatePerNight("");
        setGuestGst("");
        setIsExtraBed(false);
        setTempBookingId(null);
      }).catch((e: any) => {
        console.error("PDF generation failed:", e);
        setIsDownloading(false);
        alert("Failed to generate PDF document.");
      });
    }, 500); // 500ms delay to ensure React renders the invoiceRef with tempBookingId
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Verifying access...</p>
      </div>
    );
  }

  const calc = getCalculations();

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/quick-bill" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Quick Bill Generator</h2>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 flex flex-col gap-8 h-max">
            
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Guest Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest Name *</label>
                  <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Phone Number</label>
                  <input type="text" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Mobile No." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Check-In Date *</label>
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Check-Out Date *</label>
                  <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Room & Billing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Number *</label>
                  <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 101" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Room Type *</label>
                  <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all">
                    <option value="">Select Type</option>
                    <option value="Standard Non-AC">Standard Non-AC</option>
                    <option value="Standard AC">Standard AC</option>
                    <option value="Deluxe AC">Deluxe AC</option>
                    <option value="Super Deluxe AC">Super Deluxe AC</option>
                    <option value="Family Suite">Family Suite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Rate/Night (Rs.) *</label>
                  <input type="number" value={ratePerNight} onChange={(e) => setRatePerNight(e.target.value)} placeholder="e.g. 1500" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all">
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Guest GSTIN (Optional)</label>
                  <input type="text" value={guestGst} onChange={(e) => setGuestGst(e.target.value)} placeholder="e.g. 22AAAAA0000A1Z5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 outline-none transition-all uppercase" />
                </div>
              </div>
              <div className="flex items-center mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200 w-max">
                <input type="checkbox" id="extraBed" checked={isExtraBed} onChange={(e) => setIsExtraBed(e.target.checked)} className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer" />
                <label htmlFor="extraBed" className="ml-3 text-sm font-bold text-gray-700 cursor-pointer">
                  Add Extra Bed (Rs. {hotelSettings.extraBedCharge || 350}/night)
                </label>
              </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 flex flex-col md:flex-row justify-between items-center gap-6 mt-4">
              <div>
                <p className="text-sm text-amber-900 font-semibold mb-1">Total Stay: {calc.duration} Night(s)</p>
                <p className="text-2xl font-black text-amber-700">Grand Total: Rs. {calc.grandTotal.toFixed(2)}</p>
                {hotelSettings.gstPercentage > 0 && <p className="text-xs text-amber-800 mt-1">Includes {hotelSettings.gstPercentage}% GST</p>}
              </div>
              
              <button
                onClick={handleGenerateBill}
                disabled={!guestName || !roomNumber || !roomType || !ratePerNight || isDownloading}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-lg"
              >
                {isDownloading ? "Processing..." : "Generate Bill & Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Invoice Template */}
        <div className="absolute top-[-9999px] left-[-9999px]">
          {tempBookingId && (
            <div ref={invoiceRef} id="invoice-template" className="relative shrink-0 flex flex-col" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', backgroundColor: '#ffffff' }}>
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

                <div className="text-right mt-4 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#6b7280' }}>Invoice No.</p>
                  <p className="text-sm font-bold" style={{ color: '#111827' }}>INV-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{tempBookingId.toString().padStart(4, '0')}</p>
                </div>
              </div>

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
                      <td className="py-3 px-4 border font-semibold" style={{ borderColor: '#d1d5db', color: '#111827' }}>{guestName}</td>
                      <td className="py-3 px-4 border font-semibold" style={{ borderColor: '#d1d5db', color: '#111827' }}>{guestPhone || 'N/A'}</td>
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
          )}
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(QuickBillPage), { ssr: false });
