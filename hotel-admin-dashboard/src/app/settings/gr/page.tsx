"use client";
import React, { useState } from 'react';
import { Settings, UploadCloud, HeartHandshake, Map, Star, LogOut, CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function GuestRelationSettings() {
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
                        <div className="bg-pink-600/20 p-4 rounded-2xl border border-pink-500/30">
                            <HeartHandshake className="w-8 h-8 text-pink-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">G/R (Guest Relations) Paneli</h1>
                                <span className="px-3 py-1 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">G/R bilgileri, A'la Carte, VIP misafir listeleri ve aktivite yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* A'la carte info */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['alacarte'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-pink-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['alacarte'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <UtensilsIcon className="w-6 h-6 text-pink-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['alacarte'] ? 'text-emerald-400' : ''}`}>A'la Carte İşleyiş ve Kuralları</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Misafirlerin restoran randevularını onaylama şartları, masa sayıları ve uygunlukları.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['alacarte'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['alacarte'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-pink-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['alacarte'] ? 'text-emerald-400' : 'text-pink-400'}`}>{uploadTimes['alacarte'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('alacarte', e)} />
                        </label>
                        {uploadTimes['alacarte'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['alacarte']}</div>
                        )}
                    </div>

                    {/* Etkinlik ve Harita */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['activities'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-blue-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['activities'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Map className="w-6 h-6 text-blue-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['activities'] ? 'text-emerald-400' : ''}`}>Günlük Aktivite ve Şov Bilgileri</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Akşam şovları, animasyon programı ve çocuk kulübü aktivite planlarını ekleyin.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['activities'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['activities'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['activities'] ? 'text-emerald-400' : 'text-blue-400'}`}>{uploadTimes['activities'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('activities', e)} />
                        </label>
                        {uploadTimes['activities'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['activities']}</div>
                        )}
                    </div>

                    {/* VIP Listesi */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all md:col-span-2 ${uploadTimes['vip'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-yellow-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['vip'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Star className="w-6 h-6 text-yellow-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['vip'] ? 'text-emerald-400' : ''}`}>VIP & Sadakat Misafir Listeleri</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Özel hizmet alması gereken Repeat Guest veya VIP misafirlerin odaya giriş kuralları (Meyve sepeti, Şarap vs).</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['vip'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['vip'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-yellow-400'}`} />
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['vip'] ? 'text-emerald-400' : 'text-yellow-400'}`}>{uploadTimes['vip'] ? 'Yeniden Yükle' : 'Tıklayın'}</span> veya sürükleyin</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('vip', e)} />
                        </label>
                        {uploadTimes['vip'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['vip']}</div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

// Temporary internal component for Icon
function UtensilsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}
