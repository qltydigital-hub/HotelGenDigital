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
  Hotel,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

function PresentationFunnelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Start on login screen if URL has ?login=settings
  const initialSlide = searchParams.get('login') === 'settings' ? 6 : 0;
  const initialModal = searchParams.get('login') === 'settings' ? 'settings' : 'none';

  const [slide, setSlide] = useState(initialSlide);
  const [showModals, setShowModals] = useState<'none' | 'settings' | 'admin'>(initialModal as any);

  // Login States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Clear states when modal changes
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError('');
    setShowPassword(false);
  }, [showModals]);

  const nextSlide = () => {
    if (slide < slides.length) {
      setSlide((prev) => prev + 1);
    }
  };

  const handleSettingsLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toUpperCase();
    const cleanPass = password.trim();

    if (cleanUser === 'F/O' && cleanPass === '1234') {
      router.push('/settings/fo');
    } else if (cleanUser === 'F/B' && cleanPass === '1234') {
      router.push('/settings/fb');
    } else if (cleanUser === 'G/R' && cleanPass === '1234') {
      router.push('/settings/gr');
    } else if (cleanUser === 'H/K' && cleanPass === '1234') {
      router.push('/settings/hk');
    } else if (cleanUser === 'SPA' && cleanPass === '1234') {
      router.push('/settings/spa');
    } else {
      setError(`Geçersiz departman ("${username}") veya hatalı şifre.`);
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
      icon: <Hotel className="w-12 h-12 md:w-16 md:h-16 text-blue-500 mb-2 md:mb-6" />,
      title: "7/24 Full Performanslı Birini İşe Almak Size ve Otelinize Ne Sağlayabilir?",
      subtitle: "HotelGenDigital ile tanışma zamanı.",
      content: "Hiç yorulmayan, asla hata yapmayan ve misafirinizin ne istediğini o daha söylemeden bilen bir ekip arkadaşı hayal edin. HotelGenDigital, operasyonun en karmaşık anlarında bile arka planda sessizce mükemmelliği yönetir. Siz kahvenizi yudumlarken, o her şeyi kontrol altında tutar. Oyunun kuralları artık değişiyor; sadece bir yazılım değil, otelinizin en sadık ve en zeki çalışanını işe alıyorsunuz.",
      actionText: "Devam Et"
    },
    {
      id: "multi-language",
      icon: <Globe2 className="w-12 h-12 md:w-16 md:h-16 text-cyan-400 mb-2 md:mb-6" />,
      title: "Sınırsız Dil, Sıfır Hata: Dünyanın Tüm Dillerini Konuşan Bir Resepsiyonist",
      content: (
        <span>
          Bilgi kirliliği ve yanlış yönlendirme, otelcilikte prestij kaybının en kısa yoludur. Bizim sistemimiz ise verdiğiniz bilgileri bir <strong className="font-bold text-white">&quot;anayasa&quot; gibi benimser</strong>. Hangi dilde sorulursa sorulsun; kahvaltı saatinden iptal politikasına kadar her şeyi <strong className="font-bold text-white">tam da sizin öğrettiğiniz gibi, sıfır hata payıyla yanıtlar</strong>. Personel yorulur veya unutur, ancak bu sistem sizin <strong className="font-bold text-white">belirlediğiniz sınırların dışına asla çıkmadan</strong>, dünya dillerinde kusursuz bir hizmet sunar.
        </span>
      ),
      actionText: "Devam Et"
    },
    {
      id: "perfect-employee",
      icon: <Clock className="w-12 h-12 md:w-16 md:h-16 text-green-400 mb-2 md:mb-6" />,
      title: "7/24 Kusursuz Mesai: Mazeretlerin Bittiği, Performansın Başladığı Nokta",
      content: (
        <span>
          &quot;Bugün hastayım,&quot; &quot;Geç kaldım&quot; veya &quot;Yanlış anladım&quot; cümlelerini <strong className="font-bold text-white">otelinizin lügatinden siliyoruz.</strong> Operasyonun sürekliliği artık tesadüflere veya bireysel ruh hallerine bağlı değil. HotelGenDigital, <strong className="font-bold text-white">365 gün boyunca aynı enerji ve titizlikle</strong> görevini yerine getirir. Siz uyurken veya başka bir krizle uğraşırken, o nöbet yerini bir saniye bile terk etmeden otelinizi en iyi şekilde temsil etmeye devam eder. <strong className="font-bold text-white">Denetlemeye gerek duymadığınız bir profesyonellik hayal edin.</strong>
        </span>
      ),
      actionText: "Devam Et"
    },
    {
      id: "smart-routing",
      icon: <BellRing className="w-12 h-12 md:w-16 md:h-16 text-orange-400 mb-2 md:mb-6" />,
      title: "Anında Doğru Departman: Hata Payı Olmayan Bir Yönlendirme Sistemi",
      content: (
        <span>
          <strong className="font-bold text-white">Otelcilikte hız, en büyük lükstür.</strong> Yanlış departmana iletilen bir şikayet, geri dönülemez bir kötü yoruma dönüşebilir. Sistemimiz, misafirin her kelimesini anlar ve <strong className="font-bold text-white">ilgili departmanı (F&B, Resepsiyon veya Teknik) anında ayağa kaldırır.</strong> Personeliniz sadece kendi görev alanına giren işlerin bildirimini alırken, yönetim olarak siz tüm bu trafiğin kusursuz bir saat gibi işleyişini izlersiniz. Kimse <strong className="font-bold text-white">&quot;bana haber gelmedi&quot; diyemez;</strong> çünkü <strong className="font-bold text-white">sistem asla unutmaz ve asla yanlış kapıyı çalmaz.</strong>
        </span>
      ),
      actionText: "Devam Et"
    },
    {
      id: "reporting",
      icon: <BarChart4 className="w-12 h-12 md:w-16 md:h-16 text-purple-400 mb-2 md:mb-6" />,
      title: "Anlık Raporlama Gücü: Otelinizin Nabzı Bir Cümle Uzağınızda",
      content: (
        <span>
          <strong className="font-bold text-white">Rapor beklemekle vakit kaybetmeyin.</strong> Sesli veya yazılı bir talimatınız yeterli; istediğiniz tarih aralığındaki tüm veriler <strong className="font-bold text-white">saniyeler içinde masanızda.</strong> Siz sadece sorun, <strong className="font-bold text-white">HotelGenDigital anında yanıtlasın.</strong>
        </span>
      ),
      actionText: "Devam Et"
    },
    {
      id: "closing",
      icon: <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-teal-400 mb-2 md:mb-6" />,
      title: "Tek Bir Amaç: Kusursuz Misafir Deneyimi ve Memnuniyeti, Sürdürülebilir Başarı",
      content: (
        <span>
          Bizim için başarı; <strong className="font-bold text-white">hatasız bir operasyon, mutlu bir misafir ve her geçen gün büyüyen bir işletmedir.</strong> Amacımız, otelinizi dijital çağın standartlarına taşıyarak size <strong className="font-bold text-white">rakiplerinizin ötesinde bir vizyon kazandırmak.</strong> İşinizi geliştirmek ve yarını bugünden inşa etmek için ihtiyacınız olan her şeyi <strong className="font-bold text-white">tek bir yapıda topladık.</strong> Şimdi, bu değişimin parçası olma zamanı.
        </span>
      ),
      actionText: "Evet, Kesinlikle Doğru."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center relative overflow-hidden font-sans text-white">
      {/* Test Hotel Background Image */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1542314831-c6a4d14d837e?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      {/* Background Effects */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, 60, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[150px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.5, 0.2],
          x: [0, -60, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/30 rounded-full blur-[150px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.1, 0.3, 0.1],
          y: [0, 50, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none"
      />

      {/* Top Navigation Options */}
      {slide < slides.length && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:top-10 md:right-10 flex flex-row gap-2 sm:gap-3 z-50 w-max">
          <button
            onClick={() => { setSlide(slides.length); setShowModals('settings'); }}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-medium text-slate-300 backdrop-blur-md shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Sisteme Giriş Yapın</span>
            <span className="sm:hidden">Sistem</span>
          </button>
          <button
            onClick={() => { setSlide(slides.length); setShowModals('admin'); }}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 rounded-lg text-[10px] md:text-xs font-medium text-purple-200 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">VIP Yönetici Girişi</span>
            <span className="sm:hidden">VIP Giriş</span>
          </button>
        </div>
      )}

      {/* Presentation Container */}
      <AnimatePresence mode="wait">
        {slide < slides.length ? (
          <motion.div
            key={`slide-${slide}`}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 1.05 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[95%] md:max-w-5xl lg:max-w-7xl w-full px-4 sm:px-6 md:px-8 flex flex-col items-center text-center z-10"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: [0, -12, 0] }}
              transition={{
                scale: { type: 'spring', stiffness: 200, damping: 12, delay: 0.2 },
                opacity: { delay: 0.2 },
                y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-150" />
              <div className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {slides[slide].icon}
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[1.5rem] xs:text-[1.75rem] sm:text-3xl md:text-5xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight mb-3 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-300 pb-1 md:pb-2 leading-[1.15] drop-shadow-2xl w-full max-w-6xl mx-auto px-2"
            >
              {slides[slide].title}
            </motion.h1>

            {slides[slide].subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[14px] xs:text-[15px] sm:text-lg md:text-2xl text-blue-400 font-medium mb-3 md:mb-4"
              >
                {slides[slide].subtitle}
              </motion.p>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[14px] xs:text-[16px] sm:text-[17px] md:text-xl lg:text-2xl text-slate-300 leading-[1.5] md:leading-[2] font-light w-full max-w-full lg:max-w-6xl mb-6 md:mb-12 px-2 md:px-0"
            >
              {slides[slide].content}
            </motion.p>

            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0px 0px 25px rgba(255, 255, 255, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={nextSlide}
              className={`group relative overflow-hidden flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-[15px] md:text-lg shadow-2xl transition-all ${slide === slides.length - 1
                  ? 'bg-teal-500 hover:bg-teal-400 text-white shadow-[0_0_20px_rgba(20,184,166,0.5)]'
                  : 'bg-white text-slate-900 border-2 border-transparent hover:border-blue-300 hover:bg-blue-50 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                }`}
            >
              <div className="absolute inset-0 bg-white/40 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out skew-x-12" />
              <span className="relative z-10 flex items-center gap-3">
                {slides[slide].actionText}
                {slide !== slides.length - 1 && <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </motion.button>

            {/* Pagination Dots */}
            <div className="flex gap-2 mt-5 md:mt-16">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-6 md:w-8 bg-blue-500' : 'w-1.5 md:w-2 bg-slate-700'}`}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          /* Final Action State (Login Modules) */
          <motion.div
            key="login-panels"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl w-full px-4 md:px-6 flex flex-col items-center z-10"
          >
            <div className="text-center mb-8 md:mb-16 relative w-full flex flex-col items-center">
              <button
                onClick={() => { setSlide(0); setShowModals('none'); }}
                className="absolute left-0 top-0 md:top-2 flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-3 py-2 rounded-lg backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base hidden sm:inline">Sunuma Dön</span>
              </button>
              <CheckCircle2 className="w-16 h-16 md:w-20 md:h-20 text-teal-400 mx-auto mb-4 md:mb-6" />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2 md:mb-4">Sisteme Giriş Yapın</h2>
              <p className="text-[15px] sm:text-xl text-slate-400 font-light">Lütfen yetkili olduğunuz alanı seçerek devam edin.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 md:gap-8 w-full">
              {/* Sistem Ayarları Button/Modal */}
              <motion.div
                whileHover={{ y: -5 }}
                onMouseEnter={() => setShowModals('settings')}
                onClick={() => setShowModals('settings')}
                className={`relative group bg-slate-900/50 backdrop-blur-xl border-2 transition-all duration-500 rounded-3xl p-5 sm:p-8 overflow-hidden cursor-pointer ${showModals === 'settings' ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.2)]' : 'border-slate-800 hover:border-slate-600'}`}
              >
                <div className={`absolute inset-0 bg-blue-500/5 transition-opacity duration-500 ${showModals === 'settings' ? 'opacity-100' : 'opacity-0'}`} />

                {showModals !== 'settings' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 sm:py-12">
                    <Settings className="w-12 h-12 md:w-16 md:h-16 text-blue-500 mb-4 md:mb-6 group-hover:rotate-90 transition-transform duration-700" />
                    <h3 className="text-xl sm:text-2xl font-bold mb-2">Hotel Sistem Ayarları</h3>
                    <p className="text-sm sm:text-base text-slate-400">Konsept bilgi ve belgelerini yüklemek için giriş yapın.</p>
                  </div>
                ) : (
                  <motion.form
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onSubmit={handleSettingsLogin}
                    className="flex flex-col h-full relative z-10"
                  >
                    <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                      <div className="p-2 md:p-3 bg-blue-500/20 rounded-xl"><Settings className="w-6 h-6 md:w-8 md:h-8 text-blue-500" /></div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold">Hotel Sistem Ayarları</h3>
                        <p className="text-xs md:text-sm text-blue-400">Veri Ekip Paneli</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-4 md:mb-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Departman Kodu</label>
                        <div className="relative">
                          <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500" placeholder="Örn: F/O, F/B, vb." />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Şifre</label>
                        <div className="relative">
                          <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white focus:outline-none focus:border-blue-500" placeholder="••••" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {error && showModals === 'settings' && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button type="submit" className="mt-auto w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
                      Giriş Yap
                    </button>
                  </motion.form>
                )}
              </motion.div>

              {/* Yönetici Paneli Button/Modal */}
              <motion.div
                whileHover={{ y: -5 }}
                onMouseEnter={() => setShowModals('admin')}
                onClick={() => setShowModals('admin')}
                className={`relative group bg-slate-900/50 backdrop-blur-xl border-2 transition-all duration-500 rounded-3xl p-5 sm:p-8 overflow-hidden cursor-pointer ${showModals === 'admin' ? 'border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.2)]' : 'border-slate-800 hover:border-slate-600'}`}
              >
                <div className={`absolute inset-0 bg-purple-500/5 transition-opacity duration-500 ${showModals === 'admin' ? 'opacity-100' : 'opacity-0'}`} />

                {showModals !== 'admin' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6 sm:py-12">
                    <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-purple-500 mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500" />
                    <h3 className="text-xl sm:text-2xl font-bold mb-2">Yönetici Paneli</h3>
                    <p className="text-sm sm:text-base text-slate-400">Üst Düzey Yönetici ve İletişim yetkileri.</p>
                  </div>
                ) : (
                  <motion.form
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onSubmit={handleAdminLogin}
                    className="flex flex-col h-full relative z-10"
                  >
                    <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                      <div className="p-2 md:p-3 bg-purple-500/20 rounded-xl"><ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-purple-500" /></div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold">VIP Yönetici Girişi</h3>
                        <p className="text-xs md:text-sm text-purple-400">Sadece Yetkili Yöneticiler</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-4 md:mb-6">
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
                          <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white focus:outline-none focus:border-purple-500" placeholder="••••••••" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {error && showModals === 'admin' && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button type="submit" className="mt-auto w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">
                      Yetkili Girişi Yap
                    </button>
                  </motion.form>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PresentationFunnel() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0a0f1c]" />}>
      <PresentationFunnelContent />
    </React.Suspense>
  )
}
