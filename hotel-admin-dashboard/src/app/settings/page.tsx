"use client";
import React, { useState } from 'react';
import { Settings, FileText, UploadCloud, Hotel, Save, CheckCircle2, Building, Info, FileSpreadsheet } from 'lucide-react';
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
                            <h1 className="text-3xl font-extrabold tracking-tight">Sistem Panel Ayarları</h1>
                            <p className="text-slate-400 font-medium mt-1">Otel konsepti, Fact Sheet ve genel bilgilerin yönetimi.</p>
                        </div>
                    </div>
                    <Link href="/" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm flex items-center gap-2">
                        ← Sunum Ekranına Dön
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column: Uploads */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Konsept Yükleme */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <FileText className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl font-bold">Konsept Dosyası Ekle</h2>
                            </div>
                            <p className="text-slate-400 text-sm mb-6">Yaz sezonu, kış sezonu veya özel etkinlik konseptlerini içeren belgeleri yükleyin (Word/PDF).</p>
                            
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-blue-400 transition-colors" />
                                    <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-blue-400">Tıklayın</span> veya sürükleyip bırakın</p>
                                    <p className="text-xs text-slate-500">PDF, DOCX, veya TXT (Max 10MB)</p>
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
                            <p className="text-slate-400 text-sm mb-6">Otelin tüm fiziki özelliklerinin yer aldığı detaylı Excel, Word veya PDF dokümanını sisteme yükleyin.</p>
                            
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                                    <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-cyan-400">Tıklayın</span> veya sürükleyip bırakın</p>
                                    <p className="text-xs text-slate-500">XLSX, PDF veya DOCX (Max 15MB)</p>
                                </div>
                                <input type="file" className="hidden" />
                            </label>
                        </div>

                    </div>

                    {/* Right Column: Hotel Detail Info */}
                    <div className="lg:col-span-7">
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
