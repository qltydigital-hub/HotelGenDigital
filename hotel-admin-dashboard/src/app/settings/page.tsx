"use client";
import React, { useState } from 'react';
import { Settings, Hotel, Save, CheckCircle2, Building, Info, ShieldCheck, Database, RefreshCcw, Bell, HeartHandshake, Coffee, Droplet, Sparkles, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';

export default function SettingsPage() {
    const { user } = useAuth();
    const [saved, setSaved] = useState(false);
    
    // Ajans Veritabanı Simülasyonu (SaaS için farklı oteller)
    const [demoHotelsData, setDemoHotelsData] = useState({
        'hotelgen': {
            id: 'hotelgen',
            name: 'HotelGen Digital Resort',
            address: 'Antalya, Türkiye',
            phone: '+90 242 123 4567',
            generalRules: 'Check-in: 14:00, Check-out: 12:00. Evcil hayvan kabul edilmemektedir.',
        },
        'rixos': {
            id: 'rixos',
            name: 'Rixos Premium Belek',
            address: 'Belek Mevkii, Serik/Antalya, Türkiye',
            phone: '+90 242 710 2000',
            generalRules: 'Check-in: 14:00, Check-out: 12:00. Rixy Kids Club 09:00 - 23:00 arası aktiftir. Tüm konaklamalarda The Land of Legends giriş ücretsizdir.',
        },
        'titanic': {
            id: 'titanic',
            name: 'Titanic Mardan Palace',
            address: 'Kundu Mah. Tesisler Cad, Aksu/Antalya',
            phone: '+90 242 310 4100',
            generalRules: 'Check-in: 14:00, Check-out: 12:00. Akşam yemeklerinde ana restoranda dress-code (kıyafet kuralı) uygulanmaktadır. Havuza bone ile girilmelidir.',
        }
    });

    const [activeHotelId, setActiveHotelId] = useState('hotelgen');
    const [hotelInfo, setHotelInfo] = useState(demoHotelsData['hotelgen']);

    React.useEffect(() => {
        if (user && user.tenant_id && user.department !== 'admin') {
            const tenantKey = user.tenant_id as keyof typeof demoHotelsData;
            if (demoHotelsData[tenantKey]) {
                setActiveHotelId(user.tenant_id);
                setHotelInfo(demoHotelsData[tenantKey]);
            }
        }
    }, [user]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setDemoHotelsData({ ...demoHotelsData, [activeHotelId]: hotelInfo });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const changeTenant = (newId: string) => {
        setActiveHotelId(newId);
        setHotelInfo((demoHotelsData as any)[newId]);
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
                            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                                <span className="text-blue-400">{hotelInfo.name || 'Hotel'}</span> Yönetim Paneli
                            </h1>
                            <p className="text-slate-400 font-medium mt-1">Otel konsepti, Fact Sheet ve genel bilgilerin yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {user && user.department === 'admin' ? (
                            <>
                                <Link href="/admin-panel" className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 text-sm text-white">
                                    <ShieldCheck className="w-4 h-4" /> VIP Yönetici Paneli
                                </Link>
                                <Link href="/" className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm flex items-center justify-center gap-2">
                                    ← Sunum Ekranına Dön
                                </Link>
                            </>
                        ) : (
                            <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-sm flex items-center justify-center gap-2">
                                ← Cihaz/Departman Seçimine Dön
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="w-full max-w-4xl">
                        
                        {/* Simulation UI Bar (Only visible to Agency SuperAdmins) */}
                        {user && user.department === 'admin' && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center justify-between shadow-lg shadow-amber-900/10">
                                <div className="flex items-center gap-3 mb-4 sm:mb-0">
                                    <div className="bg-amber-600/20 p-2 rounded-lg">
                                        <Database className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-amber-100 font-bold text-sm">Ajans (SaaS) Veritabanı Simülasyonu</h3>
                                        <p className="text-xs text-amber-400/80 mt-0.5">Yapay zeka hangi otelin panelindeyse o otelin ID'siyle kurallarını çeker.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
                                    <RefreshCcw className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Giriş Yapan Otel:</span>
                                    <select 
                                        value={activeHotelId}
                                        onChange={(e) => changeTenant(e.target.value)}
                                        className="bg-slate-900 text-white font-bold text-sm rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                                    >
                                        <option value="hotelgen">HotelGen Digital Resort</option>
                                        <option value="rixos">Rixos Premium Belek</option>
                                        <option value="titanic">Titanic Mardan Palace</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Tenant Navigation Menu */}
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-3xl p-6 mb-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">Hızlı Departman Erişimi</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Link href="/settings/fo" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-blue-900/20 border border-slate-800 hover:border-blue-500/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Bell className="w-5 h-5 text-blue-400" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">F/O</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Önbüro</span></div>
                                </Link>
                                <Link href="/settings/gr" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-rose-900/20 border border-slate-800 hover:border-rose-500/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-rose-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><HeartHandshake className="w-5 h-5 text-rose-400" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">G/R</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Misafir İlş.</span></div>
                                </Link>
                                <Link href="/settings/fb" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-orange-900/20 border border-slate-800 hover:border-orange-500/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-orange-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Coffee className="w-5 h-5 text-orange-400" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">F/B</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Yeme İçecek</span></div>
                                </Link>
                                <Link href="/settings/spa" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-teal-900/20 border border-slate-800 hover:border-teal-500/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-teal-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Droplet className="w-5 h-5 text-teal-400" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">SPA</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Sağlık Mrkz.</span></div>
                                </Link>
                                <Link href="/settings/hk" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-purple-900/20 border border-slate-800 hover:border-purple-500/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-purple-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Sparkles className="w-5 h-5 text-purple-400" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">H/K</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Temizlik</span></div>
                                </Link>
                                <Link href="/settings/ts" className="group flex items-center gap-3 p-3 bg-slate-950/50 hover:bg-zinc-700/40 border border-slate-800 hover:border-zinc-400/50 transition-all rounded-2xl relative overflow-hidden">
                                    <div className="bg-zinc-500/20 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Wrench className="w-5 h-5 text-zinc-300" /></div>
                                    <div className="flex flex-col"><span className="text-xs text-slate-500 font-bold">T/S</span><span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Teknik Servis</span></div>
                                </Link>
                            </div>
                        </div>

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
