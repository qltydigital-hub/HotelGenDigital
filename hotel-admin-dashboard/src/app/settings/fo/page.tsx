"use client";
import React, { useState } from 'react';
import { Settings, FileText, UploadCloud, FileSpreadsheet, Banknote, ShieldCheck, Sun, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function FrontOfficeSettings() {
    const [saved, setSaved] = useState(false);

    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30">
                            <Settings className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">Önbüro (F/O) Paneli</h1>
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Önbüro departmanına ait konsept, fiyat ve fact sheet yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Konsept Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <FileText className="w-6 h-6 text-blue-400" />
                            <h2 className="text-xl font-bold">Konsept Dosyası Ekle</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Yaz sezonu, kış sezonu veya özel etkinlik konseptlerini içeren belgeleri yükleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-blue-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-blue-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Fact Sheet Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
                            <h2 className="text-xl font-bold">Hotel Fact Sheet Ekle</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Otelin tüm fiziki özelliklerinin yer aldığı detaylı Fact Sheet dokümanını yükleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-cyan-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Fiyat Listesi Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <Banknote className="w-6 h-6 text-emerald-400" />
                            <h2 className="text-xl font-bold">Periyodik Fiyat Listesi</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Dönemsel oda fiyatları veya önbüro hizmet harici fiyatlandırmalarını sisteme yükleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-emerald-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-emerald-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Daypass Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <Sun className="w-6 h-6 text-orange-400" />
                            <h2 className="text-xl font-bold">Günübirlik Misafir (Day-Pass) Fiyatları</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Otel dışı günübirlik misafir kabul şartları ve ücret listelerini yükleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-orange-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-orange-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                </div>
            </div>
        </div>
    );
}
