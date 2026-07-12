"use client";

import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import imageCompression from 'browser-image-compression';

interface PrimaryGuest {
  name: string;
  age: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  agreedPrice: string;
  paymentType: 'cash' | 'credit';
  maleGuests: string;
  femaleGuests: string;
}

export default function CheckInForm() {
  const [primaryGuest, setPrimaryGuest] = useState<PrimaryGuest>({
    name: '',
    age: '',
    phone: '',
    checkInDate: '',
    checkOutDate: '',
    agreedPrice: '',
    paymentType: 'cash',
    maleGuests: '1',
    femaleGuests: '0',
  });

  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPrimaryGuest((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Compress all selected files
    const compressedFiles = await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
          return await imageCompression(file, options);
        } catch (err) {
          console.error("Compression failed:", err);
          return file; // fallback to original
        }
      })
    );

    // Append to existing files
    setIdFiles((prev) => [...prev, ...(compressedFiles as File[])]);
  };

  const removeFile = (index: number) => {
    setIdFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const uploadedUrls: string[] = [];

      // Upload all ID files
      for (const file of idFiles) {
        const fileExt = file.name ? file.name.split('.').pop() || 'jpg' : 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error } = await supabase.storage.from('id_proofs').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('id_proofs').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // Calculate total guests
      const maleCount = parseInt(primaryGuest.maleGuests) || 0;
      const femaleCount = parseInt(primaryGuest.femaleGuests) || 0;

      // Insert into Bookings
      const { data: bookingData, error: bookingError } = await supabase
        .from('Bookings')
        .insert({
          check_in_date: primaryGuest.checkInDate,
          check_out_date: primaryGuest.checkOutDate,
          agreed_price: primaryGuest.agreedPrice ? parseFloat(primaryGuest.agreedPrice) : null,
          payment_type: primaryGuest.paymentType,
          male_guests: maleCount,
          female_guests: femaleCount,
          status: 'checked_in'
        })
        .select()
        .single();
        
      if (bookingError) throw bookingError;
      
      const bookingId = bookingData.id;

      // Insert primary guest only
      const guestData: any = {
        booking_id: bookingId,
        name: primaryGuest.name,
        age: parseInt(primaryGuest.age),
        phone: primaryGuest.phone || null,
        id_image_url: uploadedUrls.length > 0 ? uploadedUrls.join(',') : null,
        id_image_back_url: null
      };

      const { error: guestsError } = await supabase
        .from('Guests')
        .insert([guestData]);

      if (guestsError) throw guestsError;

      setIsSubmitted(true);
      
    } catch (err: any) {
      console.error("Submission Error:", err);
      alert("Failed to complete check-in: " + (err?.message || JSON.stringify(err) || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setPrimaryGuest({ name: '', age: '', phone: '', checkInDate: '', checkOutDate: '', agreedPrice: '', paymentType: 'cash', maleGuests: '1', femaleGuests: '0' });
    setIdFiles([]);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-purple-100 py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
        <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl border border-white/50 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Check-in Complete!</h2>
          <p className="text-slate-500 mb-8 text-lg leading-relaxed">
            Welcome! Your details have been saved successfully. Please collect your room keys from the reception.
          </p>
          <button
            onClick={handleReset}
            className="w-full py-4 text-white text-lg font-semibold rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            Check-in Another Guest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-purple-100 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Guest Check-in
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Please fill out your details to complete your registration.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Primary Guest Card */}
          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Guest Details</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={primaryGuest.name}
                  onChange={handlePrimaryChange}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={primaryGuest.age}
                    onChange={handlePrimaryChange}
                    required
                    min="18"
                    placeholder="30"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={primaryGuest.phone}
                    onChange={handlePrimaryChange}
                    required
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Check-in Date</label>
                  <input
                    type="date"
                    name="checkInDate"
                    value={primaryGuest.checkInDate}
                    onChange={handlePrimaryChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Check-out Date</label>
                  <input
                    type="date"
                    name="checkOutDate"
                    value={primaryGuest.checkOutDate}
                    onChange={handlePrimaryChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Agreed Price */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Agreed Price (Rs.) *</label>
                <input
                  type="number"
                  name="agreedPrice"
                  value={primaryGuest.agreedPrice}
                  onChange={handlePrimaryChange}
                  required
                  min="0"
                  placeholder="e.g. 1500"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white font-semibold"
                />
              </div>

              {/* Payment Type - Cash / Credit */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Payment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrimaryGuest(prev => ({ ...prev, paymentType: 'cash' }))}
                    className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-semibold text-sm transition-all border-2 ${
                      primaryGuest.paymentType === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm shadow-emerald-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryGuest(prev => ({ ...prev, paymentType: 'credit' }))}
                    className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-semibold text-sm transition-all border-2 ${
                      primaryGuest.paymentType === 'credit'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm shadow-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Credit
                  </button>
                </div>
              </div>

              {/* Guest Count - Male & Female */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Guest Count *</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                    <label className="block text-xs font-semibold text-blue-600 mb-1.5 uppercase tracking-wider">Male</label>
                    <input
                      type="number"
                      name="maleGuests"
                      value={primaryGuest.maleGuests}
                      onChange={handlePrimaryChange}
                      required
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors outline-none text-slate-700 bg-white font-bold text-center text-lg"
                    />
                  </div>
                  <div className="bg-pink-50/50 border border-pink-100 rounded-xl p-3">
                    <label className="block text-xs font-semibold text-pink-600 mb-1.5 uppercase tracking-wider">Female</label>
                    <input
                      type="number"
                      name="femaleGuests"
                      value={primaryGuest.femaleGuests}
                      onChange={handlePrimaryChange}
                      required
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-lg border border-pink-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-colors outline-none text-slate-700 bg-white font-bold text-center text-lg"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Total Guests: <span className="font-bold text-slate-600">{(parseInt(primaryGuest.maleGuests) || 0) + (parseInt(primaryGuest.femaleGuests) || 0)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ID Uploads Section */}
          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">Upload ID Documents</h2>
            <div className="mb-5 space-y-3">
              <p className="text-sm text-slate-500">
                Please upload clear photos of government-issued IDs. You can upload multiple IDs if needed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col p-4 bg-white/50 rounded-2xl border border-white/60 gap-4 transition-all shadow-sm">
                
                {/* Custom File Input UI */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                    title="Upload ID Photos"
                  />
                  <div className="w-full text-center px-4 py-4 rounded-xl text-sm font-medium transition-colors border-2 border-dashed flex flex-col items-center justify-center gap-2 bg-indigo-50/50 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span>Tap to Open Camera or Select Multiple Photos</span>
                  </div>
                </div>

                {/* Selected Files List */}
                {idFiles.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {idFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-indigo-100 text-indigo-600 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-sm text-slate-700 truncate font-medium">
                            {file.name || `ID Document ${idx + 1}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="ml-2 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Remove ID"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={idFiles.length === 0 || isSubmitting}
            className={`w-full py-4 text-white text-lg font-bold rounded-2xl transition-all shadow-lg mt-8 ${
              (idFiles.length > 0 && !isSubmitting)
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]' 
                : 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
            }`}
          >
            {isSubmitting 
              ? 'Uploading IDs & Saving...' 
              : idFiles.length > 0 
                ? 'Complete Check-in' 
                : 'Please Upload At Least 1 ID'
            }
          </button>
          
        </form>
      </div>
    </div>
  );
}
