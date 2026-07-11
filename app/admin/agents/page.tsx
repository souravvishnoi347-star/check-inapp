"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import dynamic from "next/dynamic";
import AdminSidebar from "@/components/AdminSidebar";

// ─── Types ───────────────────────────────────────────────────────────

type Agent = {
  id: number;
  created_at: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_limit: number;
  notes: string | null;
  is_active: boolean;
};

type AgentTransaction = {
  id: number;
  created_at: string;
  agent_id: number;
  transaction_type: "credit" | "payment";
  amount: number;
  transaction_date: string;
  reference_note: string | null;
  payment_mode: string | null;
  booking_id: number | null;
};

type AgentWithStats = Agent & {
  totalCredit: number;
  totalPayments: number;
  outstandingBalance: number;
  totalGuestsSent: number;
};

type TransactionWithAgent = AgentTransaction & {
  agentName: string;
  runningBalance?: number;
};

// ─── Component ───────────────────────────────────────────────────────

function AgentManagementPage() {
  const router = useRouter();

  // Auth & Settings
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hotelSettings, setHotelSettings] = useState({ hotelName: "" });

  // Active tab
  const [activeTab, setActiveTab] = useState<"agents" | "ledger" | "reports">("agents");

  // Agents data
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Agent modal
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: "",
    phone: "",
    email: "",
    credit_limit: "",
    notes: "",
  });
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  // Transaction modal
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({
    agent_id: "",
    transaction_type: "credit" as "credit" | "payment",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    reference_note: "",
    payment_mode: "Cash",
  });
  const [isSavingTxn, setIsSavingTxn] = useState(false);

  // Agents List filters
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Ledger filters
  const [ledgerAgentFilter, setLedgerAgentFilter] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"all" | "credit" | "payment">("all");
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");

  // Reports sort
  const [reportSort, setReportSort] = useState<"balance" | "alpha">("balance");

  // Ledger pre-filter (when clicking "View Ledger" from agents tab)
  const [preFilterAgentId, setPreFilterAgentId] = useState<string>("");

  // ─── Session & Settings ──────────────────────────────────────────

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setIsCheckingSession(false);
      }
    };
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          router.push("/admin/login");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  // ─── Data Fetching ───────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch agents
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select("*")
        .order("name", { ascending: true });

      if (agentsError) throw agentsError;

      // Fetch transactions
      const { data: txnData, error: txnError } = await supabase
        .from("agent_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (txnError) throw txnError;

      const rawAgents: Agent[] = agentsData || [];
      const rawTxns: AgentTransaction[] = txnData || [];

      // Build agent map with stats
      const agentMap = new Map<number, Agent>();
      rawAgents.forEach((a) => agentMap.set(a.id, a));

      // Calculate stats per agent
      const creditByAgent = new Map<number, number>();
      const paymentByAgent = new Map<number, number>();
      const guestCountByAgent = new Map<number, number>();

      rawTxns.forEach((t) => {
        if (t.transaction_type === "credit") {
          creditByAgent.set(t.agent_id, (creditByAgent.get(t.agent_id) || 0) + Number(t.amount));
          guestCountByAgent.set(t.agent_id, (guestCountByAgent.get(t.agent_id) || 0) + 1);
        } else {
          paymentByAgent.set(t.agent_id, (paymentByAgent.get(t.agent_id) || 0) + Number(t.amount));
        }
      });

      const enrichedAgents: AgentWithStats[] = rawAgents.map((a) => {
        const totalCredit = creditByAgent.get(a.id) || 0;
        const totalPayments = paymentByAgent.get(a.id) || 0;
        return {
          ...a,
          totalCredit,
          totalPayments,
          outstandingBalance: totalCredit - totalPayments,
          totalGuestsSent: guestCountByAgent.get(a.id) || 0,
        };
      });

      setAgents(enrichedAgents);

      // Build transactions with agent names & running balance
      const txnsWithAgent: TransactionWithAgent[] = rawTxns.map((t) => ({
        ...t,
        agentName: agentMap.get(t.agent_id)?.name || "Unknown",
      }));

      // Calculate running balance per agent (sorted oldest first, then re-reverse)
      const sortedAsc = [...txnsWithAgent].sort(
        (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime() || a.id - b.id
      );
      const balanceMap = new Map<number, number>();
      sortedAsc.forEach((t) => {
        const prev = balanceMap.get(t.agent_id) || 0;
        const newBal = t.transaction_type === "credit" ? prev + Number(t.amount) : prev - Number(t.amount);
        balanceMap.set(t.agent_id, newBal);
        t.runningBalance = newBal;
      });

      // Reverse back to desc for display
      sortedAsc.reverse();
      setAllTransactions(sortedAsc);
    } catch (err) {
      console.error("Error fetching agent data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCheckingSession) {
      fetchData();
    }
  }, [isCheckingSession, fetchData]);

  // ─── Agent CRUD ──────────────────────────────────────────────────

  const openAddAgentModal = () => {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      phone: "",
      email: "",
      credit_limit: "",
      notes: "",
    });
    setIsAgentModalOpen(true);
  };

  const openEditAgentModal = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      phone: agent.phone || "",
      email: agent.email || "",
      credit_limit: String(agent.credit_limit),
      notes: agent.notes || "",
    });
    setIsAgentModalOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!agentForm.name.trim()) return;
    setIsSavingAgent(true);
    try {
      const payload = {
        name: agentForm.name.trim(),
        phone: agentForm.phone.trim() || null,
        email: agentForm.email.trim() || null,
        credit_limit: Number(agentForm.credit_limit) || 0,
        notes: agentForm.notes.trim() || null,
      };

      if (editingAgent) {
        const { error } = await supabase
          .from("agents")
          .update(payload)
          .eq("id", editingAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert([payload]);
        if (error) throw error;
      }

      setIsAgentModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving agent:", err);
      alert("Failed to save agent. Please try again.");
    } finally {
      setIsSavingAgent(false);
    }
  };

  const toggleAgentStatus = async (agent: Agent) => {
    try {
      const { error } = await supabase
        .from("agents")
        .update({ is_active: !agent.is_active })
        .eq("id", agent.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error("Error toggling agent status:", err);
    }
  };

  const handleDeleteAgent = async (agent: AgentWithStats) => {
    if (!window.confirm(`Are you sure you want to delete agent "${agent.name}"? This will also delete all their transactions.`)) return;
    try {
      // Delete transactions first (FK constraint)
      const { error: txnError } = await supabase
        .from("agent_transactions")
        .delete()
        .eq("agent_id", agent.id);
      if (txnError) throw txnError;

      const { error: agentError } = await supabase
        .from("agents")
        .delete()
        .eq("id", agent.id);
      if (agentError) throw agentError;

      alert(`Agent "${agent.name}" deleted successfully.`);
      fetchData();
    } catch (err: any) {
      console.error("Error deleting agent:", err);
      alert("Failed to delete agent: " + (err?.message || "Unknown error"));
    }
  };

  // ─── Transaction CRUD ────────────────────────────────────────────

  const openTxnModal = () => {
    setTxnForm({
      agent_id: "",
      transaction_type: "credit",
      amount: "",
      transaction_date: new Date().toISOString().split("T")[0],
      reference_note: "",
      payment_mode: "Cash",
    });
    setIsTxnModalOpen(true);
  };

  const handleSaveTxn = async () => {
    if (!txnForm.agent_id || !txnForm.amount) return;
    setIsSavingTxn(true);
    try {
      const payload = {
        agent_id: Number(txnForm.agent_id),
        transaction_type: txnForm.transaction_type,
        amount: Number(txnForm.amount),
        transaction_date: txnForm.transaction_date,
        reference_note: txnForm.reference_note.trim() || null,
        payment_mode: txnForm.transaction_type === "payment" ? txnForm.payment_mode : null,
      };

      const { error } = await supabase.from("agent_transactions").insert([payload]);
      if (error) throw error;

      setIsTxnModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("Failed to save transaction. Please try again.");
    } finally {
      setIsSavingTxn(false);
    }
  };

  // ─── View Ledger for Agent ───────────────────────────────────────

  const handleViewLedger = (agentId: number) => {
    setPreFilterAgentId(String(agentId));
    setLedgerAgentFilter(String(agentId));
    setLedgerTypeFilter("all");
    setLedgerStartDate("");
    setLedgerEndDate("");
    setActiveTab("ledger");
  };

  // ─── Computed Data ───────────────────────────────────────────────

  // Stats for Tab 1
  const totalActiveAgents = agents.filter((a) => a.is_active).length;
  const totalOutstandingCredit = agents.reduce((sum, a) => sum + a.outstandingBalance, 0);
  const totalCashPaid = agents.reduce((sum, a) => sum + a.totalPayments, 0);

  // Filtered agents
  const filteredAgents = agents.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesStatus =
      agentStatusFilter === "all" ||
      (agentStatusFilter === "active" && a.is_active) ||
      (agentStatusFilter === "inactive" && !a.is_active);
    return matchesSearch && matchesStatus;
  });

  // Filtered transactions
  const filteredTransactions = allTransactions.filter((t) => {
    if (ledgerAgentFilter && String(t.agent_id) !== ledgerAgentFilter) return false;
    if (ledgerTypeFilter !== "all" && t.transaction_type !== ledgerTypeFilter) return false;
    if (ledgerStartDate && t.transaction_date < ledgerStartDate) return false;
    if (ledgerEndDate && t.transaction_date > ledgerEndDate) return false;
    return true;
  });

  // Reports data
  const reportAgents = [...agents.filter((a) => a.is_active)].sort((a, b) => {
    if (reportSort === "balance") return b.outstandingBalance - a.outstandingBalance;
    return a.name.localeCompare(b.name);
  });

  // Active agents for dropdown
  const activeAgentsList = agents.filter((a) => a.is_active);

  // Helper: format currency
  const formatCurrency = (val: number) => `₹${val.toLocaleString("en-IN")}`;

  // Helper: balance color class
  const getBalanceColor = (outstanding: number, totalCredit: number) => {
    if (outstanding <= 0) return "text-green-600";
    if (totalCredit > 0 && outstanding / totalCredit > 0.5) return "text-red-600";
    return "text-amber-600";
  };

  const getBalanceBg = (outstanding: number, totalCredit: number) => {
    if (outstanding <= 0) return "bg-green-50 border-green-200";
    if (totalCredit > 0 && outstanding / totalCredit > 0.5) return "bg-red-50 border-red-200";
    return "bg-amber-50 border-amber-200";
  };

  // Helper: last transaction date for an agent
  const getLastTxnDate = (agentId: number) => {
    const txns = allTransactions.filter((t) => t.agent_id === agentId);
    if (txns.length === 0) return "—";
    return txns[0].transaction_date;
  };

  // ─── Loading / Auth Screen ───────────────────────────────────────

  if (isCheckingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Checking session...</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row relative">
      <AdminSidebar activePath="/admin/agents" hotelName={hotelSettings.hotelName} />

      <main className="flex-1 flex flex-col overflow-hidden z-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Agent Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage agents, commissions & payments</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-4 border-b border-gray-200 -mb-4">
            {[
              { key: "agents" as const, label: "Agents List", icon: "👥" },
              { key: "ledger" as const, label: "Transactions", icon: "📒" },
              { key: "reports" as const, label: "Reports", icon: "📊" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== "ledger") {
                    setPreFilterAgentId("");
                    setLedgerAgentFilter("");
                  }
                }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading agents data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ═══════ TAB 1: AGENTS LIST ═══════ */}
              {activeTab === "agents" && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Total Active Agents */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-lg">👥</div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Agents</p>
                          <p className="text-2xl font-black text-gray-900">{totalActiveAgents}</p>
                        </div>
                      </div>
                    </div>

                    {/* Total Outstanding */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-lg">⚠️</div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Credit</p>
                          <p className="text-2xl font-black text-red-600">{formatCurrency(totalOutstandingCredit)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Total Cash Paid */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg">✅</div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cash Paid</p>
                          <p className="text-2xl font-black text-green-600">{formatCurrency(totalCashPaid)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Toolbar: Search, Filter, Add */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
                      <div className="relative flex-1 sm:max-w-xs">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search agents..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-gray-900"
                        />
                      </div>
                      <select
                        value={agentStatusFilter}
                        onChange={(e) => setAgentStatusFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <button
                      onClick={openAddAgentModal}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Agent
                    </button>
                  </div>

                  {/* Agents Table */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Agent</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Phone</th>

                            <th className="text-center px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden lg:table-cell">Guests</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Credit</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden sm:table-cell">Paid</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Balance</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Status</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAgents.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center py-12 text-gray-400">
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-4xl">👤</span>
                                  <p className="font-medium">No agents found</p>
                                  <p className="text-xs">Add your first agent to get started</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredAgents.map((agent) => (
                              <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-gray-900">{agent.name}</div>
                                  {agent.email && <div className="text-xs text-gray-400 mt-0.5">{agent.email}</div>}
                                </td>
                                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{agent.phone || "—"}</td>

                                <td className="px-4 py-3 text-center hidden lg:table-cell">
                                  <span className="font-semibold text-gray-700">{agent.totalGuestsSent}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(agent.totalCredit)}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-600 hidden sm:table-cell">{formatCurrency(agent.totalPayments)}</td>
                                <td className={`px-4 py-3 text-right font-black ${getBalanceColor(agent.outstandingBalance, agent.totalCredit)}`}>
                                  {formatCurrency(agent.outstandingBalance)}
                                </td>
                                <td className="px-4 py-3 text-center hidden md:table-cell">
                                  {agent.is_active ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => openEditAgentModal(agent)}
                                      title="Edit"
                                      className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => toggleAgentStatus(agent)}
                                      title={agent.is_active ? "Deactivate" : "Activate"}
                                      className={`p-1.5 rounded-md transition-colors ${
                                        agent.is_active
                                          ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                          : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                                      }`}
                                    >
                                      {agent.is_active ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleViewLedger(agent.id)}
                                      title="View Ledger"
                                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAgent(agent)}
                                      title="Delete Agent"
                                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              )}

              {/* ═══════ TAB 2: TRANSACTIONS LEDGER ═══════ */}
              {activeTab === "ledger" && (
                <div className="space-y-6">
                  {/* Toolbar */}
                  <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-3 flex-wrap flex-1 w-full">
                      <select
                        value={ledgerAgentFilter}
                        onChange={(e) => setLedgerAgentFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none min-w-[160px]"
                      >
                        <option value="">All Agents</option>
                        {agents.map((a) => (
                          <option key={a.id} value={String(a.id)}>
                            {a.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={ledgerTypeFilter}
                        onChange={(e) => setLedgerTypeFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="all">All Types</option>
                        <option value="credit">Credit Only</option>
                        <option value="payment">Payments Only</option>
                      </select>

                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={ledgerStartDate}
                          onChange={(e) => setLedgerStartDate(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <input
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {(ledgerAgentFilter || ledgerTypeFilter !== "all" || ledgerStartDate || ledgerEndDate) && (
                        <button
                          onClick={() => {
                            setLedgerAgentFilter("");
                            setLedgerTypeFilter("all");
                            setLedgerStartDate("");
                            setLedgerEndDate("");
                            setPreFilterAgentId("");
                          }}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>

                    <button
                      onClick={openTxnModal}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Record Transaction
                    </button>
                  </div>

                  {/* Transactions Table */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Date</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Agent</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Type</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Amount</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Reference</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden lg:table-cell">Mode</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-xs tracking-wider hidden sm:table-cell">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-gray-400">
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-4xl">📒</span>
                                  <p className="font-medium">No transactions found</p>
                                  <p className="text-xs">Record a transaction to get started</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((txn) => (
                              <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                  {new Date(txn.transaction_date).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">{txn.agentName}</td>
                                <td className="px-4 py-3">
                                  {txn.transaction_type === "credit" ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      Credit
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                      Payment
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-right font-bold ${txn.transaction_type === "credit" ? "text-blue-600" : "text-green-600"}`}>
                                  {txn.transaction_type === "credit" ? "+" : "−"}{formatCurrency(Number(txn.amount))}
                                </td>
                                <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[200px] truncate" title={txn.reference_note || ""}>
                                  {txn.reference_note || "—"}
                                </td>
                                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                                  {txn.transaction_type === "payment" && txn.payment_mode ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                                      {txn.payment_mode}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700 hidden sm:table-cell">
                                  {txn.runningBalance !== undefined ? formatCurrency(txn.runningBalance) : "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════ TAB 3: REPORTS ═══════ */}
              {activeTab === "reports" && (
                <div className="space-y-6">
                  {/* Sort control */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Agent Summary</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Sort by:</span>
                      <select
                        value={reportSort}
                        onChange={(e) => setReportSort(e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="balance">Outstanding (High → Low)</option>
                        <option value="alpha">Alphabetical</option>
                      </select>
                    </div>
                  </div>

                  {reportAgents.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <span className="text-4xl block mb-2">📊</span>
                      <p className="font-medium">No active agents to show</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reportAgents.map((agent) => (
                        <div
                          key={agent.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-bold text-gray-900 text-base">{agent.name}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Last txn: {getLastTxnDate(agent.id)}
                              </p>
                            </div>
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Total Credit</span>
                              <span className="font-bold text-blue-600">{formatCurrency(agent.totalCredit)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Total Payments</span>
                              <span className="font-bold text-green-600">{formatCurrency(agent.totalPayments)}</span>
                            </div>
                            <div className="h-px bg-gray-100" />
                            <div className={`flex items-center justify-between p-2.5 rounded-lg border ${getBalanceBg(agent.outstandingBalance, agent.totalCredit)}`}>
                              <span className="text-xs font-semibold text-gray-600">Outstanding</span>
                              <span className={`text-lg font-black ${getBalanceColor(agent.outstandingBalance, agent.totalCredit)}`}>
                                {formatCurrency(agent.outstandingBalance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ═══════ AGENT MODAL ═══════ */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAgentModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAgent ? "Edit Agent" : "Add New Agent"}
              </h3>
              <button
                onClick={() => setIsAgentModalOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="e.g. Rajesh Travels"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={agentForm.phone}
                    onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={agentForm.email}
                    onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                    placeholder="agent@example.com"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  value={agentForm.credit_limit}
                  onChange={(e) => setAgentForm({ ...agentForm, credit_limit: e.target.value })}
                  placeholder="e.g. 50000"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={agentForm.notes}
                  onChange={(e) => setAgentForm({ ...agentForm, notes: e.target.value })}
                  placeholder="Any additional notes about this agent..."
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-xl">
              <button
                onClick={() => setIsAgentModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAgent}
                disabled={isSavingAgent || !agentForm.name.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm disabled:opacity-50 text-sm"
              >
                {isSavingAgent ? "Saving..." : editingAgent ? "Save Changes" : "Add Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TRANSACTION MODAL ═══════ */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsTxnModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Record Transaction</h3>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-4">
              {/* Select Agent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Agent <span className="text-red-500">*</span>
                </label>
                <select
                  value={txnForm.agent_id}
                  onChange={(e) => setTxnForm({ ...txnForm, agent_id: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                >
                  <option value="">— Choose Agent —</option>
                  {activeAgentsList.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setTxnForm({ ...txnForm, transaction_type: "credit" })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      txnForm.transaction_type === "credit"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    📋 Guest Referral (Credit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxnForm({ ...txnForm, transaction_type: "payment" })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      txnForm.transaction_type === "payment"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    💰 Cash Payment
                  </button>
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={txnForm.amount}
                    onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={txnForm.transaction_date}
                    onChange={(e) => setTxnForm({ ...txnForm, transaction_date: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Reference/Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Notes</label>
                <input
                  type="text"
                  value={txnForm.reference_note}
                  onChange={(e) => setTxnForm({ ...txnForm, reference_note: e.target.value })}
                  placeholder={txnForm.transaction_type === "credit" ? "e.g. Guest name - Mr. Sharma" : "e.g. Payment ref #123"}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                />
              </div>

              {/* Payment Mode (only for payments) */}
              {txnForm.transaction_type === "payment" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                  <select
                    value={txnForm.payment_mode}
                    onChange={(e) => setTxnForm({ ...txnForm, payment_mode: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-xl">
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTxn}
                disabled={isSavingTxn || !txnForm.agent_id || !txnForm.amount}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm disabled:opacity-50 text-sm"
              >
                {isSavingTxn ? "Saving..." : "Save Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(AgentManagementPage), { ssr: false });
