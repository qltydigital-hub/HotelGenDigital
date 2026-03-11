'use client';

import React, { useState } from 'react';
import {
    Upload, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw,
    UserCircle, Hotel, Bell, Home
} from 'lucide-react';
import Link from 'next/link';

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

export default function ReceptionDashboard() {
    const [hotelName, setHotelName] = useState('Premium Resort & Spa');
    const [departmentName, setDepartmentName] = useState('Resepsiyon');
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/guests/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            setStatus('success');
            setMessage(data.message);
            setFile(null);

            const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

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
                    <div className="bg-sky-600 p-2 rounded-lg shadow-lg shadow-sky-500/20">
                        <Hotel className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">{hotelName}</h1>
                        <p className="text-xs text-sky-400 font-extrabold tracking-widest uppercase">{departmentName} PANELİ</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <Link href="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-blue-200" title="Dashboard">
                        <Home className="w-5 h-5" />
                    </Link>
                    <div className="h-8 w-px bg-blue-900 mx-2"></div>
                    <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center border border-sky-400">
                        <UserCircle className="w-8 h-8 text-white" />
                    </div>
                </div>
            </header>

            <main className="p-8 max-w-4xl mx-auto">
                <div className="glass-card p-10 bg-slate-900/50 border border-sky-900/50 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-600/10 blur-[100px] rounded-full"></div>

                    <div className="flex flex-col items-center text-center relative z-10">
                        <div className="bg-sky-900/30 p-6 rounded-full border border-sky-500/30 mb-6">
                            <FileSpreadsheet className="w-16 h-16 text-sky-400" />
                        </div>

                        <h2 className="text-3xl font-black text-white mb-4">In-House Listesi Güncelleme</h2>
                        <p className="text-blue-200 max-w-lg mb-10 font-medium">
                            Otel sisteminden alacağınız günlük konaklayan listesini buradan yükleyin.
                            Sistem otomatik misafirleri tanıyacak ve AI doğrulaması yapacaktır.
                        </p>

                        <div className="w-full mb-8">
                            <label
                                htmlFor="excel-upload"
                                className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-sky-900 rounded-3xl cursor-pointer hover:bg-sky-900/20 hover:border-sky-500 transition-all group"
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-12 h-12 mb-4 text-sky-500 group-hover:scale-110 transition-transform" />
                                    <p className="mb-2 text-lg text-white font-bold">Excel Dosyasını Buraya Sürükleyin</p>
                                    <p className="text-sm text-sky-400">veya Göz Atmak için Tıklayın</p>
                                </div>
                                <input
                                    id="excel-upload"
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>

                        {file && status === 'idle' && (
                            <div className="w-full bg-sky-900/20 text-sky-200 p-5 rounded-2xl flex items-center justify-between border border-sky-800/50 mb-8 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center truncate">
                                    <FileSpreadsheet className="w-5 h-5 text-sky-400 mr-3" />
                                    <span className="text-sm font-bold truncate">{file.name}</span>
                                </div>
                                <button
                                    onClick={() => setFile(null)}
                                    className="text-sky-400 hover:text-white text-xs font-black uppercase underline ml-4"
                                >
                                    Değiştir
                                </button>
                            </div>
                        )}

                        {status === 'uploading' && (
                            <div className="w-full bg-slate-800/50 p-8 rounded-2xl border border-blue-900 mb-8 flex flex-col items-center">
                                <RefreshCw className="w-10 h-10 text-sky-500 animate-spin mb-4" />
                                <p className="text-sky-100 font-bold">Liste İşleniyor...</p>
                                <p className="text-xs text-sky-400 mt-1">Eski kayıtlar temizleniyor ve yeni misafirler tanımlanıyor.</p>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="w-full bg-emerald-900/20 text-emerald-400 p-6 rounded-2xl flex flex-col items-center gap-3 border border-emerald-800/50 mb-8 animate-in zoom-in-95">
                                <CheckCircle className="w-10 h-10" />
                                <h4 className="text-lg font-black uppercase tracking-tight">{message}</h4>
                                <button onClick={() => setStatus('idle')} className="mt-2 text-xs font-bold underline">Yeni Liste Yükle</button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="w-full bg-red-900/20 text-red-400 p-6 rounded-2xl flex flex-col items-center gap-3 border border-red-800/50 mb-8 animate-in zoom-in-95">
                                <AlertCircle className="w-10 h-10" />
                                <h4 className="text-lg font-black">{message}</h4>
                                <button onClick={() => setStatus('idle')} className="mt-2 text-xs font-bold underline">Tekrar Dene</button>
                            </div>
                        )}

                        {status === 'idle' && (
                            <button
                                onClick={handleUpload}
                                disabled={!file}
                                className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-lg transition-all shadow-xl ${!file
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-900/40'
                                    }`}
                            >
                                <RefreshCw className={`w-6 h-6 ${!file ? 'opacity-30' : ''}`} />
                                SİSTEMİ GÜNCELLE
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/30 p-6 rounded-2xl border border-blue-900/30">
                        <h4 className="text-white font-bold mb-2 flex items-center">
                            <InfoIcon className="w-4 h-4 mr-2 text-sky-400" />
                            İpucu
                        </h4>
                        <p className="text-xs text-blue-300 leading-relaxed">
                            Excel dosyanızda "Oda", "Ad", "Soyad" ve "Çıkış" sütunlarının olması yeterlidir. Sistem otomatik olarak eşleştirme yapacaktır.
                        </p>
                    </div>
                    <div className="bg-slate-900/30 p-6 rounded-2xl border border-blue-900/30">
                        <h4 className="text-white font-bold mb-2 flex items-center">
                            <Bell className="w-4 h-4 mr-2 text-sky-400" />
                            Otomasyon
                        </h4>
                        <p className="text-xs text-blue-300 leading-relaxed">
                            Liste yüklendiği anda AI asistanı yeni gelen misafirlere karşılama mesajı hazırlayabilir veya çıkacak misafirlerle vedalaşabilir.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
