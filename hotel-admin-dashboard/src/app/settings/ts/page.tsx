"use client";
import React, { useState } from 'react';
import { LogOut, Wrench, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';

export default function TSSettings() {
    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="bg-orange-600/20 p-4 rounded-2xl border border-orange-500/30">
                            <Wrench className="w-8 h-8 text-orange-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">Teknik Servis (T/S) Paneli</h1>
                                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Teknik bakım operasyonları ve arıza takibi yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                {/* Content Placeholder */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center text-center py-20">
                    <AlertTriangle className="w-16 h-16 text-slate-600 mb-6" />
                    <h2 className="text-2xl font-bold text-slate-300 mb-2">Teknik Servis Paneli Yapılandırılıyor</h2>
                    <p className="text-slate-500 max-w-lg">Bu panel şu anda geliştirme aşamasındadır. Yakında arıza kayıt raporlamaları ve bakım formları buraya eklenecektir.</p>
                </div>

            </div>
        </div>
    );
}
