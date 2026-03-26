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

    // Now handle literal replacement characters (\uFFFD) if any
    if (str.includes('\uFFFD')) {
        // Name fixes
        str = str.replace(/Y\uFFFBlmaz/g, "Yılmaz");
        str = str.replace(/M\uFFFBu\uFFFDller/g, "Müller");
        str = str.replace(/M\uFFFDller/g, "Müller");

        // Action/verb fixes
        str = str.replace(/so\uFFFDutmuyor/ig, "soğutmuyor");
        str = str.replace(/\uFFFDal\uFFFD\uFFFD\uFFFDyor/ig, "çalışıyor");
        str = str.replace(/\uFFFDal\uFFFDm\uFFFDyor/ig, "çalışmıyor");
        str = str.replace(/\uFFFDal\uFFFDr/ig, "çalışır");
        str = str.replace(/a\uFFFD\uFFFDlm\uFFFDyor/ig, "açılmıyor");
        str = str.replace(/a\uFFFD\uFFFDlmyor/ig, "açılmıyor");
        str = str.replace(/a\uFFFD\uFFFDo/ig, "açıyo");
        str = str.replace(/a\uFFFDo/ig, "açıyo");
        str = str.replace(/kapat\uFFFDlm\uFFFDyor/ig, "kapatılmıyor");
        str = str.replace(/s\uFFFDzd\uFFFDr\uFFFDyor/ig, "sızdırıyor");
        str = str.replace(/ak\uFFFDr\uFFFDr/ig, "akıtır");
        str = str.replace(/ak\uFFFDyor/ig, "akıyor");
        str = str.replace(/ak\uFFFDto/ig, "akıto");
        str = str.replace(/patlad\uFFFD/ig, "patladı");
        str = str.replace(/d\uFFFD\uFFFDt\uFFFD/ig, "düştü");
        str = str.replace(/k\uFFFDr\uFFFDld\uFFFD/ig, "kırıldı");
        str = str.replace(/k\uFFFDr\uFFFDo/ig, "kırıko");
        str = str.replace(/yaram\uFFFDyor/ig, "yaramıyor");
        str = str.replace(/\uFFFDs\uFFFDnm\uFFFDyor/ig, "ısınmıyor");
        str = str.replace(/\uFFFDs\uFFFDto/ig, "ısıto");
        
        // Adjectives and common words
        str = str.replace(/\uFFFDok/ig, "çok");
        str = str.replace(/s\uFFFDcak/ig, "sıcak");
        str = str.replace(/s\uFFFD\uFFFDcak/ig, "sıcak");
        str = str.replace(/s\uFFFDc\uFFFDak/ig, "sıcak");
        str = str.replace(/so\uFFFDuk/ig, "soğuk");
        str = str.replace(/g\uFFFDr\uFFFDlt\uFFFDl\uFFFD/ig, "gürültülü");
        str = str.replace(/k\uFFFDr\uFFFDo/ig, "kırık");
        str = str.replace(/k\uFFFDr\uFFFDk/ig, "kırık");
        str = str.replace(/bozuk/ig, "bozuk"); // Bozuk is usually fine, no turkish chars but just in case
        str = str.replace(/a\uFFFDr\uFFFD/ig, "aşırı");
        str = str.replace(/k\uFFFDt\uFFFD/ig, "kötü");
        
        // Nouns
        str = str.replace(/du\uFFFD/ig, "duş");
        str = str.replace(/ba\uFFFDl\uFFFD\uFFFDo/ig, "başlığı");
        str = str.replace(/ba\uFFFDl\uFFFD\uFFFD\uFFFD/ig, "başlığı");
        str = str.replace(/ba\uFFFDl\uFFFDk/ig, "başlık");
        str = str.replace(/i\uFFFDi/ig, "içi");
        str = str.replace(/i\uFFFDinde/ig, "içinde");
        str = str.replace(/\uFFFDz\uFFFDr/ig, "özür");
        str = str.replace(/te\uFFFDekk\uFFFDr/ig, "teşekkür");
        str = str.replace(/\uFFFDikayet/ig, "şikayet");
        str = str.replace(/i\uFFFDin/ig, "için");
        str = str.replace(/sa\uFFFD/ig, "saç");
        str = str.replace(/\uFFFDarj/ig, "şarj");
        str = str.replace(/fi\uFFFD/ig, "fiş");
        str = str.replace(/priz/ig, "priz");
        str = str.replace(/d\uFFFD\uFFFDme/ig, "düğme");
        str = str.replace(/d\uFFFD\uFFFDo/ig, "düğme");
        str = str.replace(/ampul/ig, "ampul");
        str = str.replace(/klozet/ig, "klozet");
        str = str.replace(/televizyon/ig, "televizyon");
        str = str.replace(/klima/ig, "klima");
        
        // More specific fallback replacements where context is clear based on common errors
        // "al\uFFFDmyor" might just be "al\uFFFDmyor" with one \uFFFD for "çı"
        str = str.replace(/a\uFFFDlmyor/ig, "açılmıyor");
        str = str.replace(/a\uFFFDlm\uFFFDyor/ig, "açılmıyor");
        str = str.replace(/\uFFFDl\uFFFDm\uFFFDyor/ig, "çalışmıyor"); 
        str = str.replace(/\uFFFDal\uFFFDm\uFFFDyor/ig, "çalışmıyor"); 

        // At the end, let's gracefully replace the remaining \uFFFD characters with something
        // Just leaving them might be better or replacing with '?'
        // However, many times missing char is just 'ı' or 'ş'. We won't try to guess blindly though
        // so as not to corrupt names further.
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
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
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
                    <div className="w-full overflow-x-auto rounded-2xl border border-blue-900/30 bg-slate-900/30 backdrop-blur-sm">
                        {/* Table Header */}
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-blue-900/50">
                                    <th className="text-left px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-32">Tarih & Saat</th>
                                    <th className="text-center px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-24">Oda No</th>
                                    <th className="text-left px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Arıza Açıklaması</th>
                                    <th className="text-center px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-32">Varsa Görsel</th>
                                    <th className="text-center px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-40">Aksiyon</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.sort((a, b) => (a.status === 'PENDING' ? -1 : 1)).map((ticket, index) => (
                                    <tr
                                        key={ticket.ticket_id}
                                        className={`border-b border-blue-900/20 last:border-0 transition-all duration-200 ${
                                            ticket.status === 'PENDING'
                                                ? 'bg-red-950/10 hover:bg-red-950/20'
                                                : 'opacity-60 hover:opacity-100 bg-emerald-950/5 hover:bg-emerald-950/10'
                                        }`}
                                    >
                                        {/* Tarih & Saat */}
                                        <td className="px-5 py-4 align-middle">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-mono text-slate-300 font-semibold">
                                                    {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
                                                </span>
                                                <span className="text-xs font-mono text-slate-500">
                                                    {new Date(ticket.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {ticket.status === 'PENDING' && (
                                                    <span className="mt-1 inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] uppercase font-black px-2 py-0.5 rounded border border-red-500/30 w-max animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                                                        BEKLİYOR
                                                    </span>
                                                )}
                                                {ticket.status !== 'PENDING' && (
                                                    <span className="mt-1 inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-black px-2 py-0.5 rounded border border-emerald-500/20 w-max">
                                                        İŞLENDİ
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Oda No */}
                                        <td className="px-5 py-4 align-middle">
                                            <div className="flex justify-center">
                                                <div className={`text-3xl font-black ${ticket.status === 'PENDING' ? 'text-white' : 'text-slate-500'} bg-white/5 w-20 py-2 rounded-xl border border-white/10 text-center tabular-nums`}>
                                                    {ticket.room_no}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Arıza Açıklaması */}
                                        <td className="px-5 py-4 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Star className={`w-3.5 h-3.5 flex-shrink-0 ${ticket.status === 'PENDING' ? 'text-cyan-400' : 'text-slate-600'}`} />
                                                    <span className="text-sm font-bold text-slate-200">{ticket.guest_name}</span>
                                                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                        {ticket.guest_language.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="rounded-xl bg-black/30 border border-white/5 p-3 space-y-1.5">
                                                    <p className={`text-sm ${ticket.status === 'PENDING' ? 'text-slate-300' : 'text-slate-500'}`}>
                                                        {fixTurkishChars(ticket.original_message)}
                                                    </p>
                                                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                                                        <RefreshCw className="w-3 h-3 text-cyan-500 mt-0.5 flex-shrink-0" />
                                                        <p className="text-sm text-cyan-300 font-semibold leading-snug">
                                                            {fixTurkishChars(ticket.turkish_translation)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Görsel */}
                                        <td className="px-5 py-4 align-middle">
                                            <div className="flex justify-center">
                                                {ticket.image_url ? (
                                                    <div className="group/img relative w-24 h-16 rounded-xl overflow-visible">
                                                        <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-blue-800/40 bg-black/50 transition-all duration-300 ease-in-out
                                                            group-hover/img:scale-[3.5] group-hover/img:-translate-y-8 group-hover/img:-translate-x-8
                                                            group-hover/img:z-[100] group-hover/img:shadow-[0_0_50px_rgba(0,0,0,0.9)]
                                                            group-hover/img:rounded-2xl cursor-zoom-in z-10">
                                                            <img src={ticket.image_url} alt="Arıza Görseli" className="object-cover w-full h-full" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-16 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/3 text-slate-600 text-[11px] text-center font-medium gap-1">
                                                        <ImageIcon className="w-4 h-4" />
                                                        <span>Yok</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Aksiyon */}
                                        <td className="px-5 py-4 align-middle">
                                            <div className="flex justify-center">
                                                {ticket.status === 'PENDING' ? (
                                                    <div className="flex flex-col gap-2 w-full max-w-[140px]">
                                                        <button
                                                            onClick={() => handleAction(ticket.ticket_id, 'NOW')}
                                                            disabled={actionLoading === ticket.ticket_id}
                                                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all disabled:opacity-50 active:scale-95"
                                                        >
                                                            {actionLoading === ticket.ticket_id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : (
                                                                <span className="flex items-center justify-center gap-1.5">
                                                                    <CheckCircle className="w-3.5 h-3.5" /> Hemen Git
                                                                </span>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(ticket.ticket_id, 'LATER')}
                                                            disabled={actionLoading === ticket.ticket_id}
                                                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-600/60 transition-all disabled:opacity-50 active:scale-95"
                                                        >
                                                            {actionLoading === ticket.ticket_id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : (
                                                                <span className="flex items-center justify-center gap-1.5">
                                                                    <Clock className="w-3.5 h-3.5" /> Beklet
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 py-2.5 px-4 rounded-xl border border-emerald-500/20 w-full max-w-[140px]">
                                                        <CheckCircle className="w-4 h-4" /> İşlendi
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
