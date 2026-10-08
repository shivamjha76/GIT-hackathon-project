import React from 'react';
import {
  Shield,
  ArrowRight,
  LogIn
} from 'lucide-react';

export default function LandingPage({ onLaunchDashboard, onOpenAuth, user }) {
  const handleGetStarted = () => {
    if (user) {
      onLaunchDashboard();
    } else {
      onOpenAuth();
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* TOP NAVIGATION */}
      <nav className="border-b border-[#1c2436] bg-[#0f1420]/80 backdrop-blur sticky top-0 z-40 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">SecretWatch</span>
        </div>

        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-300 font-mono bg-[#171e2c] border border-[#232f48] px-3 py-1.5 rounded-lg">
                {user.email}
              </span>
              <button
                onClick={onLaunchDashboard}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#151c2a] hover:bg-[#1f283d] border border-[#242f46] text-slate-200 hover:text-white flex items-center space-x-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-24 pb-20 px-6 max-w-4xl mx-auto text-center space-y-8">
        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Stop Secret Leaks in Student Repositories <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Before Attackers Exploit Them.
          </span>
        </h1>

        {/* CTA Button */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={handleGetStarted}
            className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center space-x-2.5 shadow-lg shadow-emerald-500/25 transition group cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-12 px-6 max-w-6xl mx-auto w-full">
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

      {/* FOOTER */}
      <footer className="mt-auto border-t border-[#1c2436] py-8 px-6 text-center text-xs text-slate-500 space-y-1">
        <p>SecretWatch Sentinel • Built for Codefiesta 5.0 Flagship Hackathon</p>
        <p>Cybersecurity Track • Problem Statement #03</p>
      </footer>
    </div>
  );
}
