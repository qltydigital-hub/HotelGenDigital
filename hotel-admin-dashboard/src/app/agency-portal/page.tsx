"use client";
import React, { useState } from 'react';
import { Building2, PlusCircle, ArrowRight, ExternalLink, ShieldAlert, Cpu, Database, Command } from 'lucide-react';
import Link from 'next/link';

export default function MasterAgencyPortal() {
    const [selectedHotel, setSelectedHotel] = useState("");

    // Bu liste şimdilik statik. İleride sizin Notion/Airtable API'nizden veya Merkez Supabase'inizden çekilebilir.
    const [hotels, setHotels] = useState([
        {
            id: 'demo-01',
            name: 'Genel Demo Hotel (Sunum)',
            slug: 'demo-resort',
            url: 'https://hotelgen-demo.vercel.app',  // Örnek: sizin ana demo siteniz
            plan: 'Test Sürümü',
            packageType: 'paket2', // Default
            status: 'active'
        },
        {
            id: 'gaziantep-01',
            name: 'Gaziantep 27 A-Hotel',
            slug: 'gaziantep-27-a-hotel',
            url: 'https://gaziantep27-hotelgen.vercel.app', // A oteli kopyalandığında canlıya atacağınız site adresi
            plan: 'Premium Yıllık',
            packageType: 'paket2',
            status: 'active'
        },
        {
            id: 'istanbul-01',
            name: 'İstanbul B-Resort',
            slug: 'istanbul-b-resort',
            url: 'https://ist-bresort.vercel.app', // B oteli kopyası
            plan: 'Standart Aylık',
            packageType: 'paket1',
            status: 'installation' // Kurulum aşamasında
        }
    ]);

    const handlePackageChange = (hotelId: string, newPackage: string) => {
        setHotels(prev => prev.map(h => h.id === hotelId ? {...h, packageType: newPackage} : h));
    };

    const currentHotelData = hotels.find(h => h.id === selectedHotel);

    return (
        <div className="min-h-screen bg-[#060b14] text-white flex flex-col font-sans relative overflow-hidden">
            
            {/* Arkaplan Şekilleri (Sadece Görsel Hava Katmak İçin) */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

            {/* HEADER */}
            <header className="w-full border-b border-white/5 bg-white/5 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Command className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight tracking-wider">VIP YÖNETİCİ PANELİ</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Özgür ÖZEN & Kemal KUYUCU Özel Erişim Paneli</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Sistem Çevrimiçi
                        </div>
                        <div className="h-10 px-4 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-black text-slate-300 text-sm md:text-base whitespace-nowrap shadow-inner">
                            ÖzgürÖZEN & Kemal KUYUCU
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)]">
                
                <div className="w-full max-w-2xl text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Müşteri Portföyünüzü Yönetin</h2>
                    <p className="text-slate-400 text-lg">Aşağıdaki menüden işlem yapmak istediğiniz oteli seçerek, doğrudan o otelin tamamen izole edilmiş kendi yazılım paneline giriş yapabilirsiniz.</p>
                </div>

                {/* Dashboard Card */}
                <div className="w-full max-w-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 rounded-[2rem] p-8 shadow-2xl">
                    
                    {/* SEÇİCİ ALAN (DROPDOWN YERİNE DAHA ŞIK BİR KART GÖRÜNÜMÜ) */}
                    <div className="mb-8">
                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            Bağlantı Kurulacak Oteli Seçin
                        </label>
                        
                        <div className="grid gap-3">
                            {hotels.map((hotel) => (
                                <button
                                    key={hotel.id}
                                    onClick={() => setSelectedHotel(hotel.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border-2 text-left group ${
                                        selectedHotel === hotel.id 
                                            ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                                            : 'bg-slate-950/50 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                                            selectedHotel === hotel.id ? 'bg-blue-500' : 'bg-slate-800 group-hover:bg-slate-700'
                                        }`}>
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className={`text-lg font-bold transition-colors ${selectedHotel === hotel.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                                {hotel.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className={`${hotel.status === 'active' ? 'text emerald-400' : 'text-amber-400'} font-bold uppercase tracking-wider`}>
                                                    {hotel.status === 'active' ? 'Aktif Sistem' : 'Kurulumda'}
                                                </span>
                                                <span className="text-slate-500">•</span>
                                                <span className="text-purple-400 font-bold">
                                                    {hotel.packageType === 'paket1' ? 'AI Soru-Cevap (1K$)' : 'AI + İstek Paneli (3K$)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedHotel === hotel.id ? 'border-blue-400' : 'border-slate-600'
                                    }`}>
                                        {selectedHotel === hotel.id && <div className="w-3 h-3 rounded-full bg-blue-400" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PAKET YÖNETİMİ (Sadece Otel Seçiliyse Görünür) */}
                    {currentHotelData && (
                        <div className="mb-8 pt-8 border-t border-slate-800/80">
                            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-purple-400" />
                                Aktif Hizmet Paketi Yönetimi
                            </label>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => handlePackageChange(currentHotelData.id, 'paket1')}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                                        currentHotelData.packageType === 'paket1'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-lg font-bold text-white">Paket 1</h4>
                                        <span className="text-xl font-black text-emerald-400">1K$</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-2 font-medium">Sadece YZ Soru-Cevap</p>
                                    <p className="text-xs text-slate-500">Dışarıdan ve içeriden gelen soruları AI yanıtlar. Departman isteği almaz.</p>
                                </button>

                                <button
                                    onClick={() => handlePackageChange(currentHotelData.id, 'paket2')}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                                        currentHotelData.packageType === 'paket2'
                                        ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-lg font-bold text-white">Paket 2</h4>
                                        <span className="text-xl font-black text-emerald-400">3K$</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-2 font-medium">YZ + İstek Yönetim Paneli</p>
                                    <p className="text-xs text-slate-500">Soruları yanıtlar ve misafirin fiziksel isteklerini departmanlara yönlendirir.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ACTIONS */}
                    <div className="pt-8 border-t border-slate-800/80 flex flex-col md:flex-row gap-4 items-center">
                        <button 
                            disabled={!currentHotelData || currentHotelData.status === 'installation'}
                            onClick={() => {
                                if(currentHotelData) {
                                    // Şimdilik demo olduğu için hepsi ana panele(/) gitsin
                                    window.location.href = '/';
                                }
                            }}
                            className="w-full md:w-auto flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:shadow-none"
                        >
                            {currentHotelData ? (
                                currentHotelData.status === 'installation' 
                                ? 'YAPILANDIRMA SÜRÜYOR...' 
                                : `OTEL YÖNETİCİ PANELİNE GİT`
                            ) : (
                                'PORTALA GİRİŞ İÇİN SEÇİM YAPIN'
                            )}
                            {currentHotelData && currentHotelData.status !== 'installation' && <ExternalLink className="w-5 h-5" />}
                        </button>
                        
                        <button className="w-full md:w-auto px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 group">
                            <PlusCircle className="w-5 h-5 text-slate-400 group-hover:text-white" />
                            Yeni Otel (İstemci) Kaydet
                        </button>
                    </div>

                </div>

                {/* Info Text */}
                <div className="mt-8 flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <ShieldAlert className="w-5 h-5 text-purple-400" />
                    <p>Dikkat: Seçtiğiniz otele geçiş yaptığınızda, tamamen <strong className="text-slate-300">o otelin KVKK sorumluluğundaki veri sunucusuna (Yalıtılmış Supabase)</strong> bağlanırsınız.</p>
                </div>

            </main>
        </div>
    );
}
