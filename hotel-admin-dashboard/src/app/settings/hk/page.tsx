"use client";
import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, Save, LogOut, BellRing, Smartphone, ClipboardList, Send, CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function HKSettings() {
    const [saved, setSaved] = useState(false);
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});

    const handleGenericUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const now = new Date();
            const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`;
            setUploadTimes(prev => ({ ...prev, [key]: timeString }));
        }
    };
    
    // Notifications States
    const [telegramEnabled, setTelegramEnabled] = useState(true);
    const [whatsappEnabled, setWhatsappEnabled] = useState(false);
    const [reportTime, setReportTime] = useState("16:00");

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    // Temporary internal component for Icon
    function HomeIcon(props: any) {
        return (
            <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="bg-teal-600/20 p-4 rounded-2xl border border-teal-500/30">
                            <HomeIcon className="w-8 h-8 text-teal-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">H/K (Housekeeping) Paneli</h1>
                                <span className="px-3 py-1 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Kat hizmetleri operasyonu ve günlük raporlama yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* H/K Belge Upload */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all h-fit ${uploadTimes['standards'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-teal-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['standards'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <ClipboardList className="w-6 h-6 text-teal-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['standards'] ? 'text-emerald-400' : ''}`}>Oda Temizlik Standartları ve Periyotları</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Havlu-çarşaf değişim günleri, temizlik standartları ve kimyasal güvenlik dokümanları.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['standards'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['standards'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-teal-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['standards'] ? 'text-emerald-400' : 'text-teal-400'}`}>{uploadTimes['standards'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('standards', e)} />
                        </label>
                        {uploadTimes['standards'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['standards']}</div>
                        )}
                    </div>

                    {/* Günlük Rapor Modülü */}
                    <div>
                        <form onSubmit={handleSave} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <BellRing className="w-7 h-7 text-white" />
                                    <h2 className="text-2xl font-extrabold tracking-wide">Günlük Otomatik Rapor</h2>
                                </div>
                                {saved && (
                                    <span className="flex items-center gap-2 text-sm font-bold text-green-400 bg-green-900/20 px-4 py-2 rounded-xl border border-green-500/30">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Kaydedildi
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-sm text-slate-400 mb-6">Günün sonunda HK yönetimine, eksik ve temizlik raporları hangi kanallarla iletilsin?</p>

                            <div className="space-y-4 mb-8">
                                {/* Telegram Toggle */}
                                <div 
                                    onClick={() => setTelegramEnabled(!telegramEnabled)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${telegramEnabled ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Send className={`w-5 h-5 ${telegramEnabled ? 'text-blue-400' : 'text-slate-500'}`} />
                                        <div>
                                            <p className="font-bold text-sm">Telegram Üzerinden İlet</p>
                                            <p className="text-xs text-slate-500">Hazırlandığında anında gönderilir</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${telegramEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${telegramEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                {/* Whatsapp Toggle */}
                                <div 
                                    onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${whatsappEnabled ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Smartphone className={`w-5 h-5 ${whatsappEnabled ? 'text-green-400' : 'text-slate-500'}`} />
                                        <div>
                                            <p className="font-bold text-sm">WhatsApp Üzerinden İlet</p>
                                            <p className="text-xs text-slate-500">Resmi işletme hesabı aracılığıyla</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${whatsappEnabled ? 'bg-green-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${whatsappEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Raporun Gönderileceği Saat</label>
                                <input 
                                    type="time" 
                                    value={reportTime}
                                    onChange={e => setReportTime(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors" 
                                />
                            </div>

                            <button type="submit" className="w-full py-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center justify-center gap-3">
                                <Save className="w-5 h-5" />
                                BİLDİRİM TERCİHLERİNİ KAYDET
                            </button>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}
