"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

// Expense interface
interface Expense {
  id: number;
  created_at: string;
  expense_name: string;
  amount: number;
  expense_date: string;
  category: string;
  payment_mode: string;
  notes: string | null;
}

const CATEGORIES = [
  "Milk & Dairy", 
  "Grocery", 
  "Maintenance & Repairs", 
  "Cleaning Supplies", 
  "Electricity/Water Bills", 
  "Staff Salary", 
  "Laundry", 
  "Kitchen/Food", 
  "Miscellaneous"
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer"];

function ExpensesPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "" });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Miscellaneous");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState("Today");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("hotelSettings");
      if (savedSettings) {
        try { setHotelSettings(JSON.parse(savedSettings)); } catch (e) {}
      }
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
        fetchExpenses();
      }
    };
    checkSession();
  }, [router]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === '42P01') { // table does not exist
          alert("The 'expenses' table does not exist in your database yet. Please create it first.");
        } else {
          throw error;
        }
      }

      setExpenses(data || []);
    } catch (err: any) {
      console.error(err);
      // Silently ignore or alert on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setExpenseName("");
    setAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setCategory("Miscellaneous");
    setPaymentMode("Cash");
    setNotes("");
    setEditingId(null);
  };

  const handleOpenForm = (expense?: Expense) => {
    if (expense) {
      setExpenseName(expense.expense_name);
      setAmount(expense.amount.toString());
      setExpenseDate(expense.expense_date);
      setCategory(expense.category);
      setPaymentMode(expense.payment_mode);
      setNotes(expense.notes || "");
      setEditingId(expense.id);
    } else {
      handleResetForm();
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName || !amount || !expenseDate || !category || !paymentMode) return;

    setIsSubmitting(true);
    try {
      const payload = {
        expense_name: expenseName,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        category,
        payment_mode: paymentMode,
        notes: notes || null
      };

      if (editingId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
        if (error) throw error;
        alert("Expense updated successfully");
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
        alert("Expense added successfully");
      }

      setIsFormOpen(false);
      handleResetForm();
      fetchExpenses();
    } catch (err: any) {
      console.error(err);
      alert("Failed to save expense: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      try {
        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (error) throw error;
        alert("Expense deleted");
        fetchExpenses();
      } catch (err: any) {
        alert("Failed to delete expense: " + err.message);
      }
    }
  };

  // Filter Data
  const filteredData = expenses.filter((expense) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = expense.expense_name.toLowerCase().includes(query) || (expense.notes?.toLowerCase() || "").includes(query);
    const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;

    let matchesDate = true;
    if (dateFilter !== "All Time") {
      const today = new Date();
      today.setHours(0,0,0,0);
      const expDate = new Date(expense.expense_date);
      expDate.setHours(0,0,0,0);

      if (dateFilter === "Today") {
        matchesDate = expDate.getTime() === today.getTime();
      } else if (dateFilter === "This Week") {
        const firstDayOfWeek = new Date(today.getTime());
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        matchesDate = expDate >= firstDayOfWeek;
      } else if (dateFilter === "This Month") {
        matchesDate = expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
      }
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Calculate Stats
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todayTotal = expenses
    .filter(e => {
      const d = new Date(e.expense_date);
      d.setHours(0,0,0,0);
      return d.getTime() === today.getTime();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const monthTotal = expenses
    .filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const allTimeTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const currentFilteredTotal = filteredData.reduce((sum, e) => sum + Number(e.amount), 0);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Milk & Dairy": return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "Grocery": return "bg-green-50 text-green-700 ring-green-600/20";
      case "Maintenance & Repairs": return "bg-orange-50 text-orange-700 ring-orange-600/20";
      case "Cleaning Supplies": return "bg-teal-50 text-teal-700 ring-teal-600/20";
      case "Electricity/Water Bills": return "bg-yellow-50 text-yellow-700 ring-yellow-600/20";
      case "Staff Salary": return "bg-purple-50 text-purple-700 ring-purple-600/20";
      case "Laundry": return "bg-pink-50 text-pink-700 ring-pink-600/20";
      case "Kitchen/Food": return "bg-red-50 text-red-700 ring-red-600/20";
      default: return "bg-gray-50 text-gray-700 ring-gray-600/20";
    }
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case "Cash": return "bg-green-100 text-green-800";
      case "UPI": return "bg-purple-100 text-purple-800";
      case "Bank Transfer": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
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
      <AdminSidebar activePath="/admin/expenses" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Daily Expenses Tracker</h2>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
                <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Today&apos;s Expenses</p>
                <h2 className="text-3xl font-black">Rs. {todayTotal.toLocaleString('en-IN')}</h2>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-200">
                <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">This Month&apos;s Total</p>
                <h2 className="text-3xl font-black">Rs. {monthTotal.toLocaleString('en-IN')}</h2>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-lg shadow-amber-200">
                <p className="text-amber-100 text-sm font-medium uppercase tracking-wider mb-1">Total All Time</p>
                <h2 className="text-3xl font-black">Rs. {allTimeTotal.toLocaleString('en-IN')}</h2>
              </div>
            </div>

            {/* Top Bar with Add Button */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Expense Records</h3>
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                {isFormOpen ? "Cancel" : "+ Add Expense"}
              </button>
            </div>

            {/* Form Modal/Collapsible */}
            {isFormOpen && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 animate-in slide-in-from-top-4 fade-in duration-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">{editingId ? "Edit Expense" : "Add New Expense"}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Expense Name *</label>
                      <input type="text" required value={expenseName} onChange={(e) => setExpenseName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Milk for tea" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Amount (Rs.) *</label>
                      <input type="number" required min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Date *</label>
                      <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Category *</label>
                      <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Payment Mode *</label>
                      <select required value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                        {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Any additional details..."></textarea>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => { setIsFormOpen(false); handleResetForm(); }} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50">
                      {isSubmitting ? "Saving..." : editingId ? "Update Expense" : "Save Expense"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                {["Today", "This Week", "This Month", "All Time"].map((filter) => (
                  <button key={filter} onClick={() => setDateFilter(filter)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${dateFilter === filter ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {filter}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input type="text" placeholder="Search expenses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Expense Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Mode</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Notes</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading expenses...</td></tr>
                    ) : filteredData.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">No expenses found for the selected filters.</td></tr>
                    ) : (
                      filteredData.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                            {new Date(expense.expense_date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                            {expense.expense_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getCategoryColor(expense.category)}`}>
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-black text-right">
                            Rs. {expense.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${getPaymentModeColor(expense.payment_mode)}`}>
                              {expense.payment_mode}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate hidden md:table-cell" title={expense.notes || ""}>
                            {expense.notes || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => handleOpenForm(expense)} className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded-lg transition-colors mr-2" title="Edit">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(expense.id)} className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredData.length > 0 && (
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-bold text-slate-700 text-right uppercase tracking-wider">
                          Total for current view:
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-indigo-700 text-right">
                          Rs. {currentFilteredTotal.toFixed(2)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ExpensesPage), { ssr: false });
