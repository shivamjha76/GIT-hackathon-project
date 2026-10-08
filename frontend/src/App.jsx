import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  LayoutGrid,
  AlertTriangle,
  FolderGit2,
  Bell,
  RotateCw,
  Flame,
  Clock,
  Search,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  Ban,
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Info,
  User,
  LogIn,
  LogOut,
  Home
} from 'lucide-react';
import * as api from './api';
import { supabase } from './supabase';
import AuthModal from './components/AuthModal';
import LandingPage from './components/LandingPage';

// Helper for relative time string
function timeAgo(dateString) {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 5)} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

// Badge color maps
const SEVERITY_STYLES = {
  Critical: {
    badge: 'bg-red-500/15 text-red-400 border border-red-500/30',
    dot: 'bg-red-500',
    icon: Flame
  },
  High: {
    badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    dot: 'bg-orange-500',
    icon: AlertTriangle
  },
  Medium: {
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-500',
    icon: AlertTriangle
  },
  Low: {
    badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    dot: 'bg-slate-500',
    icon: Info
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'dashboard'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'findings' | 'repositories'
  const [stats, setStats] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanSecondsAgo, setLastScanSecondsAgo] = useState(20);

  // Findings Filters State
  const [findingStatusFilter, setFindingStatusFilter] = useState('open'); // 'open' | 'resolved' | 'false_positive'
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [repoFilter, setRepoFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);

  // New Repo Form State
  const [newRepoInput, setNewRepoInput] = useState('');
  const [repoSubmitting, setRepoSubmitting] = useState(false);
  const [repoError, setRepoError] = useState('');

  // Synthetic Test commit modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [syntheticKeyType, setSyntheticKeyType] = useState('AWS key');

  // Supabase Auth State
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Load initial data
  const loadData = async () => {
    try {
      const [sData, rData, fData] = await Promise.all([
        api.fetchStats(),
        api.fetchRepositories(),
        api.fetchFindings()
      ]);
      setStats(sData);
      setRepositories(rData);
      setFindings(fData);
      if (fData.length > 0 && !selectedFinding) {
        setSelectedFinding(fData[0]);
      }
      setLastScanSecondsAgo(5);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check initial Supabase user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Live timer tick
    const timer = setInterval(() => {
      setLastScanSecondsAgo(prev => prev + 1);
    }, 1000);
    // Background polling refresh every 15s
    const pollInterval = setInterval(() => {
      loadData();
    }, 15000);
    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Handle Global Scan Now
  const handleScanNow = async () => {
    setScanning(true);
    try {
      await api.triggerScanAll();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setScanning(false), 800);
    }
  };

  // Handle Add Repository
  const handleAddRepo = async (e) => {
    e.preventDefault();
    if (!newRepoInput.trim()) return;
    setRepoSubmitting(true);
    setRepoError('');
    try {
      await api.addRepository(newRepoInput.trim(), '', user?.id);
      setNewRepoInput('');
      await loadData();
    } catch (err) {
      setRepoError(err.message || 'Failed to add repository');
    } finally {
      setRepoSubmitting(false);
    }
  };

  // Handle Delete Repository
  const handleDeleteRepo = async (repoId) => {
    if (!confirm('Are you sure you want to stop monitoring this repository?')) return;
    try {
      await api.deleteRepository(repoId);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Scan Specific Repo
  const handleScanSingleRepo = async (repoId) => {
    try {
      await api.triggerRepoScan(repoId);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Finding Status Change
  const handleUpdateStatus = async (findingId, newStatus) => {
    try {
      const updated = await api.updateFindingStatus(findingId, newStatus);
      setFindings(prev => prev.map(f => f.id === findingId ? updated : f));
      if (selectedFinding && selectedFinding.id === findingId) {
        setSelectedFinding(updated);
      }
      // Refresh stats
      const s = await api.fetchStats();
      setStats(s);
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered Findings
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (findingStatusFilter !== 'all' && f.status !== findingStatusFilter) return false;
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && f.secret_type !== typeFilter) return false;
      if (repoFilter !== 'all' && f.repo_name !== repoFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inRepo = f.repo_name.toLowerCase().includes(q);
        const inFile = f.file_path.toLowerCase().includes(q);
        const inType = f.secret_type.toLowerCase().includes(q);
        const inVal = f.masked_value.toLowerCase().includes(q);
        if (!inRepo && !inFile && !inType && !inVal) return false;
      }
      return true;
    });
  }, [findings, findingStatusFilter, severityFilter, typeFilter, repoFilter, searchQuery]);

  const openFindingsCount = findings.filter(f => f.status === 'open').length;
  const resolvedFindingsCount = findings.filter(f => f.status === 'resolved').length;
  const fpFindingsCount = findings.filter(f => f.status === 'false_positive').length;

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchDashboard={() => setCurrentView('dashboard')}
          onOpenAuth={() => setAuthModalOpen(true)}
          user={user}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={(u) => {
            setUser(u);
            setCurrentView('dashboard');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* TOP NAVBAR */}
      <header className="border-b border-[#1c2436] bg-[#0f1420]/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setCurrentView('landing')} title="Back to Landing Page">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">SecretWatch</span>
          </div>

          {/* Home button */}
          <button
            onClick={() => setCurrentView('landing')}
            className="px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-[#151c2a] transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                activeTab === 'overview'
                  ? 'text-white bg-[#1a2234] border border-[#2b3752]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('findings')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                activeTab === 'findings'
                  ? 'text-white bg-[#1a2234] border border-[#2b3752]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Findings</span>
              <span className="px-1.5 py-0.2 text-xs rounded-full bg-slate-800 text-slate-300 font-semibold">
                {openFindingsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('repositories')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-colors ${
                activeTab === 'repositories'
                  ? 'text-white bg-[#1a2234] border border-[#2b3752]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
              }`}
            >
              <FolderGit2 className="w-4 h-4 text-blue-400" />
              <span>Repositories</span>
              <span className="px-1.5 py-0.2 text-xs rounded-full bg-slate-800 text-slate-300 font-semibold">
                {repositories.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          {/* Live scan indicator */}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-indicator" />
            <span>Last scan {lastScanSecondsAgo} seconds ago</span>
          </div>

          {/* Synthetic Demo Push trigger */}
          <button
            onClick={() => setTestModalOpen(true)}
            title="Simulate push for live hackathon demo"
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 flex items-center space-x-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Leak</span>
          </button>

          {/* Notification bell */}
          <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1a2234] rounded-lg transition">
            <Bell className="w-4 h-4" />
          </button>

          {/* User Auth Profile / Sign In */}
          {user ? (
            <div className="flex items-center space-x-2 bg-[#171e2c] border border-[#2b3752] rounded-lg px-2.5 py-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-xs text-slate-300 font-medium max-w-[120px] truncate">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="text-slate-500 hover:text-red-400 transition ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1c2436] hover:bg-[#263148] border border-[#2b3752] text-slate-200 hover:text-white flex items-center space-x-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sign In</span>
            </button>
          )}

          {/* Scan Now Button */}
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-medium flex items-center space-x-2 shadow-sm transition disabled:opacity-60"
          >
            <RotateCw className={`w-4 h-4 ${scanning ? 'spin-animation' : ''}`} />
            <span>Scan now</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {activeTab === 'overview' && (
          <OverviewView
            stats={stats}
            onSelectFinding={(f) => {
              setSelectedFinding(f);
              setActiveTab('findings');
            }}
          />
        )}

        {activeTab === 'findings' && (
          <FindingsView
            findings={filteredFindings}
            allFindings={findings}
            selectedFinding={selectedFinding}
            onSelectFinding={setSelectedFinding}
            findingStatusFilter={findingStatusFilter}
            setFindingStatusFilter={setFindingStatusFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            repoFilter={repoFilter}
            setRepoFilter={setRepoFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onUpdateStatus={handleUpdateStatus}
            openCount={openFindingsCount}
            resolvedCount={resolvedFindingsCount}
            fpCount={fpFindingsCount}
          />
        )}

        {activeTab === 'repositories' && (
          <RepositoriesView
            repositories={repositories}
            newRepoInput={newRepoInput}
            setNewRepoInput={setNewRepoInput}
            repoSubmitting={repoSubmitting}
            repoError={repoError}
            onAddRepo={handleAddRepo}
            onDeleteRepo={handleDeleteRepo}
            onScanRepo={handleScanSingleRepo}
          />
        )}
      </main>

      {/* SYNTHETIC DEMO SIMULATION MODAL */}
      {testModalOpen && (
        <SyntheticModal
          onClose={() => setTestModalOpen(false)}
          repositories={repositories}
          onSuccess={loadData}
        />
      )}

      {/* SUPABASE AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  );
}

// ==========================================
// VIEW 1: OVERVIEW COMPONENT
// ==========================================
function OverviewView({ stats, onSelectFinding }) {
  if (!stats) return <div className="text-slate-400 py-12 text-center">Loading overview metrics...</div>;

  const totalRepos = stats.total_repositories ?? 0;
  const openFindings = stats.open_findings ?? 0;
  const critical = stats.critical_findings ?? 0;
  const foundToday = stats.found_today ?? 0;

  const bySev = stats.by_severity || { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const dailyData = stats.findings_per_day || [
    { day: 'Mon', count: 0 },
    { day: 'Tue', count: 0 },
    { day: 'Wed', count: 0 },
    { day: 'Thu', count: 0 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 }
  ];

  const maxVal = Math.max(...dailyData.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>

      {/* 4 STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Repositories */}
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Repositories</span>
            <span className="text-3xl font-bold text-white tracking-tight">{totalRepos}</span>
            <span className="text-xs text-slate-400 block mt-1">Public, under watch</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Open findings */}
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Open findings</span>
            <span className="text-3xl font-bold text-white tracking-tight">{openFindings}</span>
            <span className="text-xs text-slate-400 block mt-1">
              {openFindings > 0 ? 'Active exposed credentials' : 'No leaks detected'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Critical */}
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Critical</span>
            <span className={`text-3xl font-bold tracking-tight ${critical > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {critical}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              {critical > 0 ? 'Revoke immediately' : 'Zero critical exposures'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Found today */}
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Found today</span>
            <span className="text-3xl font-bold text-white tracking-tight">{foundToday}</span>
            <span className="text-xs text-slate-400 block mt-1">
              {foundToday > 0 ? 'Detected in last 24h' : 'No new leaks today'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2 CHARTS SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Findings per day (Bar chart) */}
        <div className="lg:col-span-2 bg-[#131823] border border-[#1e2638] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-6">Findings per day</h3>
          <div className="h-52 flex items-end justify-between px-4 pt-4 border-b border-[#1f283d] pb-2">
            {dailyData.map((item, idx) => {
              const heightPct = item.count > 0 ? Math.min(Math.max((item.count / maxVal) * 100, 20), 95) : 6;
              const isLast = idx === dailyData.length - 1;
              return (
                <div key={item.day} className="flex flex-col items-center space-y-2 group flex-1">
                  <div className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition">
                    {item.count}
                  </div>
                  <div className="w-10 rounded-t-md transition-all duration-300 relative flex items-end justify-center"
                    style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full h-full rounded-t-sm transition ${
                        item.count === 0
                          ? 'bg-[#1b2333]'
                          : isLast
                          ? 'bg-emerald-500 group-hover:bg-emerald-400'
                          : 'bg-blue-600 group-hover:bg-blue-500'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By severity (Donut chart) */}
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-6 flex flex-col justify-between">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">By severity</h3>
          <div className="flex items-center justify-around py-4">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="38" stroke="#1c2436" strokeWidth="12" fill="none" />
                {openFindings > 0 && (
                  <>
                    {/* Critical */}
                    <circle
                      cx="50" cy="50" r="38"
                      stroke="#ef4444" strokeWidth="12" fill="none"
                      strokeDasharray="238"
                      strokeDashoffset={238 - (bySev.Critical / Math.max(openFindings, 1)) * 238}
                      strokeLinecap="round"
                    />
                    {/* High */}
                    <circle
                      cx="50" cy="50" r="38"
                      stroke="#f97316" strokeWidth="12" fill="none"
                      strokeDasharray="238"
                      strokeDashoffset={238 - (bySev.High / Math.max(openFindings, 1)) * 238}
                    />
                  </>
                )}
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold text-white block">{openFindings}</span>
                <span className="text-xs text-slate-400 block -mt-1">{openFindings === 0 ? 'all clear' : 'open'}</span>
              </div>
            </div>

            {/* Severity Legend */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-300">Critical</span>
                <span className="text-slate-400 font-mono ml-auto">{bySev.Critical ?? 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-slate-300">High</span>
                <span className="text-slate-400 font-mono ml-auto">{bySev.High ?? 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-300">Medium</span>
                <span className="text-slate-400 font-mono ml-auto">{bySev.Medium ?? 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-slate-300">Low</span>
                <span className="text-slate-400 font-mono ml-auto">{bySev.Low ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT FINDINGS TABLE */}
      <div className="bg-[#131823] border border-[#1e2638] rounded-xl overflow-hidden">
        <div className="p-4 px-6 border-b border-[#1c2436] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">Recent findings</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1420] text-slate-400 border-b border-[#1c2436]">
              <tr>
                <th className="py-3 px-6 font-medium">Severity</th>
                <th className="py-3 px-6 font-medium">Repository</th>
                <th className="py-3 px-6 font-medium">File</th>
                <th className="py-3 px-6 font-medium">Type</th>
                <th className="py-3 px-6 font-medium">Value</th>
                <th className="py-3 px-6 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2233]">
              {(stats.recent_findings || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-slate-200 text-sm">All Monitored Repositories are Clean</p>
                      <p className="text-xs text-slate-500">No active secrets or tokens detected in watched student projects.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (stats.recent_findings || []).map((f) => {
                  const sevCfg = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.Medium;
                  const SevIcon = sevCfg.icon;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => onSelectFinding(f)}
                      className="hover:bg-[#182030] cursor-pointer transition group"
                    >
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${sevCfg.badge}`}>
                          <SevIcon className="w-3 h-3" />
                          <span>{f.severity}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="text-blue-400 hover:underline flex items-center space-x-1.5 font-medium">
                          <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{f.repo_name}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-300">
                        {f.file_path}:{f.line_no}
                      </td>
                      <td className="py-3.5 px-6 text-slate-300 flex items-center space-x-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        <span>{f.secret_type}</span>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-300 tracking-wider">
                        {f.masked_value}
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-400 whitespace-nowrap">
                        {timeAgo(f.detected_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VIEW 2: FINDINGS COMPONENT
// ==========================================
function FindingsView({
  findings,
  allFindings,
  selectedFinding,
  onSelectFinding,
  findingStatusFilter,
  setFindingStatusFilter,
  severityFilter,
  setSeverityFilter,
  typeFilter,
  setTypeFilter,
  repoFilter,
  setRepoFilter,
  searchQuery,
  setSearchQuery,
  onUpdateStatus,
  openCount,
  resolvedCount,
  fpCount
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Pagination slice
  const totalPages = Math.ceil(findings.length / itemsPerPage) || 1;
  const currentItems = findings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const reposList = useMemo(() => {
    return Array.from(new Set(allFindings.map(f => f.repo_name)));
  }, [allFindings]);

  const typesList = useMemo(() => {
    return Array.from(new Set(allFindings.map(f => f.secret_type)));
  }, [allFindings]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-white">Findings</h1>

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repository, file or type"
            className="w-full bg-[#131823] border border-[#1e2638] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          {/* Severity Dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#131823] border border-[#1e2638] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
          >
            <option value="all">Severity: All</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Type Dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#131823] border border-[#1e2638] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
          >
            <option value="all">Type: All</option>
            {typesList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Repository Dropdown */}
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="bg-[#131823] border border-[#1e2638] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
          >
            <option value="all">Repository: All</option>
            {reposList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* STATUS TABS */}
      <div className="flex items-center space-x-6 border-b border-[#1c2436] pb-2 text-sm">
        <button
          onClick={() => { setFindingStatusFilter('open'); setCurrentPage(1); }}
          className={`pb-2 flex items-center space-x-1.5 font-medium transition relative ${
            findingStatusFilter === 'open' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>{openCount} Open</span>
        </button>

        <button
          onClick={() => { setFindingStatusFilter('resolved'); setCurrentPage(1); }}
          className={`pb-2 flex items-center space-x-1.5 font-medium transition relative ${
            findingStatusFilter === 'resolved' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{resolvedCount} Resolved</span>
        </button>

        <button
          onClick={() => { setFindingStatusFilter('false_positive'); setCurrentPage(1); }}
          className={`pb-2 flex items-center space-x-1.5 font-medium transition relative ${
            findingStatusFilter === 'false_positive' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ban className="w-3.5 h-3.5 text-slate-400" />
          <span>{fpCount} False positive</span>
        </button>
      </div>

      {/* SPLIT LAYOUT: FINDINGS TABLE & DETAILS CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Table */}
        <div className="lg:col-span-7 bg-[#131823] border border-[#1e2638] rounded-xl overflow-hidden flex flex-col justify-between min-h-[460px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f1420] text-slate-400 border-b border-[#1c2436]">
                <tr>
                  <th className="py-3 px-4 font-medium">Severity</th>
                  <th className="py-3 px-4 font-medium">Repository and file</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Value</th>
                  <th className="py-3 px-4 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2233]">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No findings matching the filters.
                    </td>
                  </tr>
                ) : (
                  currentItems.map((f) => {
                    const sevCfg = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.Medium;
                    const SevIcon = sevCfg.icon;
                    const isSelected = selectedFinding && selectedFinding.id === f.id;
                    return (
                      <tr
                        key={f.id}
                        onClick={() => onSelectFinding(f)}
                        className={`hover:bg-[#182030] cursor-pointer transition ${
                          isSelected ? 'bg-[#182030] border-l-2 border-emerald-400' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${sevCfg.badge}`}>
                            <SevIcon className="w-2.5 h-2.5" />
                            <span>{f.severity}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-blue-400">{f.repo_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{f.file_path}:{f.line_no}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div className="flex items-center space-x-1">
                            <KeyRound className="w-3 h-3 text-slate-400" />
                            <span>{f.secret_type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {f.masked_value}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 whitespace-nowrap">
                          {timeAgo(f.detected_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 px-4 border-t border-[#1c2436] flex items-center justify-between text-xs text-slate-400 bg-[#0f1420]">
            <span>
              {findings.length > 0
                ? `${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, findings.length)} of ${findings.length}`
                : '0 of 0'}
            </span>
            <div className="flex items-center space-x-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="px-2 py-1 rounded bg-[#171e2c] hover:bg-[#1f283d] disabled:opacity-40"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-6 h-6 rounded flex items-center justify-center font-medium ${
                    currentPage === i + 1 ? 'bg-blue-600 text-white' : 'hover:bg-[#1f283d]'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="px-2 py-1 rounded bg-[#171e2c] hover:bg-[#1f283d] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Finding Details Card */}
        <div className="lg:col-span-5 bg-[#131823] border border-[#1e2638] rounded-xl p-6 space-y-5 sticky top-20">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5" />
            <span>Finding details</span>
          </div>

          {selectedFinding ? (
            <div className="space-y-5">
              {/* Severity + Title */}
              <div className="flex items-center space-x-2.5">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${SEVERITY_STYLES[selectedFinding.severity]?.badge}`}>
                  {selectedFinding.severity}
                </span>
                <h2 className="text-base font-bold text-white tracking-tight">{selectedFinding.secret_type}</h2>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-2 text-xs divide-y divide-[#1b2233]">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Repository</span>
                  <a href={`https://github.com/${selectedFinding.repo_name}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center space-x-1">
                    <span>{selectedFinding.repo_name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">File</span>
                  <span className="font-mono text-slate-200">{selectedFinding.file_path}:{selectedFinding.line_no}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Commit</span>
                  <a href={selectedFinding.commit_url || '#'} target="_blank" rel="noreferrer" className="font-mono text-blue-400 hover:underline">
                    {selectedFinding.commit_sha?.substring(0, 7) || 'unknown'}
                  </a>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Value (Masked)</span>
                  <span className="font-mono text-slate-200">{selectedFinding.masked_value}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Entropy Score</span>
                  <span className="font-mono text-slate-200">{selectedFinding.entropy_score?.toFixed(2) || '0.00'} bits/char</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Detected</span>
                  <span className="text-slate-200">{timeAgo(selectedFinding.detected_at)}</span>
                </div>
              </div>

              {/* Alert status notice */}
              <div className="bg-[#182133] border border-[#232f48] rounded-lg p-3 text-xs text-blue-300 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Alert sent to Discord #secret-alerts</span>
              </div>

              {/* What to do now (Remediation) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">What to do now</h4>
                <div className="space-y-2 text-xs text-slate-300">
                  {selectedFinding.remediation ? (
                    selectedFinding.remediation.split('\n').map((step, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-slate-300 leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">Revoke the key immediately in provider console.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => onUpdateStatus(selectedFinding.id, 'resolved')}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark resolved</span>
                </button>
                <button
                  onClick={() => onUpdateStatus(selectedFinding.id, 'false_positive')}
                  className="px-3 py-2 rounded-lg bg-[#1f283d] hover:bg-[#283550] text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>False positive</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Select a finding to inspect detailed risk indicators and remediation steps.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VIEW 3: REPOSITORIES COMPONENT
// ==========================================
function RepositoriesView({
  repositories,
  newRepoInput,
  setNewRepoInput,
  repoSubmitting,
  repoError,
  onAddRepo,
  onDeleteRepo,
  onScanRepo
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">Repositories</h1>

      {/* TOP ADD REPOSITORY CARD */}
      <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add a repository to monitor</span>
        </div>

        <form onSubmit={onAddRepo} className="flex gap-3">
          <div className="relative flex-1">
            <FolderGit2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={newRepoInput}
              onChange={(e) => setNewRepoInput(e.target.value)}
              placeholder="owner/repository or GitHub username"
              className="w-full bg-[#0c1017] border border-[#1e2638] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={repoSubmitting}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold flex items-center space-x-1.5 transition disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>

        {repoError && (
          <p className="text-xs text-red-400 font-medium">{repoError}</p>
        )}
      </div>

      {/* REPOSITORIES GRID */}
      {repositories.length === 0 ? (
        <div className="bg-[#131823] border border-[#1e2638] rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Repositories Under Watch</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Add a public student GitHub repository above (format: <code>username/repository</code>) to start real-time commit surveillance and Discord alerts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repositories.map((repo) => {
            const breakdown = repo.severity_breakdown || { Critical: 0, High: 0, Medium: 0, Low: 0 };
            const openCount = repo.open_findings_count || 0;

          // Status Badge format
          let statusBadge = (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              <span>Idle</span>
            </span>
          );

          if (repo.status === 'Scanning') {
            statusBadge = (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <RotateCw className="w-3 h-3 spin-animation" />
                <span>Scanning</span>
              </span>
            );
          } else if (repo.status === 'Error') {
            statusBadge = (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-3 h-3" />
                <span>Error</span>
              </span>
            );
          }

          return (
            <div
              key={repo.id}
              className="bg-[#131823] border border-[#1e2638] rounded-xl p-5 flex flex-col justify-between hover:border-[#2b3752] transition group"
            >
              <div className="space-y-3">
                {/* Header: Name + Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition" />
                    <span className="font-semibold text-sm text-white">{repo.full_name}</span>
                  </div>
                  {statusBadge}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                  {repo.description || 'Public student repository under real-time surveillance.'}
                </p>

                {/* Last scan info */}
                <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {repo.error_message
                      ? `Last scan ${repo.error_message}`
                      : `Last scan ${timeAgo(repo.last_scanned_at)}`}
                  </span>
                </div>

                {/* Open findings & severity dots */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{openCount} open</span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>{breakdown.Critical}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>{breakdown.High}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>{breakdown.Medium}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span>{breakdown.Low}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#1b2233]">
                <button
                  onClick={() => onScanRepo(repo.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#182133] hover:bg-[#212c42] text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <RotateCw className="w-3 h-3 text-slate-400" />
                  <span>Scan now</span>
                </button>

                <button
                  onClick={() => onDeleteRepo(repo.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Remove from monitoring"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODAL: SYNTHETIC TEST COMMIT (DEMO TOOL)
// ==========================================
function SyntheticModal({ onClose, repositories, onSuccess }) {
  const [targetRepo, setTargetRepo] = useState(repositories[0]?.full_name || 'rahul-ml-project');
  const [keyType, setKeyType] = useState('AWS key');
  const [customKey, setCustomKey] = useState('AKIAIOSFODNN7EXAMP99');
  const [simulating, setSimulating] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const sampleKeys = {
    'AWS key': 'AKIAIOSFODNN7EXAMP99',
    'OpenAI key': 'sk-proj-demoKey998877665544332211aa',
    'GitHub token': 'ghp_hackathonDemoSecret1234567890abcdef',
    'Database URL': 'postgres://admin:SuperSecretPass123@db.student.internal:5432/app'
  };

  const handleSelectType = (t) => {
    setKeyType(t);
    setCustomKey(sampleKeys[t] || '');
  };

  const handleRun = async () => {
    setSimulating(true);
    setResultMsg('');
    try {
      await api.simulateSyntheticPush(targetRepo, keyType, customKey);
      setResultMsg('Synthetic push simulated! Check Discord and the dashboard in 3 seconds.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e) {
      setResultMsg('Error: ' + e.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#131823] border border-[#1e2638] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-white text-base">Live Demo: Simulate Push</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Simulate a student pushing a commit with an unmasked API key to test real-time detection, Discord alerts, and instant dashboard sync.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Target Repository</label>
            {repositories.length > 0 ? (
              <select
                value={targetRepo}
                onChange={(e) => setTargetRepo(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#1e2638] rounded-lg p-2 text-slate-200"
              >
                {repositories.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={targetRepo}
                onChange={(e) => setTargetRepo(e.target.value)}
                placeholder="e.g. college-club/demo-repo"
                className="w-full bg-[#0c1017] border border-[#1e2638] rounded-lg p-2 text-slate-200 font-mono text-xs"
              />
            )}
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Secret Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(sampleKeys).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleSelectType(k)}
                  className={`p-2 rounded-lg border text-left font-medium transition ${
                    keyType === k
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-[#1e2638] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Synthetic Secret Value</label>
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="w-full bg-[#0c1017] border border-[#1e2638] rounded-lg p-2 font-mono text-slate-200 text-xs"
            />
          </div>
        </div>

        {resultMsg && <p className="text-xs text-emerald-400 font-medium">{resultMsg}</p>}

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={simulating}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 flex items-center space-x-1.5"
          >
            {simulating ? <RotateCw className="w-3.5 h-3.5 spin-animation" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Push & Scan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
