# TPPlaka Kullanım Kılavuzu

TPPlaka, yetkili kullanıcıların araç plakalarını arayıp kayıtlı blok ve daire bilgisini görmesini sağlar. Sorgu ve filo için giriş gerekir.

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
3. Eşleşme varsa blok ve daire bilgisi görünür. Benzer sonuçlardan birine dokunarak doğru plakayı seçebilirsiniz.

Plaka araması uygulama sunucusuna bağlanır; internet bağlantısı gerekir. Uygulama simgesinin telefonda bulunması veriyi çevrimdışı kullanılabilir yapmaz.

## Hesap ve filo

- **Hesap** sekmesinden e-posta ve en az 8 karakterli parola ile kayıt olun veya giriş yapın.
- Sunucu Vortex'e bağlıysa giriş Vortex üzerinden doğrulanır; değilse yerel hesap kullanılır.
- Yeni hesaplar normal kullanıcıdır. Yönetici hesabı yalnızca sunucu yöneticisi tarafından bootstrap komutuyla oluşturulur. Yöneticiler **Filo** sekmesinden kayıt ekleyip silebilir.
- Diğer hesaplar filo listesini görüntüleyebilir; kayıt değiştiremez.

## Yönetici: plaka ekleme ve dosya aktarma

1. **Filo** sekmesini açın.
2. Tek kayıt için **Yeni plaka ekle** bölümünde plaka, blok ve daireyi girip **Plakayı ekle**'ye dokunun.
3. Toplu kayıt için **Excel veya CSV aktar** bölümünden `.xlsx` veya `.csv` dosyası seçin ve **Dosyayı aktar**'a dokunun.
4. Excel dosyasının ilk sayfasında `plaka`, `blok`, `daire` sütun başlıkları bulunmalıdır. CSV, başlık satırıyla veya `plaka;blok;daire` sütun sırasıyla hazırlanabilir.
5. Dosya 5 MB'ı ve 10.000 satırı aşmamalıdır. Var olan plakalar yinelenen sayılır ve tekrar eklenmez; sonuç bildirimi kaç kaydın eklendiğini gösterir.

Bu yönetim alanları yalnızca `admin` hesabında görünür. Normal kullanıcı hesabınız varsa site yöneticisinden admin yetkisi isteyin.

## Yardım

Uygulama açılamıyorsa veya arama sonuç vermiyorsa internet bağlantısını kontrol edin. Sorun sürerse site yöneticisine bildirin; plaka kayıtları ve uygulama sunucusunu yönetici kontrol eder.
