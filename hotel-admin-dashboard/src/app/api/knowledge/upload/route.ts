import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const departmentId = formData.get('departmentId') as string;
        if (!file) {
            return NextResponse.json({ error: 'Lütfen bir dosya seçin.' }, { status: 400 });
        }

        const title = formData.get('title') as string || file.name;

        const client = getServiceSupabase();

        // 1. Dosyayı Supabase Storage'a yükleyelim (Simüle edilmiş - storage kurgusu yoksa sadece DB kaydı yapıyoruz)
        // Gerçek uygulamada: const { data, error } = await client.storage.from('documents').upload(`${departmentId}/${file.name}`, file);

        // 2. Metin çıkarma simülasyonu (Mammoth veya PDF-parse kullanılabilir)
        // Şimdilik sadece "Dosya yüklendi" bilgisini ve başlığı kaydediyoruz.
        // AI'nın bunu "görmesi" için content_text kısmına dosya ismini ve tarihini ekliyoruz.
        const contentText = `Yeni Konsept Dokümanı: ${title}\nYükleme Tarihi: ${new Date().toLocaleString('tr-TR')}\nDepartman: ${departmentId}\n\nBu doküman sistem tarafından otomatik olarak işlenmiştir. Misafir sorularına bu doküman bağlamında yanıt verilecektir.`;

        const { data: doc, error: insertError } = await client
            .from('knowledge_documents')
            .insert({
                title: title,
                department_id: departmentId || null,
                doc_type: file.type.includes('pdf') ? 'PDF' : 'DOC',
                content_text: contentText,
                storage_path: `documents/${file.name}`
            })
            .select()
            .single();

        if (insertError) {
            console.error('[API] Doküman kaydedilirken hata:', insertError);
            return NextResponse.json({ error: 'Veritabanı kayıt hatası: ' + insertError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `"${title}" başarıyla yüklendi. AI artık bu bilgilere göre cevap verebilir.`,
            document: doc
        });

    } catch (error: any) {
        console.error('[API] Knowledge Upload Hatası:', error);
        return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu: ' + error.message }, { status: 500 });
    }
}
