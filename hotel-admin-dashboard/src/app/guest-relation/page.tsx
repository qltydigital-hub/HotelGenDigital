'use client';

import React, { useState, useEffect } from 'react';
import {
    Upload, FileText, CheckCircle, AlertCircle, RefreshCw,
    Utensils, Users, MessageSquare, Bell, UserCircle,
    ChevronRight, Calendar, Info
} from 'lucide-react';
import Link from 'next/link';

export default function GuestRelationDashboard() {
    const [hotelName, setHotelName] = useState('Premium Resort & Spa'); // Mock
    const [departmentName, setDepartmentName] = useState('Guest Relations');
    const [file, setFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState<'concept' | 'alacart'>('concept');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'concept' | 'alacart') => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setUploadType(type);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('departmentId', 'guest-relation');
        formData.append('title', uploadType === 'concept' ? 'Konsept Değişikliği' : 'Alakart Servis Bilgisi');

        try {
            const response = await fetch('/api/knowledge/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            setStatus('success');
            setMessage(data.message);
            setFile(null);
        } catch (error: any) {
            setStatus('error');
            setMessage(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-blue-50">
            {/* Header */}
            <header className="h-[80px] bg-slate-900 border-b border-blue-900 px-8 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-4">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                        <Users className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">{hotelName}</h1>
                        <p className="text-xs text-blue-400 font-extrabold tracking-widest uppercase">{departmentName} PANELİ</p>
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="hidden md:flex flex-col text-right">
                        <span className="text-sm font-bold text-white">Guest Relation Yetkilisi</span>
                        <span className="text-[10px] text-emerald-400 font-black uppercase">Çevrimiçi</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border border-blue-400">
                        <UserCircle className="w-8 h-8 text-white" />
                    </div>
                </div>
            </header>

            <main className="p-8 max-w-7xl mx-auto space-y-8">
                {/* Hero / Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 border-l-4 border-blue-500 bg-slate-800/50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg"><Calendar className="text-blue-400" /></div>
                            <span className="text-[10px] font-black bg-blue-500/10 text-blue-300 px-2 py-1 rounded">BUGÜN</span>
                        </div>
                        <h3 className="text-blue-100 text-sm font-bold uppercase mb-1">Alakart Rezervasyonları</h3>
                        <p className="text-3xl font-black text-white">42</p>
                    </div>
                    <div className="glass-card p-6 border-l-4 border-emerald-500 bg-slate-800/50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-500/20 rounded-lg"><Info className="text-emerald-400" /></div>
                            <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded">AKTİF</span>
                        </div>
                        <h3 className="text-blue-100 text-sm font-bold uppercase mb-1">Bilgi Bankası Dokümanları</h3>
                        <p className="text-3xl font-black text-white">12</p>
                    </div>
                    <div className="glass-card p-6 border-l-4 border-cyan-500 bg-slate-800/50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg"><MessageSquare className="text-cyan-400" /></div>
                        </div>
                        <h3 className="text-blue-100 text-sm font-bold uppercase mb-1">AI Cevap Başarısı</h3>
                        <p className="text-3xl font-black text-white">%98</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Concept Upload Section */}
                    <div className="glass-card p-8 bg-slate-900/50 border border-blue-900/50">
                        <div className="flex items-center space-x-3 mb-6">
                            <FileText className="text-blue-400 w-8 h-8" />
                            <h2 className="text-2xl font-black text-white">Konsept Güncelleme</h2>
                        </div>
                        <p className="text-sm text-blue-200 mb-6">
                            Otel genelindeki konsept değişikliklerini (Hizmet saatleri, yeni kurallar, genel bilgiler) PDF veya Word olarak buraya yükleyin.
                            AI bu bilgilere göre misafirleri otomatik bilgilendirecektir.
                        </p>
                        <div
                            onClick={() => document.getElementById('concept-input')?.click()}
                            className="w-full h-48 border-2 border-dashed border-blue-900 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-900/20 hover:border-blue-500 transition-all group"
                        >
                            <Upload className="w-10 h-10 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-blue-100">Konsept PDF Dosyası Yükle</p>
                            <p className="text-xs text-blue-400 mt-2">Sürükle bırak veya tıkla</p>
                            <input id="concept-input" type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, 'concept')} />
                        </div>
                    </div>

                    {/* Alacart Management Section */}
                    <div className="glass-card p-8 bg-slate-900/50 border border-emerald-900/50">
                        <div className="flex items-center space-x-3 mb-6">
                            <Utensils className="text-emerald-400 w-8 h-8" />
                            <h2 className="text-2xl font-black text-white">Alakart Yönetimi</h2>
                        </div>
                        <p className="text-sm text-blue-200 mb-6">
                            Alakart restoranların menülerini, rezervasyon kurallarını veya özel gün duyurularını yükleyin.
                            Misafirler "Alakartta ne var?" dediğinde sistem buradan cevap verecektir.
                        </p>
                        <div
                            onClick={() => document.getElementById('alacart-input')?.click()}
                            className="w-full h-48 border-2 border-dashed border-emerald-900 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-900/20 hover:border-emerald-500 transition-all group"
                        >
                            <Upload className="w-10 h-10 text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                            <p className="text-sm font-bold text-blue-100">Alakart Bilgi Dosyası Yükle</p>
                            <p className="text-xs text-emerald-400 mt-2">Sürükle bırak veya tıkla</p>
                            <input id="alacart-input" type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, 'alacart')} />
                        </div>
                    </div>
                </div>

                {/* Upload Status Overlay */}
                {file && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-blue-900 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 fill-mode-forwards">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white">Dosya Yükleme</h3>
                                <button onClick={() => setFile(null)} className="text-blue-400 hover:text-white">Kapat</button>
                            </div>

                            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-800 mb-6 flex items-center">
                                <FileText className="text-blue-400 mr-4 shrink-0" />
                                <div className="truncate">
                                    <p className="text-sm font-bold text-white truncate">{file.name}</p>
                                    <p className="text-xs text-blue-400">{(file.size / 1024).toFixed(1)} KB • {uploadType === 'concept' ? 'Konsept' : 'Alakart'}</p>
                                </div>
                            </div>

                            {status === 'idle' && (
                                <button
                                    onClick={handleUpload}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition-all"
                                >
                                    Sisteme Yükle ve AI'ya Öğret
                                </button>
                            )}

                            {status === 'uploading' && (
                                <div className="text-center py-4">
                                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                                    <p className="text-blue-100 font-bold">Doküman İşleniyor...</p>
                                    <p className="text-xs text-blue-400 mt-1">AI Bilgi Bankası güncelleniyor.</p>
                                </div>
                            )}

                            {status === 'success' && (
                                <div className="text-center py-4">
                                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                                    <p className="text-emerald-400 font-black text-lg">Başarıyla Yüklendi!</p>
                                    <p className="text-sm text-blue-200 mt-2">{message}</p>
                                    <button onClick={() => setFile(null)} className="mt-6 w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Kapat</button>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="text-center py-4">
                                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-red-400 font-black text-lg">Hata Oluştu</p>
                                    <p className="text-sm text-blue-200 mt-2">{message}</p>
                                    <button onClick={() => setStatus('idle')} className="mt-6 w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Tekrar Dene</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
