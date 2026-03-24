"use client";
import React, { useState, useEffect } from 'react';
import { Settings, FileText, UploadCloud, Utensils, Coffee, Clock, LogOut, CheckSquare, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { uploadDocumentToSupabase, supabase } from '../../../lib/supabase-client';

export default function FandBSettings() {
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});
    const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({});
    const [minibarNote, setMinibarNote] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        // Load AI Settings Note
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if(data.success && data.data && data.data.minibar_note) {
                    setMinibarNote(data.data.minibar_note);
                }
            })
            .catch(err => console.error("Ayar çekilemedi", err));

        const loadUploadTimes = async () => {
            try {
                const { data, error } = await supabase
                    .from('hotel_documents')
                    .select('doc_type, created_at')
                    .eq('department', 'FB')
                    .order('created_at', { ascending: false });
                    
                if (data && !error) {
                    const times: Record<string, string> = {};
                    for (const doc of data) {
                        if (!times[doc.doc_type]) {
                            const d = new Date(doc.created_at);
                            times[doc.doc_type] = `${d.toLocaleDateString('tr-TR')} - ${d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
                        }
                    }
                    setUploadTimes(times);
                }
            } catch(e) { console.warn("Doküman tarihleri yüklenemedi", e); }
        };
        loadUploadTimes();
    }, []);

    const saveMinibarNote = async () => {
        setIsSavingNote(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minibar_note: minibarNote })
            });
            const data = await res.json();
            if(data.success) {
                alert("Yapay zeka için minibar kuralları başarıyla kaydedildi!");
            } else {
                alert("Veritabanı (Supabase) 'minibar_note' sütunu bulunamadı hatası: " + data.error);
            }
        } catch (error) {
            alert("Bağlantı hatası.");
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleGenericUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setIsUploadingObj(prev => ({ ...prev, [key]: true }));

            const result = await uploadDocumentToSupabase(file, 'FB', key);

            if (result.success) {
                const now = new Date();
                const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}`;
                setUploadTimes(prev => ({ ...prev, [key]: timeString }));
            } else {
                alert(`Dosya yüklenirken hata oluştu: ${result.error}`);
            }
            setIsUploadingObj(prev => ({ ...prev, [key]: false }));
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
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['menus'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-orange-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['menus'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <FileText className="w-6 h-6 text-orange-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['menus'] ? 'text-emerald-400' : ''}`}>A'la Carte & Bar Menüleri Ekler</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Tüm restoran ve barlardaki menüleri, içerikleri ve alerjen bilgilerini güncelleyin.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['menus'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['menus'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['menus'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-orange-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['menus'] ? 'text-emerald-400' : 'text-orange-400'}`}>{isUploadingObj['menus'] ? 'Yükleniyor...' : (uploadTimes['menus'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['menus'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('menus', e)} disabled={isUploadingObj['menus']} />
                        </label>
                        {uploadTimes['menus'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['menus']}</div>
                        )}
                    </div>

                    {/* Çalışma Saatleri & Konsept */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['hours'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-yellow-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['hours'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Clock className="w-6 h-6 text-yellow-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['hours'] ? 'text-emerald-400' : ''}`}>Çalışma Saatleri & Kurallar</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Restoran açılış-kapanış saatlerini, Dress Code kurallarını asistan için sabitleyin.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['hours'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['hours'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['hours'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-yellow-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['hours'] ? 'text-emerald-400' : 'text-yellow-400'}`}>{isUploadingObj['hours'] ? 'Yükleniyor...' : (uploadTimes['hours'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['hours'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('hours', e)} disabled={isUploadingObj['hours']} />
                        </label>
                        {uploadTimes['hours'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['hours']}</div>
                        )}
                    </div>

                    {/* Özel Yemekler ve Mini Bar */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all md:col-span-2 ${uploadTimes['roomservice'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-emerald-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['roomservice'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Coffee className="w-6 h-6 text-emerald-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['roomservice'] ? 'text-emerald-400' : ''}`}>Room Service & Minibar Listesi</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Oda servisi içerikleri, ekstra F/B talepleri veya minibar dolum periyotları/fiyatları.</p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['roomservice'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['roomservice'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['roomservice'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['roomservice'] ? 'text-emerald-400' : 'text-emerald-400'}`}>{isUploadingObj['roomservice'] ? 'Yükleniyor...' : (uploadTimes['roomservice'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['roomservice'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('roomservice', e)} disabled={isUploadingObj['roomservice']} />
                        </label>
                        {uploadTimes['roomservice'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['roomservice']}</div>
                        )}
                        
                        {/* YAPAY ZEKA MİNİBAR NOTU ALANI */}
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <h3 className="text-sm font-bold text-emerald-300 mb-2">🤖 Yapay Zeka Minibar / Oda Servisi Yanıt Kuralı</h3>
                            <p className="text-xs text-slate-400 mb-3">Müşteriler minibar, ücretsiz su veya oda servisi içeriğini sorduğunda yapay zekanın <b>ekstra maliyetler ve kurallar hakkında</b> vereceği doğrudan bilgiyi buraya giriniz.</p>
                            <textarea
                                value={minibarNote}
                                onChange={(e) => setMinibarNote(e.target.value)}
                                placeholder="Örn: İlk dolum ücretsizdir (Kola ve Sular hariç). 2. dolum talep edilirse ücretlidir..."
                                className="w-full h-24 bg-slate-900 border border-slate-700 text-white text-sm rounded-xl p-3 mb-3 focus:outline-none focus:border-emerald-500"
                            ></textarea>
                            <button 
                                onClick={saveMinibarNote}
                                disabled={isSavingNote}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 w-full justify-center"
                            >
                                {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                {isSavingNote ? 'Kaydediliyor...' : 'Yapay Zeka Kuralını Kaydet'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
