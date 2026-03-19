"use client";
import React, { useState, useEffect } from 'react';
import { Settings, FileText, UploadCloud, FileSpreadsheet, Banknote, ShieldCheck, Sun, LogOut, FileSearch, CheckSquare, Square, Send, MessageCircle, Map as MapIcon, Bot, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { uploadDocumentToSupabase } from '../../../lib/supabase-client';

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

// Generate Mock Data for simulation after upload
const generateMockGuests = (): InhouseGuest[] => [
    { id: '1', voucher: 'VCH-1001', agency: 'Booking.com', room: '101', fullName: 'İrfan Doğan', adults: 2, children: 0, childAges: '-', checkIn: '10.03.2026', checkOut: '15.03.2026', selected: true },
    { id: '2', voucher: 'VCH-1002', agency: 'Expedia', room: '102', fullName: 'Ayşe Yılmaz', adults: 2, children: 1, childAges: '5', checkIn: '08.03.2026', checkOut: '15.03.2026', selected: true },
    { id: '3', voucher: 'VCH-1003', agency: 'Otelz', room: '103', fullName: 'Michael Smith', adults: 1, children: 0, childAges: '-', checkIn: '12.03.2026', checkOut: '15.03.2026', selected: true },
    { id: '4', voucher: 'VCH-1004', agency: 'Direct', room: '104', fullName: 'Fatma Kaya', adults: 2, children: 2, childAges: '3, 7', checkIn: '01.03.2026', checkOut: '15.03.2026', selected: true },
    { id: '5', voucher: 'VCH-1005', agency: 'Jolly Tur', room: '105', fullName: 'Ali Veli', adults: 2, children: 0, childAges: '-', checkIn: '14.03.2026', checkOut: '15.03.2026', selected: true },
];

export default function FrontOfficeSettings() {
    const [guests, setGuests] = useState<InhouseGuest[]>([]);
    const [isUploaded, setIsUploaded] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [messageTime, setMessageTime] = useState<string | null>(null);
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});
    
    // AI Welcome Settings States
    const [offerMap, setOfferMap] = useState(true);
    const [remind247, setRemind247] = useState(true);
    const [offerInfo, setOfferInfo] = useState(true);

    // Agencies State
    const [agencies, setAgencies] = useState<any[]>([]);
    const [isAgenciesLoading, setIsAgenciesLoading] = useState(true);

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
        const name = prompt('Acenta Veya Satış Kanalı Adı (Örn: Jolly Tur):');
        if (!name) return;
        const url = prompt('Acenta Rezervasyon Linki (http ile başlamalı):');
        if (!url) return;
        const price_text = prompt('Tahmini Fiyat Veya Avantaj Metni (Örn: ₺3.000):') || 'Bilgi Yok';
        const is_direct = confirm('Bu sizin DİREKT (Ana Kaynak) web siteniz mi?\n\nEvet ise OK basın, normal acenta ise İptal (Cancel) basın.');

        try {
            const res = await fetch('/api/agencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, price_text, is_direct })
            });
            const data = await res.json();
            if (data.success) {
                setAgencies([...agencies, data.data]);
            } else {
                alert('Acenta eklenirken hata: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Acenta eklenemedi.');
        }
    };

    // Toggle selection for a single guest
    const toggleGuest = (id: string) => {
        setGuests(guests.map(g => g.id === id ? { ...g, selected: !g.selected } : g));
    };

    // Toggle all guests
    const toggleAll = () => {
        const allSelected = guests.every(g => g.selected);
        setGuests(guests.map(g => ({ ...g, selected: !allSelected })));
    };

    const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({});

    // Simulate file upload + real Supabase DB interaction
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setIsUploadingObj(prev => ({ ...prev, 'inhouse': true }));

            // 1. Veritabanına Gerçek Yükleme (F/O Departmanı, 'inhouse' dökümanı)
            const result = await uploadDocumentToSupabase(file, 'FO', 'inhouse');

            if (result.success) {
                setIsUploaded(true);
                setGuests(generateMockGuests());
                
                // Record upload time
                const now = new Date();
                const timeString = `${now.toLocaleDateString('tr-TR')} - ${now.toLocaleTimeString('tr-TR')}`;
                setUploadTimes(prev => ({ ...prev, 'inhouse': timeString }));
            } else {
                alert(`Yükleme hatası: ${result.error}`);
            }
            setIsUploadingObj(prev => ({ ...prev, 'inhouse': false }));
        }
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

    const selectedCount = guests.filter(g => g.selected).length;

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
                                    <p className="text-slate-400 text-sm mt-1">Excel veya PDF yüklediğinizde fiyatlar vb. gizli bilgiler otomatik silinir; sadece iletişim ve konaklama özeti listelenir.</p>
                                </div>
                            </div>
                        
                            <div className="flex flex-col items-center">
                                <label className={`flex items-center px-6 py-3 rounded-xl cursor-pointer font-bold transition-colors ${isUploaded ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {isUploadingObj['inhouse'] ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : (
                                        <UploadCloud className="w-5 h-5 mr-2" />
                                    )}
                                    {isUploadingObj['inhouse'] ? 'Yükleniyor...' : (isUploaded ? 'Listeyi Güncelle' : 'Dosya Yükle')}
                                    <input type="file" className="hidden" accept=".xlsx, .xls, .pdf" onChange={handleFileUpload} disabled={isUploadingObj['inhouse']} />
                                </label>
                                {uploadTimes['inhouse'] && (
                                    <span className="text-xs text-emerald-400 mt-2 font-medium">Son yükleme: {uploadTimes['inhouse']}</span>
                                )}
                            </div>
                    </div>

                    {isUploaded && (
                        <div className="mt-8">
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="text-xs uppercase bg-slate-900/80 text-slate-400 border-b border-slate-800">
                                        <tr>
                                            <th scope="col" className="p-4 cursor-pointer hover:text-white transition-colors" onClick={toggleAll}>
                                                {guests.every(g => g.selected) ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
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
                                        {guests.map((guest) => (
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
                                                    <span className="text-green-400">{guest.checkIn}</span> <span className="text-slate-500 mx-1">/</span> <span className="text-red-400">{guest.checkOut}</span>
                                                </td>
                                            </tr>
                                        ))}
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
                            onClick={() => setOfferMap(!offerMap)}
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
                            onClick={() => setRemind247(!remind247)}
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
                            onClick={() => setOfferInfo(!offerInfo)}
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
                                    <th className="px-6 py-4">Acenta Adı</th>
                                    <th className="px-6 py-4">Rezervasyon Linki</th>
                                    <th className="px-6 py-4">Fiyat / Avantaj Durumu</th>
                                    <th className="px-6 py-4">Tür</th>
                                    <th className="px-6 py-4 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {isAgenciesLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Acentalar yükleniyor...
                                        </td>
                                    </tr>
                                ) : agencies.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                            Henüz eklenmiş acenta linki bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    agencies.map((agency) => (
                                        <tr key={agency.id} className="hover:bg-slate-800/20">
                                            <td className="px-6 py-4 font-bold text-white">{agency.name}</td>
                                            <td className="px-6 py-4 text-blue-400 max-w-[200px] truncate" title={agency.url}>{agency.url}</td>
                                            <td className="px-6 py-4">{agency.price_text}</td>
                                            <td className="px-6 py-4">
                                                {agency.is_direct ? (
                                                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg font-bold">Ana Kaynak</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded-lg">Acenta</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDeleteAgency(agency.id)} className="p-2 bg-red-900/40 hover:bg-red-900/80 text-red-400 rounded-lg transition-colors border border-red-900/50">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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

                {/* Eski Yükleme Modülleri (Konsept, Fact Sheet vb.) Grid Halinde Altta */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {/* Konsept Yükleme */}
                    {/* Konsept Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['konsept'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['konsept'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <FileText className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['konsept'] ? 'text-emerald-400' : ''}`}>Konsept Dosyası</h2>
                            <p className="text-slate-500 text-xs mb-4">Yaz/Kış sezonu, özel etkinlik konseptleri.</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['konsept'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['konsept'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['konsept'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['konsept'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['konsept'] ? 'Yükleniyor...' : (uploadTimes['konsept'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('konsept', e)} disabled={isUploadingObj['konsept']} />
                        </label>
                        {uploadTimes['konsept'] && (
                            <div className="mt-3 text-[10px] text-emerald-400 font-medium">Son Yükleme: <br/>{uploadTimes['konsept']}</div>
                        )}
                    </div>

                    {/* Fact Sheet Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['factsheet'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['factsheet'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <FileSpreadsheet className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['factsheet'] ? 'text-emerald-400' : ''}`}>Fact Sheet</h2>
                            <p className="text-slate-500 text-xs mb-4">Otel fiziki özellik dökümanı.</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['factsheet'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['factsheet'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['factsheet'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['factsheet'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['factsheet'] ? 'Yükleniyor...' : (uploadTimes['factsheet'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('factsheet', e)} disabled={isUploadingObj['factsheet']} />
                        </label>
                        {uploadTimes['factsheet'] && (
                            <div className="mt-3 text-[10px] text-emerald-400 font-medium">Son Yükleme: <br/>{uploadTimes['factsheet']}</div>
                        )}
                    </div>

                    {/* Fiyat Listesi Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['prices'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['prices'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <Banknote className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['prices'] ? 'text-emerald-400' : ''}`}>Fiyat Listesi</h2>
                            <p className="text-slate-500 text-xs mb-4">Önbüro harici hizmet fiyatlandırmaları.</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['prices'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['prices'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['prices'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['prices'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['prices'] ? 'Yükleniyor...' : (uploadTimes['prices'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('prices', e)} disabled={isUploadingObj['prices']} />
                        </label>
                        {uploadTimes['prices'] && (
                            <div className="mt-3 text-[10px] text-emerald-400 font-medium">Son Yükleme: <br/>{uploadTimes['prices']}</div>
                        )}
                    </div>

                    {/* Daypass Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['daypass'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['daypass'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <Sun className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['daypass'] ? 'text-emerald-400' : ''}`}>Day-Pass Fiyatları</h2>
                            <p className="text-slate-500 text-xs mb-4">Günübirlik misafir kabul şartları.</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['daypass'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['daypass'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['daypass'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['daypass'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['daypass'] ? 'Yükleniyor...' : (uploadTimes['daypass'] ? 'Yeniden Yükle' : 'Dosya Yükle')}
                            </span>
                            <input type="file" className="hidden" onChange={(e) => handleGenericUpload('daypass', e)} disabled={isUploadingObj['daypass']} />
                        </label>
                        {uploadTimes['daypass'] && (
                            <div className="mt-3 text-[10px] text-emerald-400 font-medium">Son Yükleme: <br/>{uploadTimes['daypass']}</div>
                        )}
                    </div>

                    {/* Hotel Kroki Yükleme */}
                    <div className={`border rounded-3xl p-6 relative group transition-all flex flex-col justify-between ${uploadTimes['map'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                        <div>
                            {uploadTimes['map'] ? <CheckSquare className="w-6 h-6 text-emerald-400 mb-3" /> : <MapIcon className="w-6 h-6 text-slate-400 mb-3" />}
                            <h2 className={`text-lg font-bold mb-2 ${uploadTimes['map'] ? 'text-emerald-400' : ''}`}>Otel Krokisi / Harita</h2>
                            <p className="text-slate-500 text-xs mb-4">Misafirlere otomatik sunulacak olan görsel kroki. (JPG, PNG)</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadTimes['map'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 hover:bg-slate-800/50'}`}>
                            {isUploadingObj['map'] ? <Loader2 className="w-5 h-5 mb-1 text-slate-400 animate-spin" /> : <UploadCloud className={`w-5 h-5 mb-1 ${uploadTimes['map'] ? 'text-emerald-400' : 'text-slate-500'}`} />}
                            <span className={`text-xs font-bold ${uploadTimes['map'] ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isUploadingObj['map'] ? 'Yükleniyor...' : (uploadTimes['map'] ? 'Yeniden Yükle' : 'Görsel Yükle')}
                            </span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleGenericUpload('map', e)} disabled={isUploadingObj['map']} />
                        </label>
                        {uploadTimes['map'] && (
                            <div className="mt-3 text-[10px] text-emerald-400 font-medium">Son Yükleme: <br/>{uploadTimes['map']}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
