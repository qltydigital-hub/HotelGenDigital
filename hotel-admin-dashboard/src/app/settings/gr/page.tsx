"use client";
import React, { useState, useEffect } from 'react';
import { Settings, UploadCloud, HeartHandshake, Map, Star, LogOut, CheckSquare, Loader2, Gift, Save, Bell, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { uploadDocumentToSupabase, supabase } from '../../../lib/supabase-client';

export default function GuestRelationSettings() {
    const [uploadTimes, setUploadTimes] = useState<Record<string, string>>({});
    const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({});

    // Özel Organizasyon (Special Org) State
    const [specialOrgTelegramId, setSpecialOrgTelegramId] = useState("");
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Alerji Sorumlusu State
    const [allergyContacts, setAllergyContacts] = useState([{ id: 'init-1', email: '', telegram: '' }]);
    const [isSavingAllergy, setIsSavingAllergy] = useState(false);
    
    // Mock Veriler
    const mockSpecialRequests = [
        { id: 1, room: "201", name: "Mehmet Yılmaz", date: "12.03.26 - 18.03.26", req: "Evlilik Yıldönümü Sürprizi" },
        { id: 2, room: "305", name: "Anna Smith", date: "15.03.26 - 22.03.26", req: "Pavilion Rezervasyonu" },
        { id: 3, room: "410", name: "Ali Kaya", date: "14.03.26 - 19.03.26", req: "Doğum Günü Pastası" }
    ];

    useEffect(() => {
        // Load GR special org settings from db
        const loadSettings = async () => {
             // Simüle edilmiş fetch, normalde /api/settings vb. kullanılır
             try {
                 const res = await fetch('/api/settings');
                 const data = await res.json();
                 if(data.success) {
                     if(data.data.special_org_telegram_id) setSpecialOrgTelegramId(data.data.special_org_telegram_id);
                     if(data.data.allergy_contacts) {
                         setAllergyContacts(data.data.allergy_contacts);
                     } else if (data.data.allergy_contact_email || data.data.allergy_contact_id) {
                         setAllergyContacts([{ id: 'init-1', email: data.data.allergy_contact_email || '', telegram: data.data.allergy_contact_id || '' }]);
                     }
                 }
             } catch(e) {}
        };
        loadSettings();

        const loadUploadTimes = async () => {
            try {
                const { data, error } = await supabase
                    .from('hotel_documents')
                    .select('doc_type, created_at')
                    .eq('department', 'GR')
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

    const saveSpecialOrgId = async () => {
        setIsSavingOrg(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ special_org_telegram_id: specialOrgTelegramId })
            });
            alert("Özel Organizasyon ID başarıyla kaydedildi.");
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingOrg(false);
        }
    };

    const addAllergyContact = () => setAllergyContacts([...allergyContacts, { id: Date.now().toString(), email: '', telegram: '' }]);
    const removeAllergyContact = (id: string) => setAllergyContacts(allergyContacts.filter(c => c.id !== id));
    const updateAllergyContact = (id: string, field: 'email' | 'telegram', value: string) => {
        setAllergyContacts(allergyContacts.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const saveAllergyContact = async () => {
        setIsSavingAllergy(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    allergy_contacts: allergyContacts 
                })
            });
            alert("Alerji Bildirim Sorumluları başarıyla kaydedildi.");
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingAllergy(false);
        }
    };

    const handleGenericUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setIsUploadingObj(prev => ({ ...prev, [key]: true }));

            const result = await uploadDocumentToSupabase(file, 'GR', key);

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
                        <div className="bg-pink-600/20 p-4 rounded-2xl border border-pink-500/30">
                            <HeartHandshake className="w-8 h-8 text-pink-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight">G/R (Guest Relations) Paneli</h1>
                                <span className="px-3 py-1 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Yetkili</span>
                            </div>
                            <p className="text-slate-400 font-medium mt-1">G/R bilgileri, A'la Carte, VIP misafir listeleri ve aktivite yönetimi.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Link href="/settings" className="w-full sm:w-auto px-4 py-3 bg-slate-800/80 hover:bg-slate-700 rounded-xl font-bold transition-all border border-slate-700 text-slate-300 hover:text-white text-sm flex items-center justify-center gap-2">
                            ← Ayarlara Dön
                        </Link>
                        <Link href="/?login=settings" className="w-full sm:w-auto px-6 py-3 bg-red-900/40 hover:bg-red-800/60 rounded-xl font-bold transition-all border border-red-700/50 text-red-200 text-sm flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış Yap
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* A'la carte info */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['alacarte'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-pink-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['alacarte'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <UtensilsIcon className="w-6 h-6 text-pink-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['alacarte'] ? 'text-emerald-400' : ''}`}>A'la Carte İşleyiş ve Kuralları</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Misafirlerin restoran randevularını onaylama şartları, masa sayıları ve uygunlukları.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: Excel, Word, PDF</span></p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['alacarte'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['alacarte'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['alacarte'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-pink-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['alacarte'] ? 'text-emerald-400' : 'text-pink-400'}`}>{isUploadingObj['alacarte'] ? 'Yükleniyor...' : (uploadTimes['alacarte'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['alacarte'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleGenericUpload('alacarte', e)} disabled={isUploadingObj['alacarte']} />
                        </label>
                        {uploadTimes['alacarte'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['alacarte']}</div>
                        )}
                    </div>

                    {/* Etkinlik ve Harita */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all ${uploadTimes['activities'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-blue-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['activities'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Map className="w-6 h-6 text-blue-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['activities'] ? 'text-emerald-400' : ''}`}>Günlük Aktivite ve Şov Bilgileri</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">Akşam şovları, animasyon programı ve çocuk kulübü aktivite planlarını ekleyin.<br/><span className="text-blue-400 font-semibold mt-1 inline-block">Format: Excel, Word, PDF</span></p>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['activities'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['activities'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['activities'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-blue-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['activities'] ? 'text-emerald-400' : 'text-blue-400'}`}>{isUploadingObj['activities'] ? 'Yükleniyor...' : (uploadTimes['activities'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['activities'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleGenericUpload('activities', e)} disabled={isUploadingObj['activities']} />
                        </label>
                        {uploadTimes['activities'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['activities']}</div>
                        )}
                    </div>

                    {/* --- YENİ EKLENEN: ÖZEL ORGANİZASYON & PAVILION --- */}
                    <div className="md:col-span-2 bg-slate-900/50 border border-purple-500/30 rounded-3xl p-6 relative group hover:border-purple-500/60 transition-all flex flex-col xl:flex-row gap-8">
                        {/* Sol Kısım: Ayarlar & Açıklama */}
                        <div className="xl:w-1/3 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-purple-600/20 p-3 rounded-xl border border-purple-500/30">
                                        <Gift className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Özel Organizasyon & Ücretli Aktiviteler</h2>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed mb-6">Misafirlerin <strong>Doğum Günü, Evlilik Yıldönümü</strong> ve <strong>Pavilion</strong> gibi ücretli/özel organizasyon talepleri geldiğinde anında aşağıdaki ID'ye bildirim gönderilir.</p>
                                
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2"><Bell className="w-3.5 h-3.5"/> Bildirim Gidecek ID (Telegram/WP)</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input 
                                            type="text" 
                                            value={specialOrgTelegramId}
                                            onChange={(e) => setSpecialOrgTelegramId(e.target.value)}
                                            placeholder="Örn: 12345678"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                        />
                                        <button 
                                            onClick={saveSpecialOrgId}
                                            disabled={isSavingOrg}
                                            className="whitespace-nowrap bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                        >
                                            {isSavingOrg ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
                                            Kaydet
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sağ Kısım: Talep Tablosu (Örnek Görünüm) */}
                        <div className="xl:w-2/3 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner flex flex-col">
                            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                                Canlı Talep Ekranı Örneği
                            </h3>
                            <div className="overflow-x-auto w-full border border-slate-800/50 rounded-xl">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-slate-900 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                        <tr>
                                            <th className="px-4 py-3">Oda No</th>
                                            <th className="px-4 py-3">İsim Soyisim</th>
                                            <th className="px-4 py-3">Giriş - Çıkış Tarihi</th>
                                            <th className="px-4 py-3">Özel Talep / Konsept</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {mockSpecialRequests.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg border border-slate-700">{req.room}</span>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-200">{req.name}</td>
                                                <td className="px-4 py-3 text-xs font-mono text-slate-400">{req.date}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-[11px] font-bold">
                                                        {req.req}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-4 italic text-center">Not: Misafir yapay zekadan özel organizasyon talep ettiğinde yukarıdaki listeye otomatik yansır ve ID'nize bildirim iletilir.</p>
                        </div>
                    </div>

                    {/* VIP Listesi (Moved to bottom) */}
                    <div className={`border rounded-3xl p-6 relative overflow-hidden group transition-all md:col-span-2 ${uploadTimes['vip'] ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-yellow-500/30'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            {uploadTimes['vip'] ? <CheckSquare className="w-6 h-6 text-emerald-400" /> : <Star className="w-6 h-6 text-yellow-400" />}
                            <h2 className={`text-xl font-bold ${uploadTimes['vip'] ? 'text-emerald-400' : ''}`}>AI Öncelikli: VIP & Sadakat (Repeat) Misafir Öğrenme Alanı</h2>
                        </div>
                        
                        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl mb-6">
                            <p className="text-slate-300 text-sm leading-relaxed">
                                <strong className="text-blue-400">Amacı:</strong> Yapay zeka asistanının misafirlerle yazışırken sıradan bir misafir ile VIP/Repeat bir misafiri birbirinden ayırabilmesini sağlar.
                                <br/><br/>
                                Buraya yükleyeceğiniz listede adı geçen bir misafir, asistana mesaj attığında yapay zeka onu anında tanır. Sıradan bir karşılama yapmak yerine; <em>"Ahmet Bey tekrar hoş geldiniz, sadık misafirimiz olduğunuz için odanıza şarap ve meyve sepeti ikramımızın hazır edileceğini bildirmek isterim."</em> tarzı otelinizin belirlediği özel ve prestijli kurallara göre kişiselleştirilmiş cevap verir.
                            </p>
                            <span className="text-blue-400 font-semibold mt-3 inline-block text-xs">Desteklenen Format: Excel, Word, PDF</span>
                        </div>
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors group ${uploadTimes['vip'] ? 'border-emerald-500/50 hover:bg-emerald-900/20' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/50'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploadingObj['vip'] ? <Loader2 className="w-8 h-8 mb-2 animate-spin text-slate-400" /> : <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${uploadTimes['vip'] ? 'text-emerald-400' : 'text-slate-500 group-hover:text-yellow-400'}`} />}
                                <p className="mb-2 text-sm text-slate-400"><span className={`font-bold ${uploadTimes['vip'] ? 'text-emerald-400' : 'text-yellow-400'}`}>{isUploadingObj['vip'] ? 'Yükleniyor...' : (uploadTimes['vip'] ? 'Yeniden Yükle' : 'Tıklayın')}</span> {isUploadingObj['vip'] ? '' : 'veya sürükleyin'}</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleGenericUpload('vip', e)} disabled={isUploadingObj['vip']} />
                        </label>
                        {uploadTimes['vip'] && (
                            <div className="mt-4 text-xs font-medium text-emerald-400 text-center">Son Yükleme: <br/>{uploadTimes['vip']}</div>
                        )}
                    </div>

                    {/* YENİ: Alerjik Misafirler Uyarı Panosu (G/R Veri Paneli) */}
                    <div className="md:col-span-2 bg-slate-900/50 border border-rose-900/50 rounded-3xl p-6 relative group hover:border-rose-500/60 transition-all flex flex-col xl:flex-row gap-8">
                        <div className="xl:w-1/3 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-rose-600/20 p-3 rounded-xl border border-rose-500/30">
                                        <AlertCircle className="w-6 h-6 text-rose-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Aktif Alerjik Misafirler Panosu</h2>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed mb-6">Misafirlerin restoran rezervasyonu veya oda siparişi esnasında yapay zeka asistanına ilettiği <strong>alerji / sağlık bildirimleri</strong> burada anlık olarak raporlanır. Lütfen listeyi güncel tutun ve operasyona iletin.</p>
                                
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mt-4">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Bildirim Gidecek Sorumlu Personel</span>
                                    <p className="text-[11px] text-rose-400/80 mb-4 italic">Sistem alerjen riski saptadığında aşağıdaki e-posta ve mesaja acil uyarı gönderir:</p>
                                    
                                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                        {allergyContacts.map((contact, index) => (
                                            <div key={contact.id} className="relative bg-slate-900 border border-slate-700/50 p-3 rounded-xl flex flex-col gap-2 group">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-slate-400">#Sorumlu {index + 1}</span>
                                                    {allergyContacts.length > 1 && (
                                                        <button onClick={() => removeAllergyContact(contact.id)} className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg p-1.5 transition-all">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-bold uppercase">E-Posta Adresi</label>
                                                    <input 
                                                        type="email" 
                                                        value={contact.email}
                                                        onChange={(e) => updateAllergyContact(contact.id, 'email', e.target.value)}
                                                        placeholder="Örn: saglik@hotel.com"
                                                        className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-bold uppercase">Telegram / WP ID</label>
                                                    <input 
                                                        type="text" 
                                                        value={contact.telegram}
                                                        onChange={(e) => updateAllergyContact(contact.id, 'telegram', e.target.value)}
                                                        placeholder="Örn: 98765432"
                                                        className="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button 
                                            onClick={addAllergyContact}
                                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl transition-all border border-slate-700 text-xs flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Yeni Sorumlu Ekle
                                        </button>

                                        <button 
                                            onClick={saveAllergyContact}
                                            disabled={isSavingAllergy}
                                            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                                        >
                                            {isSavingAllergy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
                                            Listeyi Kaydet / Güncelle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="xl:w-2/3 flex flex-col space-y-4">
                            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center hover:bg-rose-500/10 transition-all border-l-4 border-l-rose-500">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-white font-bold text-lg">Oda: 305 - Ali Yılmaz</h3>
                                        <span className="px-3 py-1 bg-rose-600/80 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shadow-lg shadow-rose-900/50">Dikkat Edilmeli</span>
                                    </div>
                                    <p className="text-sm text-rose-300 font-medium">Gluten hassasiyeti - Ekmek ve makarna ürünleri tüketemiyor.</p>
                                    <p className="text-xs text-slate-500 mt-2">Bildirim: Bugün 14:20 | Restoran Sorgusu</p>
                                </div>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center hover:bg-rose-500/10 transition-all border-l-4 border-l-rose-500">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-white font-bold text-lg">Oda: 412 - Zeynep Demir</h3>
                                        <span className="px-3 py-1 bg-rose-600/80 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shadow-lg shadow-rose-900/50">Dikkat Edilmeli</span>
                                    </div>
                                    <p className="text-sm text-rose-300 font-medium">Çocuğunda fıstık alerjisi mevcut.</p>
                                    <p className="text-xs text-slate-500 mt-2">Bildirim: Dün 19:45 | Kahvaltı Menüsü</p>
                                </div>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center hover:bg-orange-500/10 transition-all border-l-4 border-l-orange-500">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-white font-bold text-lg">Oda: 102 - Mehmet Kaya</h3>
                                        <span className="px-3 py-1 bg-orange-600/80 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shadow-lg shadow-orange-900/50">BİLGİ</span>
                                    </div>
                                    <p className="text-sm text-orange-300 font-medium">Laktoz intoleransı - Süt ürünleri talep etmiyor.</p>
                                    <p className="text-xs text-slate-500 mt-2">Bildirim: 15 dk önce | Oda Servisi</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Temporary internal component for Icon
function UtensilsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}
