"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3, Users, MessageSquare, Ticket,
  Settings, Hotel, Bell, Search, Menu, UserCircle,
  Clock, Send, Trash2, Eye, RadioTower, Shield, Key
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ message: '', visible: false });

  // ── Canlı Chat State ──────────────────────────────────────────────
  type ChatMessage = { role: string; text: string; timestamp: string; platform: string };
  const [chatId, setChatId] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Mesaj polling (her 2 saniyede bir)
  useEffect(() => {
    if (!activeChatId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?chatId=${activeChatId}`);
        const data = await res.json();
        if (data.messages) {
          setChatMessages(data.messages);
        }
      } catch { }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeChatId]);

  // Mesaj gelince scrollu en alta kaydır
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleStartMonitoring = () => {
    if (!chatId.trim()) return;
    setActiveChatId(chatId.trim());
    setChatMessages([]);
    showToast(`Chat ID ${chatId} için dinleme başlatıldı.`);
  };

  const handleClearChat = async () => {
    if (!activeChatId) return;
    await fetch(`/api/messages?chatId=${activeChatId}`, { method: 'DELETE' });
    setChatMessages([]);
    showToast('Konuşma geçmişi temizlendi.');
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChatId || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/customer-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId, message: replyText })
      });
      if (res.ok) {
        // Dashboard'dan giden mesajı da kaydet
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: activeChatId, role: 'dashboard', text: `[YÖNETİCİ] ${replyText}`, platform: 'Dashboard' })
        });
        setReplyText('');
      } else {
        showToast('❌ Mesaj gönderilemedi!');
      }
    } catch {
      showToast('❌ Ağ hatası!');
    } finally {
      setIsSending(false);
    }
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  // Sahte (Mock) Veritabanı State'i
  const [tickets, setTickets] = useState([
    {
      id: "HTL-2831",
      room: "Oda 304",
      guest: "Ahmet Yılmaz",
      dept: "Housekeeping",
      status: "OPEN",
      time: "3 dk önce",
      desc: "Ekstra yastık ve havlu talebi (ManyChat - WhatsApp üzerinden geldi)."
    },
    {
      id: "HTL-2830",
      room: "Oda 112",
      guest: "Sarah Conor",
      dept: "Teknik Servis",
      status: "ESCALATED",
      time: "6 dk önce",
      desc: "Klima soğutmuyor. (AI ön kontrol önerdi, misafir denedi ancak sorun devam ediyor!)",
      isSkyEscalate: true
    },
    {
      id: "HTL-2829",
      room: "Oda 502",
      guest: "Mehmet S.",
      dept: "F&B (Gastro)",
      status: "CRITICAL",
      time: "10 dk önce",
      desc: "Akşam yemeği alerjen sorgusu: Fıstık alerjisi var. Lütfen mutfak şefini bilgilendirin.",
      isSkyEscalate: true
    },
    {
      id: "HTL-2828",
      room: "Oda 408",
      guest: "Hans Müller",
      dept: "Resepsiyon",
      status: "RESOLVED",
      time: "45 dk önce",
      desc: "Geç check-out talebi onaylandı (Saat 14:00 çıkış)."
    },
    {
      id: "HTL-2827",
      room: "Oda 201",
      guest: "Can T.",
      dept: "Guest Relation",
      status: "ACKED",
      time: "1 saat önce",
      desc: "Balayı odası sürprizi hakkında bilgi istendi. (Departman ilgileniyor)"
    }
  ]);

  const handleAck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'ACKED', isSkyEscalate: false } : t));
    showToast(`${id} numaralı talep başarıyla üstlenildi (ACK).`);
  };

  const handleDetail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast(`${id} numaralı talebin detay dosyası açılıyor...`);
  };

  // Arama metnine göre filtreleme
  const filteredTickets = tickets.filter(t =>
    searchQuery === '' ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.guest.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen w-full relative overflow-hidden bg-gradient-body">

      {/* Sidebar - Yüksek Kontrast */}
      <aside className="w-72 hidden lg:flex flex-col glass-panel z-20">
        <div className="p-6 flex items-center space-x-4 mb-4">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/50">
            <Hotel className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">GuestFlow AI</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-2">
          <Link href="/" className="flex items-center space-x-4 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-md border border-blue-400">
            <BarChart3 className="w-6 h-6 font-bold" />
            <span className="font-bold text-base">Dashboard</span>
          </Link>

          <a href="#" onClick={(e) => { e.preventDefault(); showToast("Kanallar modülü yapım aşamasında."); }} className="flex items-center space-x-4 px-4 py-3 text-blue-100 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            <span className="font-semibold text-base">Kanallar (AI)</span>
          </a>

          <a href="#" onClick={(e) => { e.preventDefault(); showToast("Talepler modülü yükleniyor..."); }} className="flex items-center justify-between px-4 py-3 text-blue-100 hover:text-white hover:bg-slate-800 rounded-xl transition-all group">
            <div className="flex items-center space-x-4">
              <Ticket className="w-6 h-6 text-blue-400" />
              <span className="font-semibold text-base">Talepler (SLA)</span>
            </div>
            <span className="bg-red-500 text-white text-xs items-center justify-center flex font-bold w-6 h-6 rounded-full shadow-lg shadow-red-500/50">4</span>
          </a>

          <Link href="/reception" className="flex items-center space-x-4 px-4 py-3 text-blue-100 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
            <Users className="w-6 h-6 text-blue-400" />
            <span className="font-semibold text-base">Misafirler & Çıkış</span>
          </Link>

          <div className="pt-6 pb-2 px-4 border-t border-blue-900 mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Yönetim</p>
          </div>

          <Link href="/settings" className="flex items-center space-x-4 px-4 py-3 text-blue-100 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
            <Settings className="w-6 h-6 text-blue-400" />
            <span className="font-semibold text-base">Otel & Admin Ayarları</span>
          </Link>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-slate-800 p-4 flex items-center space-x-3 border border-blue-900 rounded-2xl cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => showToast("Admin yetki kartına tıklandı.")}>
            <RoleBadge role="PLATFORM ADMIN" />
          </div>
        </div>
      </aside>

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10 w-full">

        {/* Toast Bildirim Kutusu */}
        {toast.visible && (
          <div className="fixed top-24 right-8 z-50 animate-bounce">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.6)] border border-blue-400 font-bold flex items-center space-x-3">
              <Bell className="w-5 h-5" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Üst Header (Nav) */}
        <header className="h-[80px] shrink-0 bg-[#0f172a] border-b-2 border-blue-900 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center w-full lg:w-auto">
            <button onClick={() => showToast("Mobil menü tetiklendi.")} className="lg:hidden p-2 text-white hover:text-blue-400 mr-2 transition-colors">
              <Menu className="w-8 h-8" />
            </button>
            <div className="relative group flex-1 lg:w-96 lg:flex-none">
              <Search className="w-5 h-5 text-blue-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Misafir, Oda veya HTL- Talep Ara"
                className="bg-slate-900 border-2 border-blue-800 text-base text-white rounded-full pl-12 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all placeholder-blue-300 shadow-inner font-medium"
              />
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-6">
            <button onClick={() => showToast("Yeni bildiriminiz yok.")} className="relative text-blue-100 hover:text-white transition-colors bg-slate-800 p-2.5 rounded-full border border-blue-800">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-400 rounded-full border-2 border-[#0f172a] shadow-[0_0_10px_rgba(56,189,248,1)]"></span>
            </button>

            <div className="h-8 w-px bg-blue-800"></div>

            <button onClick={() => showToast("Profil Ayarları yapım aşamasında.")} className="flex items-center space-x-3 text-left hover:opacity-80 transition-opacity pr-2 bg-slate-800 py-1.5 px-3 rounded-full border border-blue-800">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-white" />
              </div>
              <div className="pr-2">
                <p className="text-base font-bold text-white leading-tight">Özgür ÖZEN</p>
                <p className="text-xs text-sky-400 font-extrabold tracking-wider">HOTEL ADMIN</p>
              </div>
            </button>
          </div>
        </header>

        {/* Dashboard Ana Ekran */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 hide-scrollbar pb-32">

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center">
                Hoş Geldiniz, <span className="text-gradient ml-2">Özgür ÖZEN</span>
                <span className="ml-3 text-3xl">👋</span>
              </h1>
              <p className="text-blue-100 text-base font-semibold">Platform devrede. Bugün otele giriş yapacak 24, çıkış yapacak 12 misafiriniz var.</p>
            </div>

            <div className="self-start md:self-auto px-5 py-3 rounded-xl bg-blue-600 border border-blue-400 text-white text-base font-extrabold flex items-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <span className="relative flex h-3 w-3 mr-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              Canlı AI Sinerjisi Aktif
            </div>
          </div>

          {/* İstatistik Modülleri */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <StatCard
              title="Aktif Konaklama (Tenant)"
              value="142"
              trend="+12% Geçen haftaya göre"
              icon={<Users className="w-8 h-8" />}
              color="text-cyan-400"
              bg="bg-slate-800"
              border="border-cyan-500"
              trendColor="text-cyan-300 font-bold"
            />
            <StatCard
              title="Bekleyen Talepler"
              value="8"
              trend="2 ACİL (SLA İhlali!)"
              trendColor="text-red-400 font-extrabold"
              icon={<Ticket className="w-8 h-8" />}
              color="text-red-400"
              bg="bg-slate-800"
              border="border-red-500"
            />
            <StatCard
              title="AI Başarı Oranı"
              value="%94"
              trend="203 mesaj direkt yönlendirildi"
              icon={<MessageSquare className="w-8 h-8" />}
              color="text-sky-400"
              bg="bg-slate-800"
              border="border-sky-500"
              trendColor="text-sky-300 font-bold"
            />
            <StatCard
              title="Ortalama Çözüm (Zaman)"
              value="14 Dk"
              trend="2 Dk hızlandı"
              trendColor="text-green-400 font-extrabold"
              icon={<Clock className="w-8 h-8" />}
              color="text-green-400"
              bg="bg-slate-800"
              border="border-green-500"
            />
          </div>

          {/* Hotel & Admin Yönetim Paneli - Hızlı Erişim */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 px-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">YÖNETİM & SİSTEM AYARLARI</h2>
            </div>
            <Link href="/settings" className="block group">
              <div className="glass-card p-10 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/30 hover:border-blue-500/60 transition-all rounded-[32px] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 group-hover:shadow-[0_0_50px_rgba(37,99,235,0.15)]">
                <div className="absolute -right-24 -bottom-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-600/20 transition-all"></div>

                <div className="flex items-center gap-6 relative z-10">
                  <div className="bg-blue-600 p-5 rounded-2xl shadow-2xl shadow-blue-500/40 group-hover:scale-110 transition-transform duration-500">
                    <Settings className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">Otel & Admin Ayarları</h3>
                    <p className="text-blue-100/60 font-medium text-lg mt-1">Sistem yapılandırması, API entegrasyonları ve yetkilendirmeler.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full md:w-auto">
                  <div className="flex items-center gap-3 px-6 py-4 bg-blue-600 border border-blue-400 text-white rounded-2xl font-black shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
                    <Shield className="w-5 h-5" />
                    <span>DEPARTMAN YETKİLERİ</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-700 text-slate-300 rounded-2xl font-bold group-hover:text-white transition-colors">
                    <Key className="w-5 h-5" />
                    <span>API ANAHTARLARI</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Müşteri Test Modülü */}
          <div className="mb-8 glass-card p-6 lg:p-8 relative overflow-hidden group border border-teal-500/30">
            <div className="flex items-center justify-between mb-4 border-b-2 border-slate-700 pb-4">
              <h2 className="text-2xl font-extrabold text-white flex items-center">
                Müşteri Simülasyonu (Test Paneli)
              </h2>
              <div className="bg-teal-500/20 text-teal-400 px-4 py-1.5 rounded-lg border border-teal-500 text-sm font-bold shadow-md">
                TEST MODU Aktif
              </div>
            </div>

            <p className="text-blue-200 text-sm mb-6">
              Buradan yazacağınız mesajlar belirteceğiniz Telegram adresine ve ManyChat'e (API üzerinden) direkt gönderilecektir. Entegrasyonu test etmek için kullanabilirsiniz.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const btn = (e.target as any).querySelector('button[type="submit"]');
                const oldText = btn.innerHTML;
                btn.innerHTML = 'Gönderiliyor...';
                btn.disabled = true;

                try {
                  const fd = new FormData(e.target as HTMLFormElement);
                  const data = Object.fromEntries(fd.entries());

                  const res = await fetch('/api/customer-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                  });

                  const result = await res.json();
                  if (res.ok) {
                    showToast('✅ Mesajınız Telegram ve ManyChat için işlendi.');
                    (e.target as HTMLFormElement).reset();
                  } else {
                    showToast('❌ Hata: ' + (result.error || 'Bilinmeyen hata'));
                  }
                } catch (err) {
                  showToast('❌ Bir ağ hatası oluştu!');
                } finally {
                  btn.innerHTML = oldText;
                  btn.disabled = false;
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-100 text-xs font-bold mb-2 uppercase tracking-wide">Telegram Chat ID (Sizin ID'niz)</label>
                  <input name="chatId" type="text" placeholder="Örn: 123456789" required className="w-full bg-slate-900 border border-blue-800 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500" />
                  <p className="text-xs text-slate-400 mt-1">Bot ile mesajlaşmaya başlayıp, ID'nizi öğrenebilirsiniz.</p>
                </div>
                <div>
                  <label className="block text-blue-100 text-xs font-bold mb-2 uppercase tracking-wide">ManyChat Subscriber ID (İsteğe Bağlı)</label>
                  <input name="manychatId" type="text" placeholder="Örn: 12345" className="w-full bg-slate-900 border border-blue-800 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-blue-100 text-xs font-bold mb-2 uppercase tracking-wide">Mesajınız</label>
                <textarea name="message" rows={3} placeholder="Müşteri olarak sormak istediğiniz kurgu mesajı yazın..." required className="w-full bg-slate-900 border border-blue-800 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500"></textarea>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-teal-500/30 transition-all border border-teal-400 text-sm">
                  Simüle Et & Gönder 🚀
                </button>
              </div>
            </form>
          </div>

          {/* ── Canlı Chat İzleme Paneli ── */}
          <div className="mb-8 glass-card p-6 lg:p-8 relative overflow-hidden border border-cyan-500/30">
            <div className="flex items-center justify-between mb-4 border-b-2 border-slate-700 pb-4">
              <h2 className="text-2xl font-extrabold text-white flex items-center">
                <RadioTower className="w-7 h-7 mr-3 text-cyan-400" />
                Canlı Chat İzleme
                {activeChatId && (
                  <span className="ml-3 flex items-center text-sm font-bold text-cyan-400 bg-cyan-900/30 px-3 py-1 rounded-lg border border-cyan-600">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-2"></span>
                    ID: {activeChatId}
                  </span>
                )}
              </h2>
              {activeChatId && (
                <button
                  onClick={handleClearChat}
                  className="flex items-center space-x-2 text-sm font-bold text-red-400 hover:text-white bg-red-900/20 hover:bg-red-600 border border-red-600 px-4 py-2 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Geçmişi Temizle</span>
                </button>
              )}
            </div>

            <p className="text-blue-200 text-sm mb-5">Telegram Chat ID girerek misafirle yapılan tüm konuşmaları buradan canlı izleyin ve yönetici olarak yanıt verin.</p>

            {/* Chat ID Giriş */}
            {!activeChatId ? (
              <div className="flex gap-4">
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartMonitoring()}
                  placeholder="Telegram Chat ID (örn: 758605940)"
                  className="flex-1 bg-slate-900 border border-cyan-800 text-white rounded-xl px-5 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder-slate-500 font-mono"
                />
                <button
                  onClick={handleStartMonitoring}
                  className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-500/30 transition-all border border-cyan-400 flex items-center space-x-2"
                >
                  <Eye className="w-5 h-5" />
                  <span>İzlemeyi Başlat</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Mesaj Akışı */}
                <div
                  ref={chatBoxRef}
                  className="h-56 overflow-y-auto bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3 mb-4 hide-scrollbar"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-sm">Henüz mesaj yok. Telegram botunuza mesaj atın...</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'dashboard' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm font-medium shadow ${msg.role === 'dashboard'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : msg.role === 'assistant'
                            ? 'bg-cyan-900/50 border border-cyan-700 text-cyan-100 rounded-bl-sm'
                            : 'bg-slate-800 border border-slate-600 text-white rounded-bl-sm'
                          }`}>
                          {msg.role !== 'dashboard' && (
                            <span className="text-[10px] font-black uppercase tracking-widest mb-1 block opacity-60">
                              {msg.role === 'assistant' ? '🤖 AI' : `👤 ${msg.platform || 'Misafir'}`}
                            </span>
                          )}
                          <p className="leading-relaxed">{msg.text}</p>
                          <span className="text-[10px] opacity-50 mt-1 block text-right">
                            {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Yanıt Alanı */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                    placeholder="Yönetici olarak yanıt yaz ve Enter'a bas..."
                    className="flex-1 bg-slate-900 border border-blue-800 text-white rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isSending}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow transition-all border border-blue-400 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    <span>{isSending ? 'Gönderiliyor...' : 'Gönder'}</span>
                  </button>
                  <button
                    onClick={() => { setActiveChatId(''); setChatMessages([]); setChatId(''); }}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all border border-slate-500 text-sm"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ana Board'lar */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">

            {/* Canlı Talepler (SLA) */}
            <div className="xl:col-span-2 glass-card p-6 lg:p-8 flex flex-col h-[600px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-700">
                <div>
                  <h2 className="text-2xl font-extrabold text-white flex items-center">
                    Canlı Talepler
                    <span className="ml-4 text-xs font-black tracking-widest bg-blue-600 text-white px-3 py-1 rounded-md shadow-lg shadow-blue-500/50">SLA BOARD EKRANI</span>
                  </h2>
                  <p className="text-base text-blue-100 mt-2 font-medium">Departmanların talep yanıtlama ve çözüm süreleri anlık olarak izleniyor.</p>
                </div>
                <button onClick={() => showToast("Tüm talepler yönetim ekranı yükleniyor...")} className="text-sm font-extrabold text-white bg-blue-600 px-5 py-2.5 rounded-lg hover:bg-blue-500 transition-colors hidden sm:block shadow-md">Tümünü Yönet</button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-3 hide-scrollbar pb-4">
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((t, index) => (
                    <TicketCard key={index} {...t} onAck={handleAck} onDetail={handleDetail} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
                      <Search className="w-8 h-8 text-blue-400 opacity-50" />
                    </div>
                    <p className="text-blue-200 font-bold mb-1">Eşleşen Talep Bulunamadı</p>
                    <p className="text-sm text-slate-500">"{searchQuery}" için uygun sonuç görüntülenmiyor.</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Son Diyalogları */}
            <div className="glass-card p-6 lg:p-8 h-[600px] flex flex-col relative overflow-hidden group">

              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-700 relative z-10">
                <h2 className="text-2xl font-extrabold text-white flex items-center">
                  Son AI Diyalogları
                </h2>
                <div className="flex items-center space-x-3 bg-slate-900 border-2 border-cyan-500 px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                  <div className="text-xs text-cyan-400 font-extrabold">CANLI AKIŞ</div>
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
                </div>
              </div>

              <div className="space-y-5 overflow-y-auto flex-1 pr-3 relative z-10 hide-scrollbar pb-4">
                <ChatFeedItem
                  platform="WhatsApp"
                  platformColor="text-green-400 border-green-500 bg-green-500/20"
                  guest="John D. (Oda 210)"
                  message="What time does the breakfast start? And can we get it to our room?"
                  reply="Breakfast is served from 07:00 to 10:30 at the main restaurant. Yes, room service is available! Would you like me to connect you with F&B for the menu? 🍳"
                  time="Şimdi"
                />
                <ChatFeedItem
                  platform="Instagram"
                  platformColor="text-pink-400 border-pink-500 bg-pink-500/20"
                  guest="Ayşe K."
                  message="Otoparkınız ücretli mi, valeniz var mı?"
                  reply="Değerli misafirimiz, özel otoparkımız ve vale hizmetimiz konaklayan misafirlerimiz için ücretsizdir. 🚗"
                  time="2 dk önce"
                />
                <ChatFeedItem
                  platform="Telegram"
                  platformColor="text-sky-400 border-sky-500 bg-sky-500/20"
                  guest="Yönetici (Özgür)"
                  message="/rapor dun"
                  reply="📊 Dün (28 Şub): Toplam 42 talep açıldı. 40'ı SLA süresi içinde çözüldü (Ort. Çözüm: 12 dk). SLA İhlali: 2 (Teknik Servis). Detaylı rapor hazırlanıyor..."
                  time="14 dk önce"
                  isAdmin={true}
                />
              </div>
            </div>

          </div>
        </div>
      </main>

    </div>
  );
}

// ------ Subcomponents ------ //

function StatCard({ title, value, icon, trend, trendColor = "text-blue-200", color, bg, border }: any) {
  return (
    <div className={`${bg} rounded-xl p-6 border-l-4 ${border} shadow-lg relative group overflow-hidden`}>
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className={`p-3 rounded-xl bg-slate-900 border ${border} ${color} shadow-md`}>
          {icon}
        </div>
        <span className={`text-[12px] ${trendColor} bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-600 shadow-sm`}>{trend}</span>
      </div>
      <div className="relative z-10">
        <h3 className="text-blue-100 font-bold text-sm mb-1 uppercase tracking-wider">{title}</h3>
        <p className="text-4xl font-black text-white">{value}</p>
      </div>
    </div>
  )
}

function TicketCard({ id, room, guest, dept, status, desc, time, isSkyEscalate, onAck, onDetail }: any) {
  const getStatusStyle = (s: string, isAlg: boolean) => {
    if (isAlg) return 'bg-red-500/20 text-red-400 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
    switch (s) {
      case 'OPEN': return 'bg-cyan-500/20 text-cyan-300 border-cyan-400';
      case 'ESCALATED': return 'bg-orange-500/20 text-orange-400 border-orange-500 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.4)]';
      case 'ACKED': return 'bg-blue-600/30 text-blue-300 border-blue-500';
      case 'RESOLVED': return 'bg-green-500/20 text-green-400 border-green-500';
      default: return 'bg-slate-700 text-slate-300 border-slate-500';
    }
  }

  const getStatusLabel = (s: string, isAlg: boolean) => {
    if (isAlg) return 'KRiTiK ALERJEN !';
    switch (s) {
      case 'OPEN': return 'YENİ (MÜDAHALE BEKLİYOR)';
      case 'ESCALATED': return 'SLA İHLALİ (ACİL)';
      case 'ACKED': return 'PERSONEL İLGİLENİYOR';
      case 'RESOLVED': return 'ÇÖZÜLDÜ ONAYLI';
      default: return s;
    }
  }

  const dynamicBg = (status === 'ESCALATED' || isSkyEscalate)
    ? 'bg-slate-800' // Belirgin kutu
    : 'bg-slate-900';

  const dynamicBorder = (status === 'ESCALATED' || isSkyEscalate) ? 'border-red-500 border-l-4' : 'border-blue-800';

  return (
    <div className={`${dynamicBg} border ${dynamicBorder} rounded-xl p-5 transition-all shadow-md mb-4`}>
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-black text-blue-300 bg-blue-900/50 px-2 py-1 rounded">{id}</span>
          <span className="text-base font-extrabold text-white">{room}</span>
          <span className="text-sm font-bold text-blue-200">{guest}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-400">{time}</span>
          <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg border-2 ${getStatusStyle(status, isSkyEscalate)}`}>
            {getStatusLabel(status, isSkyEscalate)}
          </span>
        </div>
      </div>
      <p className="text-base text-white font-medium mb-5 leading-relaxed">{desc}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold bg-blue-900 text-blue-200 px-4 py-2 rounded-lg flex items-center border border-blue-500 shadow-sm">
          <Users className="w-4 h-4 mr-2" /> {dept}
        </span>

        {status === 'OPEN' || status === 'ESCALATED' || status === 'CRITICAL' ? (
          <div className="flex space-x-3">
            <button onClick={(e) => onAck && onAck(id, e)} className="text-xs font-black bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg shadow-lg border border-blue-400 transition-all">ACK (İlgileniyoruz)</button>
            <button onClick={(e) => onDetail && onDetail(id, e)} className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg border border-slate-600 transition-all">Detay</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ChatFeedItem({ platform, platformColor, guest, message, reply, time, isAdmin = false }: any) {
  return (
    <div className="bg-slate-900 border border-blue-800 p-4 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
        <div className="flex items-center space-x-3">
          <span className={`text-[11px] font-extrabold px-3 py-1 rounded-lg border-2 ${platformColor}`}>
            {platform}
          </span>
          <span className="text-sm text-white font-bold flex items-center">
            {isAdmin && <Settings className="w-4 h-4 mr-2 text-cyan-400" />}
            {guest}
          </span>
        </div>
        <span className="text-xs text-blue-300 font-bold">{time}</span>
      </div>

      <div className="pl-4 border-l-4 border-slate-600 mb-4 ml-1">
        <p className="text-sm text-slate-300 italic font-medium leading-relaxed">"{message}"</p>
      </div>

      <div className="flex items-start">
        <div className="bg-blue-600 border border-blue-400 w-8 h-8 rounded-lg flex items-center justify-center mr-3 mt-1 shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div className="bg-[#1e293b] p-3.5 rounded-xl rounded-tl-none border border-blue-500 w-full shadow-inner">
          <p className="text-sm text-white font-semibold leading-relaxed">{reply}</p>
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <div className="flex items-center w-full">
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-md border-2 border-blue-400 font-bold text-sm">
        <span className="text-white drop-shadow-md">{role.substring(0, 2)}</span>
      </div>
      <div className="ml-3">
        <p className="text-xs font-extrabold text-blue-300 uppercase tracking-widest">{role}</p>
        <p className="text-[11px] font-bold text-slate-400 truncate mt-1">hotel_proje_admin</p>
      </div>
    </div>
  )
}
