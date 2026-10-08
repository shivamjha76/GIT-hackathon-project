import React from 'react';
import {
  Shield,
  ArrowRight,
  Lock,
  Bell,
  Terminal,
  Code2,
  CheckCircle2,
  Zap,
  FolderGit2,
  Flame,
  LayoutDashboard,
  LogIn,
  KeyRound
} from 'lucide-react';

export default function LandingPage({ onLaunchDashboard, onOpenAuth, user }) {
  const supportedProviders = [
    { name: 'AWS Access Keys', prefix: 'AKIA...', sev: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { name: 'OpenAI API Keys', prefix: 'sk-...', sev: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { name: 'GitHub PATs', prefix: 'ghp_...', sev: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { name: 'Database Passwords', prefix: 'postgres://...', sev: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { name: 'Google Cloud Keys', prefix: 'AIza...', sev: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { name: 'Stripe Secret Keys', prefix: 'sk_live_...', sev: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { name: 'Private Key Blocks', prefix: 'BEGIN RSA...', sev: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { name: 'Discord Webhooks', prefix: 'discord.com/api...', sev: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  ];

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* TOP NAVIGATION */}
      <nav className="border-b border-[#1c2436] bg-[#0f1420]/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">SecretWatch</span>
        </div>

        <div className="hidden md:flex items-center space-x-8 text-sm text-slate-300">
          <a href="#how-it-works" className="hover:text-emerald-400 transition">How It Works</a>
          <a href="#engine" className="hover:text-emerald-400 transition">Detection Engine</a>
          <a href="#coverage" className="hover:text-emerald-400 transition">Supported Secrets</a>
        </div>

        <div className="flex items-center space-x-3">
          {user ? (
            <span className="text-xs text-slate-300 hidden sm:inline-block font-mono bg-[#171e2c] border border-[#232f48] px-2.5 py-1 rounded-md">
              {user.email}
            </span>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#151c2a] hover:bg-[#1f283d] border border-[#242f46] text-slate-300 hover:text-white flex items-center space-x-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={onLaunchDashboard}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Open Dashboard</span>
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-6">
        {/* Hackathon Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>Codefiesta 5.0 Flagship Hackathon • Problem Statement #03</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Stop Secret Leaks in Student Repositories <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Before Attackers Exploit Them.
          </span>
        </h1>

        {/* Subhead */}
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Students frequently commit API keys, cloud credentials, and database passwords to public GitHub repositories.
          <strong className="text-slate-200 font-medium"> SecretWatch</strong> detects them in seconds, delivers plain-language remediation to Discord, and never stores raw credentials.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
          <button
            onClick={onLaunchDashboard}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition group"
          >
            <span>Launch Live Dashboard</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => {
              onLaunchDashboard();
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#141a26] hover:bg-[#1a2233] border border-[#232f48] text-slate-300 hover:text-white text-sm font-semibold flex items-center justify-center space-x-2 transition"
          >
            <FolderGit2 className="w-4 h-4 text-slate-400" />
            <span>Monitor a Repository</span>
          </button>
        </div>

        {/* Trust Points */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero Plaintext Stored</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>&lt; 5-Second Latency</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Instant Discord Alerts</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Supabase Cloud Persistent</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Architecture & Workflow</h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">How SecretWatch Protects You</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-[#131823] border border-[#1e2638] rounded-2xl p-6 space-y-4 hover:border-[#2b3752] transition">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
              1
            </div>
            <h4 className="text-base font-bold text-white">GitHub Ingestion</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              SecretWatch monitors student repositories continuously using GitHub Push Webhooks and lightweight ETag conditional polling to preserve API quotas.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#131823] border border-[#1e2638] rounded-2xl p-6 space-y-4 hover:border-[#2b3752] transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              2
            </div>
            <h4 className="text-base font-bold text-white">Two-Stage Detector</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Stage 1 matches known provider formats (AWS, OpenAI, Stripe). Stage 2 computes Shannon entropy and analyzes variable context keywords to detect unknown keys.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#131823] border border-[#1e2638] rounded-2xl p-6 space-y-4 hover:border-[#2b3752] transition">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
              3
            </div>
            <h4 className="text-base font-bold text-white">Discord & Webhook Alert</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sends actionable alerts to Discord channels with commit links and guidance explaining why deleting the key in a later commit does not clear Git history.
            </p>
          </div>
        </div>
      </section>

      {/* SUPPORTED SECRETS GRID */}
      <section id="coverage" className="py-12 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Detection Coverage</h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">Supported Credential Families</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {supportedProviders.map((p) => (
            <div key={p.name} className="bg-[#131823] border border-[#1e2638] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${p.color}`}>
                  {p.sev}
                </span>
              </div>
              <h5 className="text-xs font-semibold text-white">{p.name}</h5>
              <p className="text-[11px] font-mono text-slate-500">{p.prefix}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-[#1c2436] py-8 px-6 text-center text-xs text-slate-500 space-y-2">
        <p>SecretWatch Sentinel • Built for Codefiesta 5.0 Flagship Hackathon (GIT Jaipur)</p>
        <p>Cybersecurity Track • Problem Statement #03</p>
      </footer>
    </div>
  );
}
