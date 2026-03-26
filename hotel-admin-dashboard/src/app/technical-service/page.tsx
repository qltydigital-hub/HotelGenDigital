'use client';

import React, { useState, useEffect } from 'react';
import { 
    Wrench, Calendar, CheckCircle, Clock, Search, LogOut, 
    Image as ImageIcon, RefreshCw, AlertCircle, Phone, 
    ShieldAlert, Loader2, CalendarDays, Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

interface Ticket {
    ticket_id: string;
    room_no: string;
    guest_name: string;
    original_message: string;
    turkish_translation: string;
    image_url: string | null;
    status: string;
    created_at: string;
    guest_language: string;
}

function fixTurkishChars(str: string | undefined | null): string {
    if (!str) return '';
    
    // First, check if it's Mojibake (e.g. Ã§, Ã¼, ÅŸ) and try to decode it safely
    try {
        if (/Ã|Å|Ä|Ä±|ÄŸ|Ã¼|Ã¶|Ã§|ÅŸ/.test(str)) {
            const fixed = decodeURIComponent(escape(str));
            str = fixed;
        }
    } catch (e) {
        // Fallback if decoding fails
    }

    // Now handle literal replacement characters  if any
    if (str.includes('\uFFFD')) {
        str = str.replace(/Du bal krk/ig, "Duş başlığı kırık");
        str = str.replace(/patlad/ig, "patladı");
        // General common fixes
        str = str.replace(/yaramyor/ig, "yaramıyor");
        str = str.replace(/almyor/ig, "çalışmıyor");
        str = str.replace(/snmyor/ig, "ısınmıyor");
        str = str.replace(/\uFFFD/g, "ı"); // Risky, but often replacement char in Turkish contexts without other letters means 'ı' or 'ş'. We'll stick to 'ı' gracefully if it's broken.
    }

    return str;
}

export default function TechnicalServiceDashboard() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState<string>(
        new Date().toISOString().split('T')[0] // today's date
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0] // today's date
    );
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const { user, logout } = useAuth();
    const router = useRouter();

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/tickets?department=Teknik Servis&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            if (data.success) {
                setTickets(data.data);
            }
        } catch (error) {
            console.error("Hata:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        fetchTickets();
        
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, [startDate, endDate, user, router]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleAction = async (ticketId: string, action: 'NOW' | 'LATER') => {
        setActionLoading(ticketId);
        try {
            const res = await fetch('/api/tickets/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, action, staffName: user?.username || 'T/S Uzmanı' })
            });
            const result = await res.json();
            
            if (result.success) {
                // Update local state ticket status to reflect completion
                setTickets(prev => prev.map(t => 
                    t.ticket_id === ticketId ? { ...t, status: 'COMPLETED' } : t
                ));
            } else {
                alert(result.error || 'İşlem Başarısız.');
            }
        } catch (error) {
            alert('Ağ Hatası Oluştu.');
        } finally {
            setActionLoading(null);
        }
    };

    if (!user) return null; // Wait for redirect

    const pendingTickets = tickets.filter(t => t.status === 'PENDING').length;

    return (
        <div className="min-h-screen bg-[#06101c] text-white overflow-hidden relative font-sans">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-[-20%] w-[140%] h-[500px] bg-gradient-to-b from-blue-900/40 via-blue-900/5 to-transparent blur-[120px] pointer-events-none" />
            
            {/* Futuristic Header */}
            <header className="relative z-10 border-b border-blue-900/50 bg-[#0a1526]/80 backdrop-blur-3xl p-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_4px_30px_rgb(0,0,0,0.5)]">
                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-75 animate-pulse"></div>
                        <div className="relative p-3 bg-[#0a1526] rounded-xl border border-blue-500/30">
                            <Wrench className="w-8 h-8 text-cyan-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-400 tracking-tight">Teknik Servis Hub</h1>
                        <p className="text-blue-400/80 text-sm font-semibold tracking-wider uppercase mt-1">Otel Operasyon Yönetimi</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="bg-blue-950/40 border border-blue-800/50 px-5 py-2.5 rounded-2xl flex items-center gap-4 text-sm font-semibold shadow-inner">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full animate-ping bg-red-500"></span>
                            <span className="text-slate-300">Bekleyen:</span>
                            <span className="text-red-400 text-lg">{pendingTickets} Talep</span>
                        </div>
                    </div>
                    
                    <button onClick={handleLogout} className="group relative flex items-center justify-center w-12 h-12 rounded-xl bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 hover:border-red-500/50 transition-all duration-300">
                        <LogOut className="w-5 h-5 text-red-500 group-hover:scale-110 group-hover:text-red-400 transition-transform" />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-8 relative z-10 mt-4">
                
                {/* Controls Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10 bg-slate-900/40 p-4 border border-blue-900/30 rounded-3xl shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex items-center">
                                <CalendarDays className="absolute left-4 w-5 h-5 text-blue-500 pointer-events-none" />
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)}
                                    onClick={(e) => {
                                        try {
                                            if (typeof (e.target as any).showPicker === 'function') {
                                                (e.target as any).showPicker();
                                            }
                                        } catch (err) {}
                                    }}
                                    className="pl-12 pr-4 py-3.5 bg-slate-950/80 border-2 border-blue-900/50 focus:border-cyan-500 rounded-2xl text-blue-100 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all cursor-pointer shadow-inner w-full sm:w-[180px] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                                />
                            </div>
                            <span className="text-blue-500 font-bold">-</span>
                            <div className="relative flex items-center">
                                <CalendarDays className="absolute left-4 w-5 h-5 text-blue-500 pointer-events-none" />
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)}
                                    onClick={(e) => {
                                        try {
                                            if (typeof (e.target as any).showPicker === 'function') {
                                                (e.target as any).showPicker();
                                            }
                                        } catch (err) {}
                                    }}
                                    className="pl-12 pr-4 py-3.5 bg-slate-950/80 border-2 border-blue-900/50 focus:border-cyan-500 rounded-2xl text-blue-100 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all cursor-pointer shadow-inner w-full sm:w-[180px] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                                />
                            </div>
                        </div>
                        <button onClick={fetchTickets} className="p-3.5 bg-blue-900/20 hover:bg-blue-800/40 border border-blue-800/50 rounded-2xl transition-colors shadow-sm group">
                            <RefreshCw className={`w-5 h-5 text-cyan-400 group-hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="bg-gradient-to-tr from-blue-900/20 to-indigo-900/20 px-6 py-3 rounded-2xl border border-indigo-500/20 flex flex-col items-end">
                        <span className="text-xs text-indigo-300/70 font-bold uppercase tracking-widest">Sistem Durumu</span>
                        <span className="text-sm text-indigo-200 font-semibold">{user.username} - Aktif İstasyon</span>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-pulse">
                        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
                        <span className="text-blue-400 font-medium">Talepler Getiriliyor...</span>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-slate-900/20 border border-blue-900/20 rounded-3xl gap-4">
                        <ShieldAlert className="w-16 h-16 text-blue-800" />
                        <h3 className="text-2xl font-bold text-blue-400">Harika! Her Şey Yolunda.</h3>
                        <p className="text-blue-300/60 font-medium text-center max-w-sm">Bu tarihe ait bekleyen veya tamamlanmış teknik servis talebi bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Header Table (Only visible on large screens) */}
                        <div className="hidden lg:flex items-center gap-6 px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-blue-900/40 mb-2">
                            <div className="w-24">Tarih & Saat</div>
                            <div className="w-24 text-center">Oda</div>
                            <div className="flex-1">Arıza & Misafir Bilgisi</div>
                            <div className="w-28 text-center">Varsa Görsel</div>
                            <div className="w-36 text-center">Aksiyon</div>
                        </div>
                        
                        {/* Render PENDING tickets first, then completed */}
                        {tickets.sort((a,b) => (a.status === 'PENDING' ? -1 : 1)).map(ticket => (
                            <div 
                                key={ticket.ticket_id} 
                                className={`group relative overflow-visible rounded-2xl transition-all duration-300 ${
                                    ticket.status === 'PENDING' 
                                    ? 'bg-gradient-to-r from-slate-900/90 to-slate-950/90 border border-red-500/30 hover:border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                                    : 'bg-slate-900/40 border border-emerald-900/40 opacity-70 hover:opacity-100'
                                }`}
                            >
                                <div className="p-4 lg:p-0 flex flex-col lg:flex-row lg:items-center gap-6 lg:px-6 lg:py-4">
                                    
                                    {/* 1. Tarih */}
                                    <div className="lg:w-24 flex flex-col">
                                        <span className="lg:hidden text-xs text-slate-500 font-bold mb-1">TARİH & SAAT</span>
                                        <span className="text-sm text-slate-300 font-mono">
                                            {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">
                                            {new Date(ticket.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        {ticket.status === 'PENDING' && (
                                            <span className="mt-2 bg-red-500/20 text-red-400 text-[10px] uppercase font-black px-2 py-0.5 rounded inline-flex border border-red-500/20 w-max animate-pulse">
                                                 BEKLİYOR
                                            </span>
                                        )}
                                    </div>

                                    {/* 2. Oda Numarası */}
                                    <div className="lg:w-24 flex flex-col lg:items-center">
                                        <span className="lg:hidden text-xs text-slate-500 font-bold mb-1">ODA NUMARASI</span>
                                        <div className={`text-2xl font-black ${ticket.status === 'PENDING' ? 'text-white' : 'text-slate-400'} bg-white/5 lg:w-full px-3 py-2 rounded-xl border border-white/10 text-center w-max`}>
                                            {ticket.room_no}
                                        </div>
                                    </div>

                                    {/* 3. Arıza Açıklaması */}
                                    <div className="flex-1 flex flex-col gap-2">
                                         <span className="lg:hidden text-xs text-slate-500 font-bold mb-1">ARIZA AÇIKLAMASI</span>
                                         <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
                                            <Star className={`w-4 h-4 ${ticket.status === 'PENDING' ? 'text-cyan-400' : 'text-slate-600'}`} />
                                            {ticket.guest_name} <span className="text-xs text-slate-500 font-normal">({ticket.guest_language.toUpperCase()})</span>
                                         </div>
                                         <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                                            <p className={`text-sm font-medium ${ticket.status === 'PENDING' ? 'text-slate-300' : 'text-slate-500'} mb-2`}>
                                                {fixTurkishChars(ticket.original_message)}
                                            </p>
                                            <p className="text-sm text-cyan-300 font-bold flex flex-col xl:flex-row xl:items-center gap-1">
                                                <span className="flex items-center"><RefreshCw className="w-3 h-3 mr-1"/>Otonom Çeviri:</span>
                                                <span>{fixTurkishChars(ticket.turkish_translation)}</span>
                                            </p>
                                         </div>
                                    </div>

                                    {/* 4. Görsel */}
                                    <div className="lg:w-28 flex flex-col lg:items-center">
                                        <span className="lg:hidden text-xs text-slate-500 font-bold mb-2">VARSA GÖRSEL</span>
                                        {ticket.image_url ? (
                                            <div className="group/img relative w-24 h-16 rounded-xl z-10">
                                                <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-blue-900/30 bg-black/50 transition-all duration-300 ease-in-out origin-center lg:origin-right group-hover/img:-translate-x-4 lg:group-hover/img:-translate-x-12 group-hover/img:-translate-y-4 group-hover/img:scale-[3] group-hover/img:z-[100] group-hover/img:shadow-[0_0_40px_rgba(0,0,0,0.8)] cursor-zoom-in">
                                                    <img src={ticket.image_url} alt="Problem Gösterimi" className="object-cover w-full h-full" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-24 h-16 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/5 text-slate-600 text-xs text-center font-medium">
                                                Görsel<br/>Yok
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. Aksiyon */}
                                    <div className="lg:w-36 flex flex-col justify-center">
                                        <span className="lg:hidden text-xs text-slate-500 font-bold mb-2">AKSİYON</span>
                                        {ticket.status === 'PENDING' ? (
                                            <div className="flex flex-col gap-2 w-full">
                                                <button 
                                                    onClick={() => handleAction(ticket.ticket_id, 'NOW')}
                                                    disabled={actionLoading === ticket.ticket_id}
                                                    className="w-full relative overflow-hidden group bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50"
                                                >
                                                    {actionLoading === ticket.ticket_id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-4 h-4"/> Hemen Git</span>
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(ticket.ticket_id, 'LATER')}
                                                    disabled={actionLoading === ticket.ticket_id}
                                                    className="w-full relative overflow-hidden group bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-600 transition-all disabled:opacity-50"
                                                >
                                                    {actionLoading === ticket.ticket_id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-1.5"><Clock className="w-4 h-4"/> Beklet</span>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-emerald-500 font-bold text-sm bg-emerald-500/10 py-3 px-4 rounded-xl border border-emerald-500/20">
                                                <CheckCircle className="w-4 h-4 mr-2" /> İşlendi
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
