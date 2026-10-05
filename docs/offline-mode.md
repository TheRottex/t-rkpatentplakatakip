# Çevrimdışı Kullanım

TPPlaka varsayılan olarak çevrimiçi çalışır. İsteğe bağlı çevrimdışı arama, `VITE_OFFLINE_ENABLED` ayarıyla açılıp kapatılır. Bu özellik ayrı bir misafir hesabı oluşturmaz ve giriş ekranına ek bir düğme koymaz.

## Çalışma şekli

- `VITE_OFFLINE_ENABLED=false`: Mevcut çevrimiçi çalışma. Sorgu, filo ve hesap işlemleri sunucu bağlantısı ister.
- `VITE_OFFLINE_ENABLED=true`: Yetkili kullanıcı çevrimiçiyken giriş yaptığında erişebildiği plaka listesinin tamamı bu tarayıcıya eşitlenir. İnternet yoksa arama ve filo listesi son eşitlenen kayıtlarla salt okunur çalışır.
- İlk eşitleme için cihazda internet varken normal hesapla giriş yapılmalıdır. Daha önce eşitlenmemiş yeni bir cihazda tamamen çevrimdışı ilk giriş mümkün değildir.
- Eşitleme girişte, uygulama açılışında veya çevrimdışı kullanım sonrası yeniden bağlanınca yapılır. Admin değişiklikleri sonraki eşitlemede cihaza gelir.
- Çevrimdışıyken plaka ekleme, silme, Excel/CSV aktarımı ve hesap işlemleri kullanılamaz.
- Önbellek aynı cihazın tarayıcı/PWA depolamasına aittir; cihazlar arasında eşitlenmez. Çıkış bu cihazdaki çevrimdışı kayıtları siler.
- Tarayıcı depolama baskısı, gizli mod veya kullanıcı temizliği veriyi silebilir. Çevrimdışı kopya kalıcı yedek değildir.

## Sunucuda açma veya kapama

`/opt/tpplaka/app/.env` içindeki diğer ayarları ve sırları koruyun. Şu satırı ekleyin veya güncelleyin:

```dotenv
VITE_OFFLINE_ENABLED=true
```

Ardından uygulama dizininde build alıp servisi yeniden başlatın:

```bash
cd /opt/tpplaka/app
npm run build
sudo systemctl restart tpplaka
systemctl is-active tpplaka
curl --fail --show-error http://127.0.0.1:4400/api/health
```

Kapatmak için satırı `VITE_OFFLINE_ENABLED=false` yapıp build ve restart adımlarını tekrarlayın. Ayar build sırasında arayüze gömülür; `.env` değerini tek başına değiştirmek çalışan arayüzü değiştirmez. `vite.config.js`, proje kökündeki `.env` dosyasını okur. Yalnızca `VITE_` değişkenleri istemci paketine aktarılır; JWT/Vortex sırlarını bu önekle adlandırmayın.

Yeni kod gerekiyorsa build öncesi sunucuda `git pull --ff-only` kullanın. Gerçek kişi/plaka verisi içeren `.env`, JSON ve CSV dosyalarını GitHub'a göndermeyin.

## İlk eşitleme

1. `VITE_OFFLINE_ENABLED=true` ile build alın ve servisi yeniden başlatın.
2. Kullanıcının çevrimdışı kullanacağı aynı tarayıcıyı veya ana ekrana eklenen PWA'yı internet varken açın.
3. Normal yetkili hesapla giriş yapın. Eşitleme bildirimi görünce cihaz hazırdır.
4. Sonrasında internet olmadan uygulamayı açıp plaka arayabilirsiniz. Çıkış yapılırsa cihazdaki çevrimdışı kopya da silinir.

## Veri güvenliği

Çevrimdışı arama için sürücü adı, plaka ve varsa konum bilgileri tarayıcı yerel depolamasında tutulur; uygulama bu depolamayı şifrelemez. Özelliği yalnızca erişimi kontrol edilen, ekran kilitli cihazlarda açın. Paylaşılan cihazlarda kullanmayın; cihaz kaybolursa son eşitlenen verinin açığa çıkabileceğini varsayın.
