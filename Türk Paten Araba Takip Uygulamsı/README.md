# TPPlaka Kullanım Kılavuzu

TPPlaka, yetkili kullanıcıların araç plakasını ve kayıtlı sürücü adını aramasını sağlar. Blok ve daire bilgisi varsa ayrıca gösterilir. Sorgu ve filo için giriş gerekir.

## Android'e yükleme

1. Uygulamanın HTTPS bağlantısını Android telefonda **Chrome** ile açın.
2. Sağ üstteki üç nokta menüsüne dokunun.
3. **Uygulamayı yükle** veya **Ana ekrana ekle** seçeneğini seçip onaylayın.
4. Ana ekrandaki TPPlaka simgesine dokunarak uygulamayı açın.

## iPhone'a ekleme

1. Uygulamanın HTTPS bağlantısını iPhone'da **Safari** ile açın. Kurulum için başka tarayıcılar yerine Safari kullanın.
2. **Paylaş** düğmesine dokunun.
3. **Ana Ekrana Ekle**'yi seçin, adı kontrol edin ve **Ekle**'ye dokunun.
4. Ana ekrandaki TPPlaka simgesine dokunarak uygulamayı açın.

Bu yöntem uygulamayı App Store veya Google Play'den indirmez; güvenli web uygulamasını ana ekrana ekler. Kurulum seçeneği görünmüyorsa adresin HTTPS olduğundan ve desteklenen tarayıcıyı kullandığınızdan emin olun.

## Plaka sorgulama

1. **Hesap** sekmesinden giriş yapın veya hesap açın.
2. **Sorgula** sekmesini açıp plakayı yazın; boşluk veya tire kullanmanız gerekmez.
3. Eşleşme varsa sürücü adı görünür. Kayıtta blok ve daire varsa onlar da gösterilir; bu bilgiler kaynak dosyada yoksa ekranda yer almaz. Benzer sonuçlardan birine dokunarak doğru plakayı seçebilirsiniz.

Plaka araması uygulama sunucusuna bağlanır; internet bağlantısı gerekir. Uygulama simgesinin telefonda bulunması veriyi çevrimdışı kullanılabilir yapmaz.

## Hesap ve filo

- **Hesap** sekmesinden e-posta ve en az 8 karakterli parola ile kayıt olun veya giriş yapın.
- Sunucu Vortex'e bağlıysa giriş Vortex üzerinden doğrulanır; değilse yerel hesap kullanılır.
- Yeni hesaplar normal kullanıcıdır. Yönetici hesabı yalnızca sunucu yöneticisi tarafından bootstrap komutuyla oluşturulur. Yöneticiler **Filo** sekmesinden kayıt ekleyip silebilir.
- Diğer hesaplar filo listesini görüntüleyebilir; kayıt değiştiremez.

## Yönetici: plaka ekleme ve dosya aktarma

1. **Filo** sekmesini açın.
2. Tek kayıt için **Yeni plaka ekle** bölümünde sürücü adı, plaka, blok ve daireyi doldurup **Plakayı ekle**'ye dokunun.
3. Toplu kayıt için önce **Excel şablonunu indir** düğmesine dokunun. İlk sayfada `SÜRÜCÜ AD SOYAD` ve `PLAKA` sütunları zorunludur; `BLOK` ve `DAİRE` isteğe bağlıdır ve birlikte doldurulmalıdır.
4. Elinizdeki `PTS_Abone_Listesi_Excel.xlsx` dosyasını da doğrudan seçebilirsiniz; `SÜRÜCÜ AD SOYAD` ve `PLAKA` sütunları tanınır. Blok/daire yoksa isim ve plaka kaydı oluşturulur.
5. **Excel veya CSV aktar** alanından doldurduğunuz `.xlsx` veya `.csv` dosyasını seçin ve **Dosyayı aktar**'a dokunun. CSV'de başlıklı isim/plaka veya eski başlıksız `plaka;blok;daire` satırları kabul edilir.
6. Dosya 5 MB'ı ve 10.000 satırı aşmamalıdır. Var olan plakalar yinelenen sayılır ve tekrar eklenmez; sonuç bildirimi eklenen ve yinelenen sayısını gösterir.

Dosya aktarımı filo kaydı ekler; uygulama giriş hesabı oluşturmaz. Yalnızca yönetici bu ekleme ve aktarım işlemlerini yapabilir.

Bu yönetim alanları yalnızca `admin` hesabında görünür. Normal kullanıcı hesabınız varsa site yöneticisinden admin yetkisi isteyin.

## Yardım

Uygulama açılamıyorsa veya arama sonuç vermiyorsa internet bağlantısını kontrol edin. Sorun sürerse site yöneticisine bildirin; plaka kayıtları ve uygulama sunucusunu yönetici kontrol eder.
