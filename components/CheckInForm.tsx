"use client";

import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../utils/supabase';

interface PrimaryGuest {
  name: string;
  age: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  agreedPrice: string;
}

interface AdditionalGuest {
  name: string;
  age: string;
}

const rotateImage = (file: File | Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2); // Rotate 90 degrees
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, file.type || 'image/jpeg');
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
};

export default function CheckInForm() {
  const [primaryGuest, setPrimaryGuest] = useState<PrimaryGuest>({
    name: '',
    age: '',
    phone: '',
    checkInDate: '',
    checkOutDate: '',
    agreedPrice: '',
  });

  const [additionalGuests, setAdditionalGuests] = useState<AdditionalGuest[]>([]);
  const [idFiles, setIdFiles] = useState<{ [key: number]: File | null }>({});
  const [idStatus, setIdStatus] = useState<{ [key: number]: 'idle' | 'scanning' | 'valid' | 'invalid' }>({});
  
  const [idBackFiles, setIdBackFiles] = useState<{ [key: number]: File | null }>({});
  const [idBackStatus, setIdBackStatus] = useState<{ [key: number]: 'idle' | 'uploaded' }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPrimaryGuest((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddGuest = () => {
    setAdditionalGuests((prev) => [...prev, { name: '', age: '' }]);
  };

  const handleRemoveGuest = (index: number) => {
    setAdditionalGuests((prev) => prev.filter((_, i) => i !== index));
    setIdFiles((prev) => {
      const newFiles = { ...prev };
      for (let i = index + 1; i <= additionalGuests.length; i++) {
        newFiles[i] = newFiles[i + 1];
      }
      delete newFiles[additionalGuests.length];
      return newFiles;
    });
    setIdStatus((prev) => {
      const newStatus = { ...prev };
      for (let i = index + 1; i <= additionalGuests.length; i++) {
        newStatus[i] = newStatus[i + 1];
      }
      delete newStatus[additionalGuests.length];
      return newStatus;
    });
    setIdBackFiles((prev) => {
      const newFiles = { ...prev };
      for (let i = index + 1; i <= additionalGuests.length; i++) {
        newFiles[i] = newFiles[i + 1];
      }
      delete newFiles[additionalGuests.length];
      return newFiles;
    });
    setIdBackStatus((prev) => {
      const newStatus = { ...prev };
      for (let i = index + 1; i <= additionalGuests.length; i++) {
        newStatus[i] = newStatus[i + 1];
      }
      delete newStatus[additionalGuests.length];
      return newStatus;
    });
  };

  const handleAdditionalGuestChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdditionalGuests((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  };

  const handleFileChange = async (guestIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (!file) {
      setIdFiles((prev) => ({ ...prev, [guestIndex]: null }));
      setIdStatus((prev) => ({ ...prev, [guestIndex]: 'idle' }));
      return;
    }

    setIdFiles((prev) => ({ ...prev, [guestIndex]: file }));
    setIdStatus((prev) => ({ ...prev, [guestIndex]: 'scanning' }));

    try {
      const checkValid = (t: string) => {
        const aadhaarRegex = /\d{4}\s?\d{4}\s?\d{4}/;
        const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
        const hasKeywords = ['GOVERNMENT OF INDIA', 'MALE', 'FEMALE', 'INCOME TAX', 'DOB', 'ELECTION', 'FATHER'].some(keyword => 
          t.includes(keyword)
        );
        return aadhaarRegex.test(t) || panRegex.test(t) || hasKeywords;
      };

      // 1. Scan original image
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      let isValid = checkValid(text.toUpperCase());

      // 2. If it fails, the ID might be rotated 90 degrees (landscape card shot in portrait)
      if (!isValid) {
        try {
          const rotatedBlob = await rotateImage(file);
          const { data: { text: textRotated } } = await Tesseract.recognize(rotatedBlob, 'eng');
          isValid = checkValid(textRotated.toUpperCase());
        } catch (rotErr) {
          console.error("Rotation OCR failed:", rotErr);
        }
      }

      if (isValid) {
        setIdStatus((prev) => ({ ...prev, [guestIndex]: 'valid' }));
      } else {
        setIdStatus((prev) => ({ ...prev, [guestIndex]: 'invalid' }));
        setIdFiles((prev) => ({ ...prev, [guestIndex]: null }));
        e.target.value = '';
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setIdStatus((prev) => ({ ...prev, [guestIndex]: 'invalid' }));
      setIdFiles((prev) => ({ ...prev, [guestIndex]: null }));
      e.target.value = '';
    }
  };

  const handleBackFileChange = (guestIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setIdBackFiles((prev) => ({ ...prev, [guestIndex]: null }));
      setIdBackStatus((prev) => ({ ...prev, [guestIndex]: 'idle' }));
      return;
    }
    setIdBackFiles((prev) => ({ ...prev, [guestIndex]: file }));
    setIdBackStatus((prev) => ({ ...prev, [guestIndex]: 'uploaded' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allIdsValid) return;
    
    setIsSubmitting(true);

    try {
      const uploadedUrls: { [key: number]: string } = {};
      const uploadedBackUrls: { [key: number]: string } = {};

      const totalGuests = 1 + additionalGuests.length;
      
      // 1. Upload files to id_proofs bucket
      for (let i = 0; i < totalGuests; i++) {
        const file = idFiles[i];
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { data, error } = await supabase.storage
            .from('id_proofs')
            .upload(fileName, file);
            
          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('id_proofs')
            .getPublicUrl(fileName);

          uploadedUrls[i] = publicUrl;
        }

        const backFile = idBackFiles[i];
        if (backFile) {
          const fileExt = backFile.name.split('.').pop();
          const fileName = `back_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error } = await supabase.storage.from('id_proofs').upload(fileName, backFile);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('id_proofs').getPublicUrl(fileName);
          uploadedBackUrls[i] = publicUrl;
        }
      }

      // 2. Insert into Bookings
      const { data: bookingData, error: bookingError } = await supabase
        .from('Bookings')
        .insert({
          check_in_date: primaryGuest.checkInDate,
          check_out_date: primaryGuest.checkOutDate,
          agreed_price: primaryGuest.agreedPrice ? parseFloat(primaryGuest.agreedPrice) : null
        })
        .select()
        .single();
        
      if (bookingError) throw bookingError;
      
      const bookingId = bookingData.id;

      // 3. Prepare and Insert Guests
      const guestsToInsert: any[] = [];
      
      // Primary Guest
      guestsToInsert.push({
        booking_id: bookingId,
        name: primaryGuest.name,
        age: parseInt(primaryGuest.age),
        phone: primaryGuest.phone || null,
        id_image_url: uploadedUrls[0] || null,
        id_image_back_url: uploadedBackUrls[0] || null
      });

      // Additional Guests
      additionalGuests.forEach((guest, i) => {
        guestsToInsert.push({
          booking_id: bookingId,
          name: guest.name,
          age: parseInt(guest.age),
          phone: null,
          id_image_url: uploadedUrls[i + 1] || null,
          id_image_back_url: uploadedBackUrls[i + 1] || null
        });
      });

      const { error: guestsError } = await supabase
        .from('Guests')
        .insert(guestsToInsert);

      if (guestsError && guestsError.message?.includes('id_image_back_url')) {
        alert("WARNING: The 'id_image_back_url' column is missing in your Supabase Guests table! The back images were not saved. Please add it.");
        const fallbackGuests = guestsToInsert.map(g => {
          const { id_image_back_url, ...rest } = g;
          return rest;
        });
        const { error: fallbackError } = await supabase.from('Guests').insert(fallbackGuests);
        if (fallbackError) throw fallbackError;
      } else if (guestsError) {
        throw guestsError;
      }

      // 4. On successful save
      setIsSubmitted(true);
      
    } catch (err) {
      console.error("Submission Error:", err);
      alert("Failed to complete check-in. Please check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setPrimaryGuest({ name: '', age: '', phone: '', checkInDate: '', checkOutDate: '', agreedPrice: '' });
    setAdditionalGuests([]);
    setIdFiles({});
    setIdStatus({});
    setIdBackFiles({});
    setIdBackStatus({});
  };

  const totalGuests = 1 + additionalGuests.length;
  const allIdsValid = Array.from({ length: totalGuests }).every((_, i) => idStatus[i] === 'valid');

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
        <div className="w-full max-w-md mx-auto bg-white p-8 sm:p-10 rounded-[2rem] shadow-xl border border-slate-100 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Check-in Complete!</h2>
          <p className="text-slate-500 mb-8 text-lg leading-relaxed">
            Welcome to Hotel Satyam Swagat. Your details have been verified. Please collect your room keys from the reception.
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
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-xl mx-auto space-y-8">
        
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
          <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Primary Guest</h2>
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
              <div className="mt-4">
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
            </div>
          </div>

          {/* Additional Guests */}
          {additionalGuests.map((guest, index) => (
            <div key={index} className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 2}
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Additional Guest</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveGuest(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors text-sm font-medium"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={guest.name}
                    onChange={(e) => handleAdditionalGuestChange(index, e)}
                    required
                    placeholder="Jane Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={guest.age}
                    onChange={(e) => handleAdditionalGuestChange(index, e)}
                    required
                    min="0"
                    placeholder="25"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors outline-none text-slate-700 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Guest Button */}
          <button
            type="button"
            onClick={handleAddGuest}
            className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 font-semibold rounded-3xl hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-[0.98]"
          >
            + Add Additional Guest
          </button>

          {/* ID Uploads Section */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-md">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">Identity Verification</h2>
            <p className="text-sm text-slate-500 mb-5">
              Please upload a valid government-issued ID for each guest. OCR verification is required.
            </p>

            <div className="space-y-4">
              {Array.from({ length: totalGuests }).map((_, index) => {
                const guestName = index === 0 
                  ? (primaryGuest.name || "Primary Guest") 
                  : (additionalGuests[index - 1]?.name || `Guest ${index + 1}`);

                const status = idStatus[index] || 'idle';
                const backStatus = idBackStatus[index] || 'idle';

                let buttonText = 'Front Side (Required)';
                let buttonClasses = 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm';
                if (status === 'scanning') {
                  buttonText = 'Verifying...';
                  buttonClasses = 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm animate-pulse';
                } else if (status === 'valid') {
                  buttonText = '✓ Front Verified';
                  buttonClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm';
                } else if (status === 'invalid') {
                  buttonText = 'Try Again';
                  buttonClasses = 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm';
                }

                let backButtonText = 'Back Side (Optional)';
                let backButtonClasses = 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm';
                if (backStatus === 'uploaded') {
                  backButtonText = '✓ Back Uploaded';
                  backButtonClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm';
                }

                return (
                  <div key={index} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-3 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="w-full sm:w-1/3">
                        <p className="font-medium text-slate-700 line-clamp-1">{guestName}'s ID</p>
                        <p className="text-xs text-slate-500 mt-0.5">Formats: JPG, PNG</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-2/3 shrink-0">
                        <div className="relative w-full">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(index, e)}
                            disabled={status === 'scanning'}
                            className={`absolute inset-0 w-full h-full opacity-0 z-10 ${status !== 'scanning' ? 'cursor-pointer' : ''}`}
                            title="Upload Front Side"
                          />
                          <div className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${buttonClasses}`}>
                            {buttonText}
                          </div>
                        </div>

                        <div className="relative w-full">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleBackFileChange(index, e)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            title="Upload Back Side"
                          />
                          <div className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${backButtonClasses}`}>
                            {backButtonText}
                          </div>
                        </div>
                      </div>
                    </div>
                    {status === 'invalid' && (
                      <p className="text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                        Invalid ID detected: Please upload a clear photo of the Front Side of a valid Government ID
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!allIdsValid || isSubmitting}
            className={`w-full py-4 text-white text-lg font-semibold rounded-3xl transition-all shadow-lg mt-8 ${
              (allIdsValid && !isSubmitting)
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]' 
                : 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
            }`}
          >
            {isSubmitting ? 'Saving Data...' : (allIdsValid ? 'Complete Check-in' : 'Please Verify All IDs')}
          </button>
          
        </form>
      </div>
    </div>
  );
}
