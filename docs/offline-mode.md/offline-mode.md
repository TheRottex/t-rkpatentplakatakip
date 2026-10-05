# Çevrimdışı Kullanım

TPPlaka varsayılan olarak çevrimiçi çalışır. İsteğe bağlı çevrimdışı arama, `VITE_OFFLINE_ENABLED` ayarıyla açılıp kapatılır. Bu özellik ayrı bir misafir hesabı oluşturmaz ve giriş ekranına ek bir düğme koymaz.

## Çalışma şekli

- `VITE_OFFLINE_ENABLED=false`: Mevcut çevrimiçi çalışma. Sorgu, filo ve hesap işlemleri sunucu bağlantısı ister.
- `VITE_OFFLINE_ENABLED=true`: Yetkili kullanıcı çevrimiçiyken giriş yaptığında erişebildiği plaka listesinin tamamı bu tarayıcıya eşitlenir. Daha sonra internet yoksa arama ve filo listesi son eşitlenen kayıtlarla salt okunur çalışır.
- İlk eşitleme için cihazda internet bağlantısı varken normal hesapla giriş yapılmalıdır. Daha önce eşitlenmemiş yeni bir cihazda tamamen çevrimdışı ilk giriş mümkün değildir.
- Eşitleme girişte, uygulama açılışında veya çevrimdışı kullanım sonrası yeniden bağlanınca yapılır. Admin değişiklikleri de sonraki eşitlemede cihaza gelir.
- Çevrimdışıyken plaka ekleme, silme, Excel/CSV aktarımı ve hesap işlemleri kullanılamaz.
- Önbellek aynı cihaz ve aynı tarayıcı/PWA depolamasına aittir; cihazlar arasında senkronize edilmez. Çıkış yapmak bu cihazdaki çevrimdışı kayıtları siler.
- Tarayıcı veriyi depolama baskısı, gizli mod veya kullanıcı tarafından temizleme gibi nedenlerle silebilir. Çevrimdışı kopya kalıcı yedek değildir.

## Sunucuda açma veya kapama

`/opt/tpplaka/app/.env` dosyasındaki diğer ayarları ve sırları koruyun. Dosyada şu satırı ekleyin veya güncelleyin:

```dotenv
VITE_OFFLINE_ENABLED=true
```

Ardından uygulama dizininde derleyip servisi yeniden başlatın:

```bash
cd /opt/tpplaka/app
npm run build
sudo systemctl restart tpplaka
systemctl is-active tpplaka
curl --fail --show-error http://127.0.0.1:4400/api/health
```

Kapamak için aynı satırı `VITE_OFFLINE_ENABLED=false` yapıp build ve restart adımlarını tekrarlayın. Bu değer build sırasında arayüze gömülür; `.env` satırını değiştirmek tek başına çalışan arayüzü değiştirmez. `vite.config.js`, proje kökündeki `.env` dosyasını okur. Yalnızca `VITE_` ile başlayan değişkenler istemci paketine aktarılır; JWT/Vortex sırlarını bu önekle adlandırmayın.

Yeni kodu GitHub'dan almak gerekiyorsa, build öncesi mevcut dağıtım rehberindeki `git pull --ff-only` adımını uygulayın. Sunucuda gerçek kişi/plaka verisi içeren `.env`, JSON veya CSV dosyalarını GitHub'a göndermeyin.

## İlk cihaz eşitlemesi

1. `VITE_OFFLINE_ENABLED=true` ile build alıp servisi yeniden başlatın.
2. Kullanıcının çevrimdışı kullanacağı aynı tarayıcıyı veya ana ekrana eklenmiş PWA'yı internet varken açın.
3. Normal yetkili hesapla giriş yapın. "kayıt çevrimdışı kullanım için eşitlendi" bildirimi tamamlanınca cihaz hazırdır.
4. Sonrasında internet bağlantısı olmadığında uygulamayı yeniden açıp plaka arayabilirsiniz. Hesap ekranında çıkış yapılırsa kayıtların cihaz kopyası da silinir.

## Veri güvenliği

Çevrimdışı arama için sürücü adı, plaka ve varsa konum bilgileri tarayıcının yerel depolamasında tutulur; bu depolama uygulama tarafından şifrelenmez. Özelliği yalnızca erişimi kontrol edilen, ekran kilidi bulunan cihazlarda açın. Paylaşılan cihazlarda kullanmayın; cihaz kaybolursa içindeki son eşitlenen verinin de açığa çıkabileceğini varsayın. Sunucu yetkileri ve sunucu tarafındaki giriş kontrolleri çevrimiçi işlemler için geçerliliğini korur.
