"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  CheckCircle2, 
  Settings, 
  ShieldCheck,
  Globe2,
  Clock,
  BellRing,
  BarChart4,
  Target,
  ArrowRight,
  Lock,
  User,
  KeyRound,
  Hotel
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PresentationFunnel() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [showModals, setShowModals] = useState<'none' | 'settings' | 'admin'>('none');
  
  // Login States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const nextSlide = () => {
    if (slide < slides.length) {
      setSlide((prev) => prev + 1);
    }
  };

  const handleSettingsLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      router.push('/settings');
    } else {
      setError('Hatalı kullanıcı adı veya şifre.');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      (username === 'OzgurOZEN' && password === 'OzgurOZEN?=') ||
      (username === 'Kemal KUYUCU' && password === 'KemalKUYUCU?=')
    ) {
      router.push('/admin-panel'); // Yöneticileri yetki paneline alıyoruz
    } else {
      setError('Yetkisiz giriş veya hatalı şifre.');
    }
  };

  const slides = [
    {
      id: "intro",
      icon: <Hotel className="w-16 h-16 text-blue-500 mb-6" />,
      title: "Bu değişim hotelinize ne katacak ve neden önemli?",
      subtitle: "HotelGenDigital ile tanışma zamanı.",
      content: "Hem şahsınız hem de otel işletmeniz için oyunun kurallarını nasıl değiştirebileceğimizi keşfedin.",
      actionText: "Sunuma Başla"
    },
    {
      id: "multi-language",
      icon: <Globe2 className="w-16 h-16 text-cyan-400 mb-6" />,
      title: "Sınırsız Dil, Sıfır Hata",
      content: "Size gelen bütün sorulara, hangi dilde yazılırsa yazılsın sistem anında kendi dilinde cevap verir. Oteliniz hakkında A’dan Z’ye hangi soru gelirse gelsin, belirlediğiniz sınırların ve kuralların asla dışına çıkmaz.",
      actionText: "Devam Et"
    },
    {
      id: "perfect-employee",
      icon: <Clock className="w-16 h-16 text-green-400 mb-6" />,
      title: "7/24 Kusursuz Mesai",
      content: "En büyük farkımız; asla durmamasıdır. Motivasyon kaybı, moral bozukluğu, alınma, darılma, yanlış anlama, hastalanma, mazeret bulma veya gecikme ihtimali %0'dır.",
      actionText: "Devam Et"
    },
    {
      id: "smart-routing",
      icon: <BellRing className="w-16 h-16 text-orange-400 mb-6" />,
      title: "Anında Doğru Departman",
      content: "Misafirlerin sorduğu standart sorular dışında özel bir istek, şikayet veya ekstra hizmet talebi gelirse; ilgili departmana (Resepsiyon, F&B, vb.) anında bildirim ve çağrı olarak düşer.",
      actionText: "Devam Et"
    },
    {
      id: "reporting",
      icon: <BarChart4 className="w-16 h-16 text-purple-400 mb-6" />,
      title: "Anlık Raporlama Gücü",
      content: "Dilediğiniz an, sadece sesli komut vererek veya metin yazarak performans durumunu sorun. Sistem o an bulunduğunuz tarih aralığındaki mükemmel raporu saniyeler içinde masanıza koysun.",
      actionText: "Devam Et"
    },
    {
      id: "closing",
      icon: <CheckCircle2 className="w-16 h-16 text-teal-400 mb-6" />,
      title: "Bunun Asıl Amacı Nedir?",
      content: "Tüm bu sistemin tek bir amacı var: İşinizi çok daha iyi geliştirmek, misafir memnuniyetini kusursuza taşımak ve bir sonraki vizyon adımını en doğru şekilde atabilmek.",
      actionText: "Evet, Kesinlikle Doğru."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center relative overflow-hidden font-sans text-white">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navigation Options */}
      {slide < slides.length && (
        <div className="absolute top-6 right-6 md:top-10 md:right-10 flex flex-col sm:flex-row gap-2 sm:gap-3 z-50">
          <button 
            onClick={() => { setSlide(slides.length); setShowModals('settings'); }} 
            className="px-4 py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs font-medium text-slate-300 backdrop-blur-md shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Sisteme Giriş Yapın</span>
            <span className="sm:hidden">Sistem</span>
          </button>
          <button 
            onClick={() => { setSlide(slides.length); setShowModals('admin'); }} 
            className="px-4 py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 rounded-lg text-xs font-medium text-purple-200 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">VIP Yönetici Girişi</span>
            <span className="sm:hidden">VIP Giriş</span>
          </button>
        </div>
      )}

      {/* Presentation Container */}
      {slide < slides.length ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 1.05 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl w-full px-6 flex flex-col items-center text-center z-10"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              {slides[slide].icon}
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white pb-2 leading-tight md:leading-tight drop-shadow-lg"
            >
              {slides[slide].title}
            </motion.h1>

            {slides[slide].subtitle && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl md:text-2xl text-blue-400 font-medium mb-4"
              >
                {slides[slide].subtitle}
              </motion.p>
            )}

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-2xl text-slate-300 leading-[1.8] md:leading-[2.2] font-light max-w-3xl mb-12"
            >
              {slides[slide].content}
            </motion.p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={nextSlide}
              className={`group flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg shadow-2xl transition-all ${
                slide === slides.length - 1 
                  ? 'bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/30' 
                  : 'bg-white text-slate-900 border-2 border-transparent hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {slides[slide].actionText}
              {slide !== slides.length - 1 && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </motion.button>

            {/* Pagination Dots */}
            <div className="flex gap-2 mt-16">
              {slides.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700'}`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        /* Final Action State (Login Modules) */
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-5xl w-full px-6 flex flex-col items-center z-10"
          >
            <div className="text-center mb-16">
              <CheckCircle2 className="w-20 h-20 text-teal-400 mx-auto mb-6" />
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Sisteme Giriş Yapın</h2>
              <p className="text-xl text-slate-400 font-light">Lütfen yetkili olduğunuz alanı seçerek devam edin.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 w-full">
              {/* Sistem Ayarları Button/Modal */}
              <div 
                onMouseEnter={() => setShowModals('settings')}
                className={`relative group bg-slate-900/50 backdrop-blur-xl border-2 transition-all duration-500 rounded-3xl p-8 overflow-hidden cursor-pointer ${showModals === 'settings' ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.2)]' : 'border-slate-800'}`}
              >
                <div className={`absolute inset-0 bg-blue-500/5 transition-opacity duration-500 ${showModals === 'settings' ? 'opacity-100' : 'opacity-0'}`} />
                
                {showModals !== 'settings' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Settings className="w-16 h-16 text-blue-500 mb-6 group-hover:rotate-90 transition-transform duration-700" />
                    <h3 className="text-2xl font-bold mb-2">Sistem Ayarları</h3>
                    <p className="text-slate-400">Konsept bilgi ve belgelerini yüklemek için giriş yapın.</p>
                  </div>
                ) : (
                  <motion.form 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onSubmit={handleSettingsLogin} 
                    className="flex flex-col h-full relative z-10"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-blue-500/20 rounded-xl"><Settings className="w-8 h-8 text-blue-500" /></div>
                      <div>
                        <h3 className="text-xl font-bold">Sistem Ayarları</h3>
                        <p className="text-sm text-blue-400">Veri Ekip Paneli</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Kullanıcı Adı</label>
                        <div className="relative">
                          <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500" placeholder="admin" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Şifre</label>
                        <div className="relative">
                          <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500" placeholder="••••" />
                        </div>
                      </div>
                    </div>

                    {error && showModals==='settings' && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button type="submit" className="mt-auto w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
                      Giriş Yap
                    </button>
                  </motion.form>
                )}
              </div>

              {/* Yönetici Paneli Button/Modal */}
              <div 
                onMouseEnter={() => setShowModals('admin')}
                className={`relative group bg-slate-900/50 backdrop-blur-xl border-2 transition-all duration-500 rounded-3xl p-8 overflow-hidden cursor-pointer ${showModals === 'admin' ? 'border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.2)]' : 'border-slate-800'}`}
              >
                <div className={`absolute inset-0 bg-purple-500/5 transition-opacity duration-500 ${showModals === 'admin' ? 'opacity-100' : 'opacity-0'}`} />
                
                {showModals !== 'admin' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <ShieldCheck className="w-16 h-16 text-purple-500 mb-6 group-hover:scale-110 transition-transform duration-500" />
                    <h3 className="text-2xl font-bold mb-2">Yönetici Paneli</h3>
                    <p className="text-slate-400">Üst Düzey Yönetici ve İletişim yetkileri.</p>
                  </div>
                ) : (
                  <motion.form 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onSubmit={handleAdminLogin} 
                    className="flex flex-col h-full relative z-10"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-purple-500/20 rounded-xl"><ShieldCheck className="w-8 h-8 text-purple-500" /></div>
                      <div>
                        <h3 className="text-xl font-bold">VIP Yönetici Girişi</h3>
                        <p className="text-sm text-purple-400">Sadece Yetkili Yöneticiler</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Yönetici Kullanıcı Adı</label>
                        <div className="relative">
                          <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500" placeholder="Örn: OzgurOZEN" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Yönetici Parolası</label>
                        <div className="relative">
                          <KeyRound className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500" placeholder="••••••••" />
                        </div>
                      </div>
                    </div>

                    {error && showModals==='admin' && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button type="submit" className="mt-auto w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">
                      Yetkili Girişi Yap
                    </button>
                  </motion.form>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
