"use client";
import React, { useState } from 'react';
import { Settings, Hotel, Save, CheckCircle2, Building, Info, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);
    
    // Form States
    const [hotelInfo, setHotelInfo] = useState({
        name: 'HotelGen Digital Resort',
        address: 'Antalya, Türkiye',
        phone: '+90 242 123 4567',
        generalRules: 'Check-in: 14:00, Check-out: 12:00. Evcil hayvan kabul edilmemektedir.',
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

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
                            <h1 className="text-3xl font-extrabold tracking-tight">Hotel Sistem Ayarları</h1>
                            <p className="text-slate-400 font-medium mt-1">Otel konsepti, Fact Sheet ve genel bilgilerin yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/admin-panel" className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 text-sm text-white">
                            <ShieldCheck className="w-4 h-4" /> VIP Yönetici Paneli
                        </Link>
                        <Link href="/" className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm flex items-center justify-center gap-2">
                            ← Sunum Ekranına Dön
                        </Link>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="w-full max-w-4xl">
                        <form onSubmit={handleSave} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <Hotel className="w-7 h-7 text-white" />
                                    <h2 className="text-2xl font-extrabold uppercase tracking-wide">Hotel Genel Bilgileri</h2>
                                </div>
                                {saved && (
                                    <span className="flex items-center gap-2 text-sm font-bold text-green-400 bg-green-900/20 px-4 py-2 rounded-xl border border-green-500/30">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Kaydedildi
                                    </span>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Building className="w-4 h-4 text-blue-500" /> Hotel Adı
                                    </label>
                                    <input 
                                        type="text" 
                                        value={hotelInfo.name}
                                        onChange={e => setHotelInfo({...hotelInfo, name: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors" 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-blue-500" /> İletişim / Rezervasyon
                                    </label>
                                    <input 
                                        type="text" 
                                        value={hotelInfo.phone}
                                        onChange={e => setHotelInfo({...hotelInfo, phone: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors" 
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tam Adres</label>
                                <input 
                                    type="text" 
                                    value={hotelInfo.address}
                                    onChange={e => setHotelInfo({...hotelInfo, address: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors" 
                                />
                            </div>

                            <div className="mb-10">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Genel Kurallar ve Ekstra Bilgiler</label>
                                <textarea 
                                    rows={5}
                                    value={hotelInfo.generalRules}
                                    onChange={e => setHotelInfo({...hotelInfo, generalRules: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none" 
                                    placeholder="Check-in kuralları, restoran saatleri, havuz kuralları vb..."
                                />
                                <p className="text-xs text-slate-500 mt-2">Bu bilgiler yapay zeka tarafından standart misafir sorularını yanıtlarken ana referans kaynağı olarak kullanılacaktır.</p>
                            </div>

                            <button type="submit" className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold transition-all shadow-lg flex items-center justify-center gap-3">
                                <Save className="w-5 h-5" />
                                TÜM BİLGİLERİ KAYDET
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
