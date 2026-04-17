'use client';

import React, { useState } from 'react';
import {
    Upload, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw,
    UserCircle, Hotel, Bell, Home, Banknote, Edit2, Map as MapIcon, Loader2, UploadCloud, Navigation
} from 'lucide-react';
import Link from 'next/link';
import { uploadDocumentToSupabase, supabase } from '@/lib/supabase-client';

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

export default function ReceptionDashboard() {
    const [hotelName, setHotelName] = useState('The Green Park Gaziantep');
    const [departmentName, setDepartmentName] = useState('Resepsiyon');
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // --- IBAN Settings States ---
    const [ibanText, setIbanText] = useState("");
    const [isIbanTextActive, setIsIbanTextActive] = useState(true);
    const [isIbanImageActive, setIsIbanImageActive] = useState(true);
    const [isIbanExcelActive, setIsIbanExcelActive] = useState(true);
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});
    const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({});

    const [isSavingAll, setIsSavingAll] = useState(false);
    const [savedAllMessage, setSavedAllMessage] = useState(false);

    // --- Location Settings States ---
    const [locationUrl, setLocationUrl] = useState('');
    const [locationDesc, setLocationDesc] = useState('');
    const [isSavingLocation, setIsSavingLocation] = useState(false);
    const [locationSaved, setLocationSaved] = useState(false);

    // Load Global Settings & Document Times
    React.useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if(data.success && data.data) {
                    const db = data.data;
                    if(db.ibanText !== undefined) setIbanText(db.ibanText);
                    if(db.isIbanTextActive !== undefined) setIsIbanTextActive(db.isIbanTextActive);
                    if(db.isIbanImageActive !== undefined) setIsIbanImageActive(db.isIbanImageActive);
                    if(db.isIbanExcelActive !== undefined) setIsIbanExcelActive(db.isIbanExcelActive);
                }
            })
            .catch(err => console.error("Ayarlar çekilemedi:", err));

        const loadUploadTimes = async () => {
            try {
                const { data, error } = await supabase
                    .from('hotel_documents')
                    .select('doc_type, created_at')
                    .eq('department', 'FO')
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

        // Konum ayarlarını Supabase'den yükle
        const loadLocation = async () => {
            try {
                const { data, error } = await supabase
                    .from('hotel_settings')
                    .select('value')
                    .eq('key', 'hotel_location')
                    .single();
                if (!error && data && data.value) {
                    setLocationUrl(data.value.url || '');
                    setLocationDesc(data.value.description || '');
                }
            } catch(e) { console.warn("Konum ayarları yüklenemedi", e); }
        };
        loadLocation();
    }, []);

    const saveAllSettings = async () => {
        setIsSavingAll(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ibanText, isIbanTextActive, isIbanImageActive, isIbanExcelActive
                })
            });
            const data = await res.json();
            if(!data.success) {
                alert("Ayarlar kaydedilirken hata oluştu: " + data.error);
            } else {
                setSavedAllMessage(true);
                setTimeout(() => setSavedAllMessage(false), 3000);
            }
        } catch (error) {
            alert("Bağlantı hatası.");
        } finally {
            setIsSavingAll(false);
        }
    };

    const saveLocation = async () => {
        setIsSavingLocation(true);
        try {
            const { error } = await supabase.from('hotel_settings').upsert({
                key: 'hotel_location',
                value: { url: locationUrl, description: locationDesc },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) throw error;
            setLocationSaved(true);
            setTimeout(() => setLocationSaved(false), 3000);
        } catch (e) {
            alert("Konum kaydedilirken hata oluştu.");
        } finally {
            setIsSavingLocation(false);
        }
    };

    const toggleIbanTextActive = () => setIsIbanTextActive(!isIbanTextActive);
    const toggleIbanImageActive = () => setIsIbanImageActive(!isIbanImageActive);
    const toggleIbanExcelActive = () => setIsIbanExcelActive(!isIbanExcelActive);

    const handleGenericUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setIsUploadingObj(prev => ({ ...prev, [key]: true }));
            
            const result = await uploadDocumentToSupabase(file, 'FO', key);

            if (result.success) {
                const now = new Date();
                const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`;
                setUploadTimes(prev => ({ ...prev, [key]: timeString }));
            } else {
                alert(`Dosya yüklenirken hata oluştu: ${result.error}`);
            }
            setIsUploadingObj(prev => ({ ...prev, [key]: false }));
        }
    };

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

                {/* --- IBAN & DIRECT PAYMENT SETTINGS --- */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all mt-8">
                    <div className="flex items-center gap-4 mb-8">
                        <Banknote className="w-8 h-8 text-blue-400" />
                        <div>
                            <h2 className="text-2xl font-bold">Direkt Rezervasyon / Hotel IBAN Bilgileri</h2>
                            <p className="text-slate-400 text-sm mt-1">Misafirlerinize sunulacak olan otel hesap bilgileriniz. Yapay zeka bu ekranlardaki veriyi baz alarak IBAN iletir.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Manuel IBAN */}
                        <div className={`p-6 rounded-2xl border-2 transition-all ${isIbanTextActive ? 'bg-slate-950 border-blue-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white flex items-center gap-2 text-sm"><Edit2 className="w-4 h-4 text-blue-400"/> Manuel Giriş</h3>
                                <div onClick={toggleIbanTextActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanTextActive ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanTextActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mb-4 h-8 leading-snug">IBAN, Alıcı Adı ve Banka bilgilerini metin olarak girin.</p>
                            <textarea 
                                disabled={!isIbanTextActive}
                                value={ibanText}
                                onChange={(e) => setIbanText(e.target.value)}
                                placeholder="Örn: TR29 0000 0000 0000 0000 0000 00&#10;Alıcı: My Hotel Turizm A.Ş.&#10;Banka: X Bankası"
                                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-3 mb-4 h-28 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                            />
                            <button disabled={!isIbanTextActive || isSavingAll} onClick={saveAllSettings} className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                Metni Kaydet
                            </button>
                        </div>

                        {/* Görsel IBAN */}
                        <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${isIbanImageActive ? 'bg-slate-950 border-emerald-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-white flex items-center gap-2 text-sm"><MapIcon className="w-4 h-4 text-emerald-400"/> Görsel Yükleme</h3>
                                    <div onClick={toggleIbanImageActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanImageActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanImageActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-4 h-8 leading-snug">Cihazdan hazır bir IBAN görsel tasarımı veya QR kod yükleyin. (Sadece JPEG, PNG, WEBP)</p>
                            </div>
                            
                            <label className={`flex flex-col items-center justify-center w-full py-8 border-2 border-dashed rounded-xl transition-colors ${!isIbanImageActive ? 'cursor-not-allowed border-slate-700' : uploadTimes['iban_image'] ? 'border-emerald-500/50 hover:bg-emerald-900/20 cursor-pointer' : 'border-slate-700 hover:bg-slate-800/50 cursor-pointer'}`}>
                                {isUploadingObj['iban_image'] ? <Loader2 className="w-6 h-6 mb-2 text-slate-400 animate-spin" /> : <UploadCloud className={`w-6 h-6 mb-2 ${uploadTimes['iban_image'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                                <span className={`text-sm font-bold ${uploadTimes['iban_image'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {isUploadingObj['iban_image'] ? 'Yükleniyor...' : (uploadTimes['iban_image'] ? 'Yeniden Yükle' : 'Görsel Yükle')}
                                </span>
                                <input disabled={!isIbanImageActive || isUploadingObj['iban_image']} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleGenericUpload('iban_image', e)} />
                            </label>
                            {uploadTimes['iban_image'] && (
                                <div className="mt-3 text-xs font-semibold text-center text-emerald-400">
                                    Tarih: {uploadTimes['iban_image']}
                                </div>
                            )}
                        </div>

                        {/* Excel IBAN */}
                        <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${isIbanExcelActive ? 'bg-slate-950 border-purple-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-white flex items-center gap-2 text-sm"><FileSpreadsheet className="w-4 h-4 text-purple-400"/> Excel Belgesi</h3>
                                    <div onClick={toggleIbanExcelActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanExcelActive ? 'bg-purple-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanExcelActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-4 h-8 leading-snug">Farklı bankalara ait hesapların (TL/USD/EUR) yer aldığı PDF/Excel yükleyin.</p>
                            </div>
                            
                            <label className={`flex flex-col items-center justify-center w-full py-8 border-2 border-dashed rounded-xl transition-colors ${!isIbanExcelActive ? 'cursor-not-allowed border-slate-700' : uploadTimes['iban_excel'] ? 'border-purple-500/50 hover:bg-purple-900/20 cursor-pointer' : 'border-slate-700 hover:bg-slate-800/50 cursor-pointer'}`}>
                                {isUploadingObj['iban_excel'] ? <Loader2 className="w-6 h-6 mb-2 text-slate-400 animate-spin" /> : <UploadCloud className={`w-6 h-6 mb-2 ${uploadTimes['iban_excel'] ? 'text-purple-400' : 'text-slate-500'}`} />}
                                <span className={`text-sm font-bold ${uploadTimes['iban_excel'] ? 'text-purple-400' : 'text-slate-400'}`}>
                                    {isUploadingObj['iban_excel'] ? 'Yükleniyor...' : (uploadTimes['iban_excel'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                                </span>
                                <input disabled={!isIbanExcelActive || isUploadingObj['iban_excel']} type="file" className="hidden" accept=".pdf,.xls,.xlsx" onChange={(e) => handleGenericUpload('iban_excel', e)} />
                            </label>
                            {uploadTimes['iban_excel'] && (
                                <div className="mt-3 text-xs font-semibold text-center text-purple-400">
                                    Tarih: {uploadTimes['iban_excel']}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save All Button */}
                <div className="mt-8 flex justify-end">
                    <button onClick={saveAllSettings} disabled={isSavingAll} className="w-full md:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2">
                        {isSavingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} 
                        {isSavingAll ? 'KAYDEDİLİYOR...' : 'TÜM AYARLARI KAYDET'}
                    </button>
                </div>
                {savedAllMessage && (
                    <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-800 text-emerald-400 rounded-xl text-center font-bold text-sm animate-in fade-in">
                        Ayarlarınız başarıyla veritabanına kaydedildi! Artık her yerde geçerlidir.
                    </div>
                )}

                {/* --- LOCATION & DIRECTIONS SETTINGS --- */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-emerald-500/30 transition-all mt-8">
                    <div className="flex items-center gap-4 mb-8">
                        <Navigation className="w-8 h-8 text-emerald-400" />
                        <div>
                            <h2 className="text-2xl font-bold">Konum ve Yol Tarifi</h2>
                            <p className="text-slate-400 text-sm mt-1">Misafir "Neredesiniz?", "Nasıl gelirim?" diye sorduğunda yapay zeka bu bilgiyi gönderir.</p>
                        </div>
                    </div>

                    <div className="p-5 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-semibold">
                        🗺️ Bu ayarlar Telegram ve WhatsApp botları tarafından anlık olarak kullanılmaktadır. Kaydettiğiniz anda devreye girer.
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">Google Maps / Harita Linki</label>
                            <input
                                type="text"
                                value={locationUrl}
                                onChange={(e) => setLocationUrl(e.target.value)}
                                placeholder="https://maps.app.goo.gl/..."
                                className="w-full bg-slate-950/50 border-2 border-slate-800 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-all font-mono placeholder-slate-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest px-1">Rota ve Rehberlik Açıklaması</label>
                            <textarea
                                value={locationDesc}
                                onChange={(e) => setLocationDesc(e.target.value)}
                                placeholder="Örn: Havalimanından çıktıktan sonra sola dönün, 500m ileride otelin tabelası görünür..."
                                className="w-full bg-slate-950/50 border-2 border-slate-800 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-all font-mono placeholder-slate-700 h-36 resize-none"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={saveLocation}
                            disabled={isSavingLocation}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSavingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            {isSavingLocation ? 'KAYDEDİLİYOR...' : 'KONUMU KAYDET'}
                        </button>
                    </div>
                    {locationSaved && (
                        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-800 text-emerald-400 rounded-xl text-center font-bold text-sm animate-in fade-in">
                            ✅ Konum bilgileri başarıyla güncellendi! Botlar artık yeni adresi kullanıyor.
                        </div>
                    )}
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
