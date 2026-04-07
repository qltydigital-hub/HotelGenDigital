"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Settings, FileText, UploadCloud, FileSpreadsheet, Banknote, ShieldCheck, Sun, LogOut, FileSearch, CheckSquare, Square, Send, MessageCircle, Map as MapIcon, Bot, Loader2, Trash2, Edit2, ExternalLink, AlertTriangle, Save, Filter } from 'lucide-react';
import Link from 'next/link';
import { uploadDocumentToSupabase, supabase } from '../../../lib/supabase-client';

// Mock Data Type
type InhouseGuest = {
    id: string;
    voucher: string;
    agency: string;
    room: string;
    fullName: string;
    adults: number;
    children: number;
    childAges: string;
    checkIn: string;
    checkOut: string;
    selected: boolean;
};

// Fake guests removed, now we fill dynamically from Excel upload limit 5 for preview!

export default function FrontOfficeSettings() {
    const [guests, setGuests] = useState<InhouseGuest[]>([]);
    const [isUploaded, setIsUploaded] = useState(false);
    const [isGuestListOpen, setIsGuestListOpen] = useState(false);
    const [inhouseFile, setInhouseFile] = useState<File | null>(null);
    const [messageSent, setMessageSent] = useState(false);
    const [messageTime, setMessageTime] = useState<string | null>(null);
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});
    
    // Filtreleme State'leri
    const [filterCheckOutStart, setFilterCheckOutStart] = useState("");
    const [filterCheckOutEnd, setFilterCheckOutEnd] = useState("");
    
    // AI Welcome Settings States
    const [offerMap, setOfferMap] = useState(true);
    const [remind247, setRemind247] = useState(true);
    const [offerInfo, setOfferInfo] = useState(true);
    const [konseptTipi, setKonseptTipi] = useState("Oda Kahvaltı (BB)");
    
    // Eskalasyon Değişkenleri
    const [escalationEmail, setEscalationEmail] = useState("");
    const [escalationTelegram, setEscalationTelegram] = useState("");
    const [isSavingEscalation, setIsSavingEscalation] = useState(false);

    // IBAN Settings States
    const [ibanText, setIbanText] = useState("");
    const [isIbanTextActive, setIsIbanTextActive] = useState(true);
    const [isIbanImageActive, setIsIbanImageActive] = useState(true);
    const [isIbanExcelActive, setIsIbanExcelActive] = useState(true);

    // State to show generic save success
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [savedAllMessage, setSavedAllMessage] = useState(false);

    // Ayarları API'den (Veritabanından) Çek
    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if(data.success && data.data) {
                    const db = data.data;
                    if(db.escalation_email !== undefined) setEscalationEmail(db.escalation_email);
                    if(db.escalation_telegram_id !== undefined) setEscalationTelegram(db.escalation_telegram_id);
                    
                    if(db.offerMap !== undefined) setOfferMap(db.offerMap);
                    if(db.remind247 !== undefined) setRemind247(db.remind247);
                    if(db.offerInfo !== undefined) setOfferInfo(db.offerInfo);
                    if(db.konseptTipi !== undefined) setKonseptTipi(db.konseptTipi);

                    if(db.ibanText !== undefined) setIbanText(db.ibanText);
                    if(db.isIbanTextActive !== undefined) setIsIbanTextActive(db.isIbanTextActive);
                    if(db.isIbanImageActive !== undefined) setIsIbanImageActive(db.isIbanImageActive);
                    if(db.isIbanExcelActive !== undefined) setIsIbanExcelActive(db.isIbanExcelActive);
                }
            })
            .catch(err => console.error("Ayarlar çekilemedi:", err));

        // DB'den Inhouse Misafirleri Çek
        const loadGuestsFromDB = async () => {
            try {
                const res = await fetch('/api/get-inhouse', { cache: 'no-store' });
                const json = await res.json();
                
                if (json.success && json.data && json.data.length > 0) {
                    const mappedData = json.data.map((d: any, idx: number) => ({
                        id: String(idx),
                        voucher: 'APP-SYS',
                        agency: 'Bilinmiyor',
                        room: d.room_number,
                        fullName: `${d.first_name} ${d.last_name}`,
                        adults: d.guest_count || 2, // Backend'de eklenmemişse default 2
                        children: 0,
                        childAges: '-',
                        checkIn: d.checkin_date || '-',
                        checkOut: d.checkout_date || '-',
                        selected: true
                    }));
                    setGuests(mappedData);
                    setIsUploaded(true); // Veri varsa menü aktif görünsün
                }
            } catch(e) { console.error("Misafirler yüklenemedi", e); }
        };
        loadGuestsFromDB();

        // DB'den departmana ait son doküman yükleme tarihlerini (created_at) getir (En YENİLER)
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
    }, []);

    const saveAllSettings = async () => {
        setIsSavingAll(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerMap, remind247, offerInfo, konseptTipi,
                    ibanText, isIbanTextActive, isIbanImageActive, isIbanExcelActive,
                    escalation_email: escalationEmail,
                    escalation_telegram_id: escalationTelegram
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

    // UI Togglers
    const handleToggleMap = () => setOfferMap(!offerMap);
    const handleToggleRemind = () => setRemind247(!remind247);
    const handleToggleInfo = () => setOfferInfo(!offerInfo);
    const handleKonseptTipiChange = (e: React.ChangeEvent<HTMLSelectElement>) => setKonseptTipi(e.target.value);
    
    const toggleIbanTextActive = () => setIsIbanTextActive(!isIbanTextActive);
    const toggleIbanImageActive = () => setIsIbanImageActive(!isIbanImageActive);
    const toggleIbanExcelActive = () => setIsIbanExcelActive(!isIbanExcelActive);

    // Agencies State
    const [agencies, setAgencies] = useState<any[]>([]);
    const [isAgenciesLoading, setIsAgenciesLoading] = useState(true);
    const [highlightedAgency, setHighlightedAgency] = useState<string | null>(null);

    const triggerHighlight = (id: string) => {
        setHighlightedAgency(id);
        setTimeout(() => setHighlightedAgency(null), 3000);
    };

    const loadAgencies = async () => {
        try {
            const res = await fetch('/api/agencies');
            const data = await res.json();
            if (data.success) {
                setAgencies(data.data);
            }
        } catch (error) {
            console.error("Acentalar yüklenemedi", error);
        } finally {
            setIsAgenciesLoading(false);
        }
    };

    useEffect(() => {
        loadAgencies();
    }, []);

    const handleDeleteAgency = async (id: string) => {
        if (!confirm('Bu acentayı silmek istediğinize emin misiniz?')) return;
        try {
            const res = await fetch(`/api/agencies?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setAgencies(agencies.filter(a => a.id !== id));
            }
        } catch (error) {
            console.error("Acenta silinemedi", error);
        }
    };

    const handleAddAgency = async () => {
        const name = prompt('Acenta Adı (Örn: Jolly Tour):');
        if (!name) return;
        const url = prompt('Acenta Rez. Linki (Örn: https://jolly.com):');
        if (!url) return;
        
        // Basitleştirilmiş UX: Fiyat ve Tür gizli olarak default atanır
        const price_text = 'Bilgi Yok';
        const is_direct = false;

        try {
            const res = await fetch('/api/agencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, price_text, is_direct })
            });
            const data = await res.json();
            if (data.success) {
                setAgencies([...agencies, data.data]);
                triggerHighlight(data.data.id);
            } else {
                alert('Acenta eklenirken hata: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Acenta eklenemedi.');
        }
    };

    const handleEditAgency = async (agency: any) => {
        const name = prompt('Acenta Adı:', agency.name);
        if (!name) return;
        const url = prompt('Acenta Rez. Linki:', agency.url);
        if (!url) return;
        
        // Mevcut görünmez değerleri koru
        const price_text = agency.price_text;
        const is_direct = agency.is_direct;

        try {
            const res = await fetch('/api/agencies', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: agency.id, name, url, price_text, is_direct })
            });
            const data = await res.json();
            if (data.success) {
                setAgencies(agencies.map(a => a.id === agency.id ? data.data : a));
                triggerHighlight(agency.id);
            } else {
                alert('Acenta güncellenirken hata: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Acenta güncellenemedi.');
        }
    };

    // Toggle selection for a single guest
    const toggleGuest = (id: string) => {
        setGuests(guests.map(g => g.id === id ? { ...g, selected: !g.selected } : g));
    };

    // Computed property for filtered guests
    const displayedGuests = useMemo(() => {
        return guests.filter(g => {
            if (!filterCheckOutStart && !filterCheckOutEnd) return true;
            
            // Expected format checkOut: YYYY-MM-DD
            const outDateStr = g.checkOut;
            if (!outDateStr || outDateStr === '-') return false;

            // Single day exact match filtering
            if (filterCheckOutStart && !filterCheckOutEnd) {
                return outDateStr === filterCheckOutStart;
            }

            // Date Range filtering
            const outDate = new Date(outDateStr);
            if (isNaN(outDate.getTime())) return false;

            const start = filterCheckOutStart ? new Date(filterCheckOutStart) : new Date(0);
            const end = filterCheckOutEnd ? new Date(filterCheckOutEnd) : new Date(8640000000000000);
            
            return outDate >= start && outDate <= end;
        });
    }, [guests, filterCheckOutStart, filterCheckOutEnd]);

    // Toggle all guests within the current filter view
    const toggleAll = () => {
        const allSelected = displayedGuests.every(g => g.selected);
        const displayedIds = displayedGuests.map(g => g.id);
        
        setGuests(prevGuests => prevGuests.map(g => 
            displayedIds.includes(g.id) ? { ...g, selected: !allSelected } : g
        ));
    };

    const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({});

    // Dosya Seçimi
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setInhouseFile(e.target.files[0]);
        }
    };

    // Full Excel parsing to Supabase (Kaydet Butonu)
    const handleFileSave = async () => {
        if (!inhouseFile) return;
        
        setIsUploadingObj(prev => ({ ...prev, 'inhouse': true }));

        // 1. Storage'a Yedekle
        await uploadDocumentToSupabase(inhouseFile, 'FO', 'inhouse');

        // 2. Excel dosyasını API'ye gönderip veritabanına yaz
        const formData = new FormData();
        formData.append('file', inhouseFile);

        try {
            const res = await fetch('/api/upload-inhouse', {
                method: 'POST',
                body: formData
            });
            
            const result = await res.json();

            if (result.success && result.data) {
                setIsUploaded(true);
                
                // UI'de göstermek için tamamını formatla
                const previewData = result.data.map((d: any, idx: number) => ({
                    id: String(idx),
                    voucher: 'APP-SYS',
                    agency: 'Bilinmiyor',
                    room: d.room_number,
                    fullName: `${d.first_name} ${d.last_name}`,
                    adults: d.guest_count || 2, // Default 2 if not present
                    children: 0,
                    childAges: '-',
                    checkIn: d.checkin_date || '-',
                    checkOut: d.checkout_date || '-',
                    selected: true
                }));

                setGuests(previewData);
                setIsGuestListOpen(true); // Yükler yüklemez listeyi açık göster
                
                const now = new Date();
                const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`;
                setUploadTimes(prev => ({ ...prev, 'inhouse': timeString }));
                setInhouseFile(null); // Reset selection
                
                alert(`✅ Mükemmel! ${result.data.length} misafir veritabanına başarıyla eklendi! Yapay Zeka artık bu güncel listeyi (in_house_guests) kullanarak doğrulama yapacak.`);
            } else {
                alert(`🚨 Yükleme Hatası: ${result.error}`);
            }
        } catch (error) {
            alert("Bağlantı hatası oluştu, dosya gönderilemedi.");
        }

        setIsUploadingObj(prev => ({ ...prev, 'inhouse': false }));
    };

    const handleGenericUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setIsUploadingObj(prev => ({ ...prev, [key]: true }));
            
            // F/O departmanı altındaki genel dökümanları yükle
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

    const handleSendMessage = () => {
        setMessageSent(true);
        const now = new Date();
        setMessageTime(`${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`);
        setTimeout(() => setMessageSent(false), 4000);
    };

    const selectedCount = displayedGuests.filter(g => g.selected).length;

    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-6 md:p-10 font-sans pb-20">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30">
                            <Settings className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">Önbüro (F/O) Paneli</h1>
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">Önbüro departmanına ait inhouse listesi ve genel belge yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <button onClick={saveAllSettings} disabled={isSavingAll} className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-sm">
                            {isSavingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                            {isSavingAll ? 'KAYDEDİLİYOR...' : 'TÜM AYARLARI KAYDET'}
                        </button>
                        {savedAllMessage && (
                            <span className="hidden md:flex items-center gap-2 text-sm font-bold text-emerald-400 bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-500/30 animate-pulse">
                                Kaydedildi
                            </span>
                        )}
                        <Link href="/settings" className="w-full sm:w-auto px-4 py-3 bg-slate-800/80 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-slate-300 hover:text-white text-sm flex items-center justify-center gap-2">
                            ← Ayarlara Dön
                        </Link>
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                {/* --- NEW FEATURE: INHOUSE LIST EXCEL/PDF UPLOAD & FILTERING --- */}
                    <div className={`bg-slate-900/50 border rounded-3xl p-6 relative overflow-hidden group transition-all ${isUploaded ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-800 hover:border-blue-500/30'}`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                            <div className="flex items-center gap-4">
                                {isUploaded ? <CheckSquare className="w-7 h-7 text-emerald-400" /> : <FileSearch className="w-7 h-7 text-blue-400" />}
                                <div>
                                    <h2 className={`text-2xl font-bold ${isUploaded ? 'text-emerald-400' : ''}`}>Günlük Inhouse Listesi Yükle (Akıllı Filtreleme)</h2>
                                    <p className="text-slate-400 text-sm mt-1">Sisteme detaylı Inhouse listesi yüklense dahi KVKK ve güvenlik gereği <strong>sadece; Oda Numarası, İsim Soyisim, Kişi Sayısı ve Giriş-Çıkış Tarihi</strong> alınıyor. İlgili personelin bunu bilmesi yeterlidir.</p>
                                </div>
                            </div>
                        
                        
                            <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
                                <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                                    <label 
                                        className={`group relative flex items-center justify-center w-full md:w-auto px-8 py-3.5 rounded-2xl cursor-pointer font-extrabold transition-all duration-300 overflow-hidden ${
                                            inhouseFile 
                                            ? 'bg-gradient-to-r from-blue-900/40 to-indigo-900/20 border border-blue-400/50 text-blue-100 shadow-[0_0_25px_rgba(59,130,246,0.2)]' 
                                            : 'bg-slate-900/50 hover:bg-slate-800/80 border-2 border-dashed border-blue-500/40 hover:border-blue-400 text-blue-300 shadow-md'
                                        }`}
                                    >
                                        <div className={`absolute inset-0 bg-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${inhouseFile ? 'hidden' : ''}`} />
                                        <FileSpreadsheet className={`w-6 h-6 mr-3 transition-transform duration-300 ${inhouseFile ? 'text-blue-300' : 'group-hover:scale-110'}`} />
                                        <span className="relative z-10">{inhouseFile ? inhouseFile.name : 'Dosya Seç (Excel)'}</span>
                                        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} disabled={isUploadingObj['inhouse']} />
                                    </label>

                                    <button 
                                        onClick={handleFileSave}
                                        disabled={!inhouseFile || isUploadingObj['inhouse']}
                                        className={`relative flex items-center justify-center w-full md:w-auto px-10 py-3.5 rounded-2xl font-extrabold tracking-wide transition-all duration-300 overflow-hidden group ${
                                            !inhouseFile || isUploadingObj['inhouse'] 
                                            ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-300/50'
                                        }`}
                                    >
                                        {inhouseFile && !isUploadingObj['inhouse'] && (
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl" />
                                        )}
                                        {isUploadingObj['inhouse'] ? (
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin text-slate-400" />
                                        ) : (
                                            <UploadCloud className={`w-5 h-5 mr-3 ${!inhouseFile ? 'text-slate-500' : 'text-slate-900 group-hover:-translate-y-1 transition-transform duration-300'}`} />
                                        )}
                                        <span className="relative z-10">{isUploadingObj['inhouse'] ? 'KAYDEDİLİYOR...' : 'KAYIT ET'}</span>
                                    </button>
                                </div>

                                {uploadTimes['inhouse'] && (
                                    <span className="text-xs text-emerald-400 font-medium bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/20">Son kayıt: {uploadTimes['inhouse']}</span>
                                )}
                            </div>
                        </div>

                        {/* Akordiyon Tetikleyici (Mevcut Yüklenmiş Listeyi Göster) */}
                        {isUploaded && guests.length > 0 && (
                            <div className="pt-4 border-t border-slate-800/50 flex justify-center">
                                <button 
                                    onClick={() => setIsGuestListOpen(!isGuestListOpen)}
                                    className="flex items-center gap-2 px-8 py-2 rounded-full cursor-pointer font-bold transition-all bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500"
                                >
                                    {isGuestListOpen ? 'Yüklenen Listeyi Gizle ⬆' : `Son Yüklenen Listeyi Görüntüle (${guests.length} Kayıt) ⬇`}
                                </button>
                            </div>
                        )}

                        {isGuestListOpen && isUploaded && (
                            <div className="mt-8 animate-in slide-in-from-top-4 fade-in duration-300">
                                
                                {/* FILTER UI */}
                                <div className="flex flex-col xl:flex-row items-center gap-4 mb-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-5 h-5 text-blue-400" />
                                        <span className="font-bold text-slate-300 text-sm whitespace-nowrap">Çıkış Filtre:</span>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                        {/* Hızlı Butonlar */}
                                        <button 
                                            onClick={() => {
                                                const today = new Date();
                                                const str = today.toISOString().split('T')[0];
                                                setFilterCheckOutStart(str); setFilterCheckOutEnd("");
                                            }}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/60 border border-indigo-500/30 transition-all whitespace-nowrap"
                                        >
                                            Bugün
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const tomorrow = new Date(); 
                                                tomorrow.setDate(tomorrow.getDate()+1);
                                                const str = tomorrow.toISOString().split('T')[0];
                                                setFilterCheckOutStart(str); setFilterCheckOutEnd("");
                                            }}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-800/60 border border-blue-500/30 transition-all whitespace-nowrap"
                                        >
                                            Yarınki Çıkışlar
                                        </button>

                                        {/* Seçilebilir Takvim Inputları */}
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="date" 
                                                value={filterCheckOutStart}
                                                onChange={(e) => setFilterCheckOutStart(e.target.value)}
                                                style={{ colorScheme: 'dark' }}
                                                className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none w-full md:w-auto hover:border-blue-500/50 transition-colors cursor-pointer"
                                                title="Başlangıç (veya Tek Gün)"
                                            />
                                            <span className="text-slate-600 font-bold">-</span>
                                            <input 
                                                type="date" 
                                                value={filterCheckOutEnd}
                                                onChange={(e) => setFilterCheckOutEnd(e.target.value)}
                                                style={{ colorScheme: 'dark' }}
                                                className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none w-full md:w-auto hover:border-blue-500/50 transition-colors cursor-pointer"
                                                title="Bitiş Tarihi (Opsiyonel)"
                                            />
                                        </div>
                                    </div>
                                    
                                    {(filterCheckOutStart || filterCheckOutEnd) && (
                                        <button 
                                            onClick={() => { setFilterCheckOutStart(""); setFilterCheckOutEnd(""); }}
                                            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-2 rounded-lg font-bold transition-colors ml-auto mt-2 xl:mt-0 whitespace-nowrap border border-red-500/20"
                                        >
                                            Filtreyi Temizle
                                        </button>
                                    )}
                                </div>

                                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="text-xs uppercase bg-slate-900/80 text-slate-400 border-b border-slate-800">
                                        <tr>
                                            <th scope="col" className="p-4 cursor-pointer hover:text-white transition-colors" onClick={toggleAll}>
                                                {displayedGuests.length > 0 && displayedGuests.every(g => g.selected) ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
                                            </th>
                                            <th scope="col" className="px-6 py-4">Oda No</th>
                                            <th scope="col" className="px-6 py-4">İsim Soyisim</th>
                                            <th scope="col" className="px-6 py-4">Acenta</th>
                                            <th scope="col" className="px-6 py-4">Voucher</th>
                                            <th scope="col" className="px-6 py-4 text-center">Kişi (Yet/Çoc)</th>
                                            <th scope="col" className="px-6 py-4">Giriş - Çıkış Tarihi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedGuests.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500 font-medium">
                                                    Belirttiğiniz tarihte çıkış yapan misafir bulunamadı.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedGuests.map((guest) => (
                                                <tr key={guest.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${guest.selected ? 'bg-blue-900/10' : ''}`}>
                                                    <td className="p-4 cursor-pointer" onClick={() => toggleGuest(guest.id)}>
                                                        {guest.selected ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5 text-slate-500" />}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-white text-base">{guest.room}</td>
                                                    <td className="px-6 py-4">{guest.fullName}</td>
                                                    <td className="px-6 py-4 text-blue-300">{guest.agency}</td>
                                                    <td className="px-6 py-4 font-mono text-xs">{guest.voucher}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="bg-slate-800 px-2 py-1 rounded-md text-slate-300">{guest.adults} Y</span>
                                                        {guest.children > 0 && (
                                                            <span className="bg-slate-800 px-2 py-1 rounded-md text-slate-300 ml-1" title={`Çocuk Yaşları: ${guest.childAges}`}>{guest.children} Ç</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-emerald-400 font-medium">{guest.checkIn}</span> <span className="text-slate-600 mx-1">/</span> <span className="text-red-400 font-bold">{guest.checkOut}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Toplu Mesaj Gönderim Alanı */}
                            <div className="mt-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><MessageCircle className="w-6 h-6 text-blue-400" /> Çıkış Yapan Misafirlere Otomatik Mesaj</h3>
                                <p className="text-slate-400 text-sm mb-4">
                                    Yukarıda seçili olan <strong className="text-white">{selectedCount}</strong> odaya, WhatsApp/Telegram üzerinden çıkış prosedürü hakkında otomatik mesaj gönderilecektir. Bildirim gitmesini <strong>istemediklerinizi listeden kaldırabilirsiniz (Örn: Geç çıkış hakkı verilenler veya özel misafirler).</strong>
                                </p>
                                
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 font-mono text-sm text-slate-300">
                                    "Değerli misafirimiz, bugün çıkış gününüz. Otel kurallarımız gereği odanızı en geç saat 12:00'da teslim etmeniz gerektiğini hatırlatmak isteriz. Bizi tercih ettiğiniz için teşekkür eder, iyi yolculuklar dileriz!"
                                </div>

                                <button 
                                    onClick={handleSendMessage}
                                    disabled={selectedCount === 0}
                                    className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${selectedCount > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    {messageSent ? (
                                        <>Gönderildi <CheckSquare className="w-5 h-5" /></>
                                    ) : (
                                        <>Seçili {selectedCount} Odaya Çıkış Mesajını Gönder <Send className="w-5 h-5" /></>
                                    )}
                                </button>
                                
                                {messageTime && (
                                    <div className="mt-4 text-sm font-medium text-emerald-400 flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4" /> Son Mesaj Gönderimi: {messageTime}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- NEW FEATURE: AI WELCOME BEHAVIOR SETTINGS --- */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="flex items-center gap-4 mb-6">
                        <Bot className="w-8 h-8 text-purple-400" />
                        <div>
                            <h2 className="text-2xl font-bold">Dijital Asistan (Yapay Zeka) Karşılama Davranışları</h2>
                            <p className="text-slate-400 text-sm mt-1">Misafir sisteme giriş yaptığında asistanın vereceği ilk tepkileri ve sunacağı teklifleri yönetin.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Map Toggle */}
                        <div 
                            onClick={handleToggleMap}
                            className={`flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer ${offerMap ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-white">Otel Krokisi Teklif Et</h3>
                                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${offerMap ? 'bg-purple-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${offerMap ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">"Otelimizin haritasını/krokisini görmek ister misiniz?" şeklinde otomatik teklifte bulunur. (Aşağıdan kroki yüklediğinizden emin olun)</p>
                        </div>

                        {/* 24/7 Toggle */}
                        <div 
                            onClick={handleToggleRemind}
                            className={`flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer ${remind247 ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-white">7/24 Kesintisiz Hizmet Modu</h3>
                                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${remind247 ? 'bg-purple-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${remind247 ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">Misafire "7/24 buradayım, bir sorunuz olursa dilediğiniz zaman yazabilirsiniz" güvenini aşılar.</p>
                        </div>

                        {/* Info Toggle */}
                        <div 
                            onClick={handleToggleInfo}
                            className={`flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer ${offerInfo ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-white">Bölge & Tesis Tanıtımı</h3>
                                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${offerInfo ? 'bg-purple-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${offerInfo ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">"Otelimiz veya bölgemiz hakkında bilgi almak isterseniz, size yardımcı olmaktan memnuniyet duyarım." mesajını iletir.</p>
                        </div>
                    </div>
                </div>

                {/* --- NEW FEATURE: AGENCY LINKS & RESERVATION SETTINGS --- */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center gap-4 mb-6">
                            <Banknote className="w-8 h-8 text-emerald-400" />
                            <div>
                                <h2 className="text-2xl font-bold">Rezervasyon & Acenta Linkleri</h2>
                                <p className="text-slate-400 text-sm mt-1">Yapay zekanın rezervasyon yapmak isteyen kullanıcılara önereceği direkt satış siteleriniz ve acenta sayfalarınız.</p>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-4 w-[120px]">İşlem</th>
                                    <th className="px-6 py-4">Acenta Adı</th>
                                    <th className="px-6 py-4">Acenta Rez. Linki</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {isAgenciesLoading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Acentalar yükleniyor...
                                        </td>
                                    </tr>
                                ) : agencies.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                            Henüz eklenmiş acenta linki bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    agencies.map((agency) => (
                                        <tr key={agency.id} className={`transition-colors duration-500 ${highlightedAgency === agency.id ? 'bg-emerald-900/40' : 'hover:bg-slate-800/20'}`}>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleEditAgency(agency)} className="p-2 bg-blue-900/40 hover:bg-blue-900/80 text-blue-400 rounded-lg transition-colors border border-blue-900/50" title="Link Güncelle">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteAgency(agency.id)} className="p-2 bg-red-900/40 hover:bg-red-900/80 text-red-400 rounded-lg transition-colors border border-red-900/50" title="Sil">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-white">{agency.name}</td>
                                            <td className="px-6 py-4">
                                                <a href={agency.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                                                    <span className="max-w-[200px] md:max-w-[350px] truncate">{agency.url}</span>
                                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    <button onClick={handleAddAgency} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition-all text-white border border-slate-700">
                        + Yeni Acenta Ekle
                    </button>
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed italic">
                        * Yapay zeka, bir rezervasyon isteği algıladığında listelediğiniz mevcut acentaları fiyat bilgileriyle karşılaştırıp, 
                        müşteriye <strong>ilk ve özel olarak "Ana Kaynak (Direkt Web)" adresinden satış yapmayı</strong> önerecektir.
                    </p>
                </div>

                {/* --- NEW FEATURE: IBAN & DIRECT PAYMENT SETTINGS --- */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all mt-8">
                    <div className="flex items-center gap-4 mb-6">
                        <Banknote className="w-8 h-8 text-blue-400" />
                        <div>
                            <h2 className="text-2xl font-bold">Direkt Rezervasyon / Hesap & IBAN Bilgileri</h2>
                            <p className="text-slate-400 text-sm mt-1">Acentalara komisyon ödemek istemeyen misafirlerinize sunulacak olan otel hesap bilgileriniz. Misafir ödeme dekontunu ilettiğinde işlem sonuçlanır ve yetkiliye mail düşer.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Manuel IBAN */}
                        <div className={`p-5 rounded-2xl border-2 transition-all ${isIbanTextActive ? 'bg-slate-950 border-blue-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-white flex items-center gap-2"><Edit2 className="w-4 h-4 text-blue-400"/> Manuel Giriş</h3>
                                <div onClick={toggleIbanTextActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanTextActive ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanTextActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">IBAN, Alıcı Adı ve Banka bilgilerini metin olarak girin.</p>
                            <textarea 
                                disabled={!isIbanTextActive}
                                value={ibanText}
                                onChange={(e) => setIbanText(e.target.value)}
                                placeholder="Örn: TR29 0000 0000 0000 0000 0000 00&#10;Alıcı: My Hotel Turizm A.Ş.&#10;Banka: X Bankası"
                                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 mb-3 h-24 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                            />
                            <button disabled={!isIbanTextActive || isSavingAll} onClick={saveAllSettings} className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                Metni Kaydet
                            </button>
                        </div>

                        {/* Görsel IBAN */}
                        <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${isIbanImageActive ? 'bg-slate-950 border-emerald-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-white flex items-center gap-2"><MapIcon className="w-4 h-4 text-emerald-400"/> Görsel Yükleme</h3>
                                    <div onClick={toggleIbanImageActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanImageActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanImageActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-4 h-8 leading-snug">Cihazdan hazır bir IBAN görsel tasarımı veya QR kod yükleyin. (Sadece JPEG, PNG, WEBP)</p>
                            </div>
                            
                            <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl transition-colors ${!isIbanImageActive ? 'cursor-not-allowed border-slate-700' : uploadTimes['iban_image'] ? 'border-emerald-500/50 hover:bg-emerald-900/20 cursor-pointer' : 'border-slate-700 hover:bg-slate-800/50 cursor-pointer'}`}>
                                {isUploadingObj['iban_image'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['iban_image'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                                <span className={`text-xs font-bold ${uploadTimes['iban_image'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {isUploadingObj['iban_image'] ? 'Yükleniyor...' : (uploadTimes['iban_image'] ? 'Yeniden Yükle' : 'Görsel Yükle')}
                                </span>
                                <input disabled={!isIbanImageActive || isUploadingObj['iban_image']} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleGenericUpload('iban_image', e)} />
                            </label>
                            {uploadTimes['iban_image'] && (
                                <div className="mt-2 text-[10px] font-semibold text-center text-emerald-400">
                                    Tarih: {uploadTimes['iban_image']}
                                </div>
                            )}
                        </div>

                        {/* Excel IBAN */}
                        <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${isIbanExcelActive ? 'bg-slate-950 border-purple-500/50' : 'bg-slate-950 border-slate-800 opacity-70'}`}>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-purple-400"/> Excel Belgesi</h3>
                                    <div onClick={toggleIbanExcelActive} className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex items-center px-1 ${isIbanExcelActive ? 'bg-purple-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isIbanExcelActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mb-4">Farklı bankalara ait hesapların (TL/USD/EUR) yer aldığı PDF/Excel yükleyin.</p>
                            </div>
                            
                            <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl transition-colors ${!isIbanExcelActive ? 'cursor-not-allowed border-slate-700' : uploadTimes['iban_excel'] ? 'border-purple-500/50 hover:bg-purple-900/20 cursor-pointer' : 'border-slate-700 hover:bg-slate-800/50 cursor-pointer'}`}>
                                {isUploadingObj['iban_excel'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['iban_excel'] ? 'text-purple-400' : 'text-slate-500'}`} />}
                                <span className={`text-xs font-bold ${uploadTimes['iban_excel'] ? 'text-purple-400' : 'text-slate-400'}`}>
                                    {isUploadingObj['iban_excel'] ? 'Yükleniyor...' : (uploadTimes['iban_excel'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                                </span>
                                <input disabled={!isIbanExcelActive || isUploadingObj['iban_excel']} type="file" className="hidden" accept=".pdf,.xls,.xlsx" onChange={(e) => handleGenericUpload('iban_excel', e)} />
                            </label>
                            {uploadTimes['iban_excel'] && (
                                <div className="mt-2 text-[10px] font-semibold text-center text-purple-400">
                                    Tarih: {uploadTimes['iban_excel']}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- NEW FEATURE: ESCALATION & HUMAN INTERVENTION --- */}
                <div className="bg-slate-900/50 border border-red-900/50 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-all">
                    <div className="flex items-center gap-4 mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <div>
                            <h2 className="text-2xl font-bold text-red-400">İnsan Müdahalesi (Eskalasyon) Ayarları</h2>
                            <p className="text-slate-400 text-sm mt-1">Kullanıcı mesajında şikayet, öfke vb. kritik kelimeler geçerse yapay zeka devreden çıkarılarak acil bildirim atılır.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Acil Bildirim E-Posta Adresi</label>
                            <input 
                                type="email" 
                                value={escalationEmail}
                                onChange={(e) => setEscalationEmail(e.target.value)}
                                placeholder="ornek@oteladi.com"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-1 focus:ring-red-500 outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-2">Kritik durumlarda şikayet logu ve mesaj özeti bu maile gönderilir.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Acil Bildirim Telegram / WP ID</label>
                            <input 
                                type="text" 
                                value={escalationTelegram}
                                onChange={(e) => setEscalationTelegram(e.target.value)}
                                placeholder="123456789"
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-1 focus:ring-red-500 outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-2">Kritik durumlarda yapay zeka mesaj yerine bu personele anlık Telegram bildirimi atar.</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6">
                        <span className="text-xs text-slate-400 italic bg-red-900/20 px-3 py-1 rounded-lg">Kritik Kelimeler: haram, beni arayın, şikayet, iade, berbat, ara...</span>
                        <button 
                            onClick={saveAllSettings}
                            disabled={isSavingAll}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold transition-all text-white border border-red-500 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSavingAll ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                            {isSavingAll ? 'Kaydediliyor...' : 'Eskalasyon Ayarlarını Kaydet'}
                        </button>
                    </div>
                </div>

                {/* Eski Yükleme Modülleri (Konsept, Fact Sheet vb.) Grid Halinde Altta */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {/* Konsept Yükleme */}
                    {/* Konsept Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['konsept'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['konsept'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <FileText className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['konsept'] ? 'text-emerald-400' : ''}`}>Konsept Dosyası</h2>
                            <p className="text-slate-500 text-xs mb-3">Yaz/Kış sezonu, özel etkinlik konseptleri.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: PDF, Word, Excel</span></p>
                            
                            <select 
                                value={konseptTipi}
                                onChange={handleKonseptTipiChange}
                                className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 mb-4 focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                                <option value="Sadece Oda (RO)">Sadece Oda (RO)</option>
                                <option value="Oda Kahvaltı (BB)">Oda Kahvaltı (BB)</option>
                                <option value="Yarım Pansiyon (HB)">Yarım Pansiyon (HB)</option>
                                <option value="Tam Pansiyon (FB)">Tam Pansiyon (FB)</option>
                                <option value="Her Şey Dahil (AI)">Her Şey Dahil (AI)</option>
                                <option value="Ultra Her Şey Dahil (UAI)">Ultra Her Şey Dahil (UAI)</option>
                            </select>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['konsept'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['konsept'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['konsept'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['konsept'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['konsept'] ? 'Yükleniyor...' : (uploadTimes['konsept'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleGenericUpload('konsept', e)} disabled={isUploadingObj['konsept']} />
                        </label>
                        <div className={`mt-4 text-xs font-semibold text-center p-2 rounded-lg ${uploadTimes['konsept'] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
                            Tarih: {uploadTimes['konsept'] || 'Henüz yüklenmedi'}
                        </div>
                    </div>

                    {/* Fact Sheet Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['factsheet'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['factsheet'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <FileSpreadsheet className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['factsheet'] ? 'text-emerald-400' : ''}`}>Fact Sheet</h2>
                            <p className="text-slate-500 text-xs mb-4">Otel fiziki özellik dökümanı.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: PDF, Word</span></p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['factsheet'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['factsheet'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['factsheet'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['factsheet'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['factsheet'] ? 'Yükleniyor...' : (uploadTimes['factsheet'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => handleGenericUpload('factsheet', e)} disabled={isUploadingObj['factsheet']} />
                        </label>
                        <div className={`mt-4 text-xs font-semibold text-center p-2 rounded-lg ${uploadTimes['factsheet'] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
                            Tarih: {uploadTimes['factsheet'] || 'Henüz yüklenmedi'}
                        </div>
                    </div>

                    {/* Fiyat Listesi Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['prices'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['prices'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <Banknote className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['prices'] ? 'text-emerald-400' : ''}`}>Fiyat Listesi (Konaklama Ücreti)</h2>
                            <p className="text-slate-500 text-xs mb-4">Oda konaklama ve genel ücretlendirmeler.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: Excel, PDF</span></p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['prices'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['prices'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['prices'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['prices'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['prices'] ? 'Yükleniyor...' : (uploadTimes['prices'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" accept=".pdf,.xls,.xlsx" onChange={(e) => handleGenericUpload('prices', e)} disabled={isUploadingObj['prices']} />
                        </label>
                        <div className={`mt-4 text-xs font-semibold text-center p-2 rounded-lg ${uploadTimes['prices'] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
                            Tarih: {uploadTimes['prices'] || 'Henüz yüklenmedi'}
                        </div>
                    </div>

                    {/* Daypass Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['daypass'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['daypass'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <Sun className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['daypass'] ? 'text-emerald-400' : ''}`}>Day-Pass Fiyatları</h2>
                            <p className="text-slate-500 text-xs mb-4">Günübirlik kullanım listesi ve kabul şartları.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: Excel, PDF</span></p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['daypass'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['daypass'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['daypass'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['daypass'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['daypass'] ? 'Yükleniyor...' : (uploadTimes['daypass'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" accept=".pdf,.xls,.xlsx" onChange={(e) => handleGenericUpload('daypass', e)} disabled={isUploadingObj['daypass']} />
                        </label>
                        <div className={`mt-4 text-xs font-semibold text-center p-2 rounded-lg ${uploadTimes['daypass'] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
                            Tarih: {uploadTimes['daypass'] || 'Henüz yüklenmedi'}
                        </div>
                    </div>

                    {/* Hotel Kroki Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['map'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['map'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <MapIcon className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['map'] ? 'text-emerald-400' : ''}`}>Otel Krokisi / Harita</h2>
                            <p className="text-slate-500 text-xs mb-4">Misafirlere otomatik sunulacak olan görsel kroki.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: JPG, PNG, WEBP</span></p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['map'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['map'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['map'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['map'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['map'] ? 'Yükleniyor...' : (uploadTimes['map'] ? 'Yeniden Yükle' : 'Görsel Yükle')}
                            </span>
                            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleGenericUpload('map', e)} disabled={isUploadingObj['map']} />
                        </label>
                        <div className={`mt-4 text-xs font-semibold text-center p-2 rounded-lg ${uploadTimes['map'] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
                            Tarih: {uploadTimes['map'] || 'Henüz yüklenmedi'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
