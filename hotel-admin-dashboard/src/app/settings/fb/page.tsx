"use client";
import React, { useState } from 'react';
import { Settings, FileText, UploadCloud, Utensils, Coffee, Clock, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function FandBSettings() {
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});

    const handleGenericUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const now = new Date();
            const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`;
            setUploadTimes(prev => ({ ...prev, [key]: timeString }));
        }
    };
    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="bg-orange-600/20 p-4 rounded-2xl border border-orange-500/30">
                            <Utensils className="w-8 h-8 text-orange-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">F/B (Yiyecek & İçecek) Paneli</h1>
                                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Restoran, bar menüleri ve çalışma saatleri yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Restoran & Bar Menüleri */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <FileText className="w-6 h-6 text-orange-400" />
                            <h2 className="text-xl font-bold">A'la Carte & Bar Menüleri Ekler</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Tüm restoran ve barlardaki menüleri, içerikleri ve alerjen bilgilerini güncelleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-orange-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-orange-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('menus', e)} />
                        </label>
                        {uploadTimes['menus'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['menus']}</div>
                        )}
                    </div>

                    {/* Çalışma Saatleri & Konsept */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-4">
                            <Clock className="w-6 h-6 text-yellow-400" />
                            <h2 className="text-xl font-bold">Çalışma Saatleri & Kurallar</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Restoran açılış-kapanış saatlerini, Dress Code kurallarını asistan için sabitleyin.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-yellow-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-yellow-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('hours', e)} />
                        </label>
                        {uploadTimes['hours'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['hours']}</div>
                        )}
                    </div>

                    {/* Özel Yemekler ve Mini Bar */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all md:col-span-2">
                        <div className="flex items-center gap-4 mb-4">
                            <Coffee className="w-6 h-6 text-emerald-400" />
                            <h2 className="text-xl font-bold">Room Service & Minibar Listesi</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Oda servisi içerikleri, ekstra F/B talepleri veya minibar dolum periyotları/fiyatları.</p>
                        
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-950/50 hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-emerald-400 transition-colors" />
                                <p className="mb-2 text-sm text-slate-400"><span className="font-bold text-emerald-400">Tıklayın</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('roomservice', e)} />
                        </label>
                        {uploadTimes['roomservice'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['roomservice']}</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
