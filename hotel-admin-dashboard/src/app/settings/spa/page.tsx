"use client";
import React, { useState } from 'react';
import { Settings, UploadCloud, Droplets, Sparkles, Image as ImageIcon, HeartPulse, LogOut, CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function SpaSettings() {
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
                        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30">
                            <Droplets className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">SPA Paneli</h1>
                                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Masaj türleri, güzellik hizmetleri ve paket fiyatlandırma yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Masaj, Terapi vs Listesi */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['services'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-indigo-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['services'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Sparkles className="w-6 h-6 text-indigo-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['services'] ? 'text-emerald-400' : ''}`}>Terapi & Masaj Türleri Bilgilendirmesi</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Thai, Bali, Medikal masajlar ve diğer terapi türlerinin süre, içerik ve fiyat bilgilerini (PDF/Excel) yükleyin.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['services'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['services'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['services'] ? 'text-emerald-400' : 'text-indigo-400'}`}>{uploadTimes['services'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('services', e)} />
                        </label>
                        {uploadTimes['services'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['services']}</div>
                        )}
                    </div>

                    {/* Hizmet Görselleri */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['images'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-pink-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['images'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <ImageIcon className="w-6 h-6 text-pink-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['images'] ? 'text-emerald-400' : ''}`}>SPA Ortam & Hizmet Görselleri</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Misafirlere sunulacak olan hamam, sauna ve terapi odası görsellerini yükleyin (Asistan, sorulara bu görsellerle yanıt verecektir).</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['images'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['images'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-pink-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['images'] ? 'text-emerald-400' : 'text-pink-400'}`}>{uploadTimes['images'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleGenericUpload('images', e)} />
                        </label>
                        {uploadTimes['images'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['images']}</div>
                        )}
                    </div>

                    {/* SPA Paketleri ve Üyelikler */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all md:col-span-2 ${uploadTimes['packages'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-emerald-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['packages'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <HeartPulse className="w-6 h-6 text-emerald-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['packages'] ? 'text-emerald-400' : ''}`}>Özel SPA Paketleri & VIP Bakımlar</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Balayı çiftlerine özel paketler, haftalık/Aylık spa üyelik avantajları ve cilt bakım ritüelleri bilgilerini ekleyin.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['packages'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['packages'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['packages'] ? 'text-emerald-400' : 'text-emerald-400'}`}>{uploadTimes['packages'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('packages', e)} />
                        </label>
                        {uploadTimes['packages'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['packages']}</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
