"use client";
import React, { useState } from 'react';
import { Settings, FileText, UploadCloud, FileSpreadsheet, Banknote, ShieldCheck, Sun, LogOut, FileSearch, CheckSquare, Square, Send, MessageCircle } from 'lucide-react';
import Link from 'next/link';

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

    // Toggle selection for a single guest
    const toggleGuest = (id: string) => {
        setGuests(guests.map(g => g.id === id ? { ...g, selected: !g.selected } : g));
    };

    // Toggle all guests
    const toggleAll = () => {
        const allSelected = guests.every(g => g.selected);
        setGuests(guests.map(g => ({ ...g, selected: !allSelected })));
    };

    // Simulate file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // In a real app, you would parse the Excel/PDF here
            setIsUploaded(true);
            setGuests(generateMockGuests());
        }
    };

    const handleSendMessage = () => {
        setMessageSent(true);
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
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <FileSearch className="w-7 h-7 text-blue-400" />
                            <div>
                                <h2 className="text-2xl font-bold">Günlük Inhouse Listesi Yükle (Akıllı Filtreleme)</h2>
                                <p className="text-slate-400 text-sm mt-1">Excel veya PDF yüklediğinizde fiyatlar vb. gizli bilgiler otomatik silinir; sadece iletişim ve konaklama özeti listelenir.</p>
                            </div>
                        </div>
                        
                        {!isUploaded && (
                            <label className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl cursor-pointer font-bold transition-colors">
                                <UploadCloud className="w-5 h-5 mr-2" />
                                Dosya Yükle
                                <input type="file" className="hidden" accept=".xlsx, .xls, .pdf" onChange={handleFileUpload} />
                            </label>
                        )}
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
                            </div>
                        </div>
                    )}
                </div>

                {/* Eski Yükleme Modülleri (Konsept, Fact Sheet vb.) Grid Halinde Altta */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Konsept Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative group hover:border-slate-700 transition-all flex flex-col justify-between">
                        <div>
                            <FileText className="w-6 h-6 text-slate-400 mb-3" />
                            <h2 className="text-lg font-bold mb-2">Konsept Dosyası</h2>
                            <p className="text-slate-500 text-xs mb-4">Yaz/Kış sezonu, özel etkinlik konseptleri.</p>
                        </div>
                        <label className="flex flex-col items-center justify-center w-full py-4 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                            <UploadCloud className="w-5 h-5 text-slate-500 mb-1" />
                            <span className="text-xs font-bold text-slate-400">Dosya Yükle</span>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Fact Sheet Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative group hover:border-slate-700 transition-all flex flex-col justify-between">
                        <div>
                            <FileSpreadsheet className="w-6 h-6 text-slate-400 mb-3" />
                            <h2 className="text-lg font-bold mb-2">Fact Sheet</h2>
                            <p className="text-slate-500 text-xs mb-4">Otel fiziki özellik dökümanı.</p>
                        </div>
                        <label className="flex flex-col items-center justify-center w-full py-4 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                            <UploadCloud className="w-5 h-5 text-slate-500 mb-1" />
                            <span className="text-xs font-bold text-slate-400">Dosya Yükle</span>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Fiyat Listesi Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative group hover:border-slate-700 transition-all flex flex-col justify-between">
                        <div>
                            <Banknote className="w-6 h-6 text-slate-400 mb-3" />
                            <h2 className="text-lg font-bold mb-2">Fiyat Listesi</h2>
                            <p className="text-slate-500 text-xs mb-4">Önbüro harici hizmet fiyatlandırmaları.</p>
                        </div>
                        <label className="flex flex-col items-center justify-center w-full py-4 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                            <UploadCloud className="w-5 h-5 text-slate-500 mb-1" />
                            <span className="text-xs font-bold text-slate-400">Dosya Yükle</span>
                            <input type="file" className="hidden" />
                        </label>
                    </div>

                    {/* Daypass Yükleme */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 relative group hover:border-slate-700 transition-all flex flex-col justify-between">
                        <div>
                            <Sun className="w-6 h-6 text-slate-400 mb-3" />
                            <h2 className="text-lg font-bold mb-2">Day-Pass Fiyatları</h2>
                            <p className="text-slate-500 text-xs mb-4">Günübirlik misafir kabul şartları.</p>
                        </div>
                        <label className="flex flex-col items-center justify-center w-full py-4 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                            <UploadCloud className="w-5 h-5 text-slate-500 mb-1" />
                            <span className="text-xs font-bold text-slate-400">Dosya Yükle</span>
                            <input type="file" className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
