# TPPlaka Sunucu Operasyonları

Bu rehber mevcut VPS düzenini belgelemek içindir. Komutlar yalnızca `tpplaka` servisini hedefler; Nginx'in diğer hostlarına veya sunucudaki diğer uygulamalara dokunmayın.

## Sunucu düzeni

```text
/opt/tpplaka/current                 Aktif uygulama sürümüne sembolik bağlantı
/opt/tpplaka/releases/<revision>     Sürüm kaynakları
/var/lib/tpplaka/data                Kalıcı JSON kullanıcı/plaka verisi
/etc/tpplaka/tpplaka.env             Gizli üretim değişkenleri
/etc/systemd/system/tpplaka.service  Uygulama servisi
```

Node süreci `tpplaka` adlı ayrı servis kullanıcısıyla ve `127.0.0.1:4400` üzerinde çalışır. Nginx HTTPS trafiğini bu loopback adrese aktarır; 4400 portu internete açılmaz.

## Durum ve sağlık kontrolü

```bash
systemctl status tpplaka
journalctl -u tpplaka -f
curl --fail http://127.0.0.1:4400/api/health
curl --fail https://tpplaka.rottexforge.com/api/health
```

Servis yönetimi gerektiğinde yalnızca TPPlaka servisini hedefleyin:

```bash
sudo systemctl restart tpplaka
```

## Yayınlama ve geri alma

1. Public GitHub deposu `TheRottex/tpplakatakip` içinden onaylanmış commit'i `/opt/tpplaka/releases/<revision>` altına alın.
2. Yeni sürüm dizininde `npm ci` ve `npm run build` çalıştırın. Node sürümü `package.json` ile uyumlu olmalıdır.
3. Üretim `.env` dosyasının `JWT_SECRET`, `HOST=127.0.0.1`, `PORT=4400`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `DATA_DIR=/var/lib/tpplaka/data` ve Vortex ayarlarını içerdiğini doğrulayın.
4. Eski `current` hedefini ve yeni derlemeyi kontrol edin; `current` bağlantısını yeni sürüme alın.
5. Yalnızca `tpplaka` servisini yeniden başlatın ve iki health adresini doğrulayın.
6. Sorun varsa `current` bağlantısını önceki release'e döndürün, yalnızca TPPlaka'yı yeniden başlatın ve health kontrolünü tekrarlayın.

Geri alma doğrulanmadan eski release dizinlerini silmeyin. Systemd unit veya Nginx ayarını değiştirmeden önce mevcut dosyaları yedekleyin; Nginx değişikliğinden sonra `nginx -t` başarılı olmalı ve yalnızca reload yapılmalıdır.

## Yönetici hesabı

Yeni kayıtlar `member` rolü alır. Yönetici hesabı yalnızca bir kez, doğru `DATA_DIR` ile `npm run bootstrap-admin` komutundan oluşturulur. E-posta ve en az 12 karakterlik parola komuta geçici environment değişkenleri olarak verilmeli, komut sonrasında kaldırılmalıdır. Script zaten yönetici varsa işlemi reddeder; mevcut admin kaydını silip tekrar oluşturmayın.

## Veri yedeği

`/var/lib/tpplaka/data` kullanıcı ve plaka bilgisi içerir. Düzenli, şifreli ve erişimi sınırlı yedek alın. Geri yüklemeden önce yalnızca `tpplaka` servisini durdurun; işlem sonrası dosya sahibini `tpplaka:tpplaka` olarak doğrulayın ve servisi yeniden başlatıp health kontrolü yapın.

CSV sadece başlangıç içe aktarımı içindir. JSON dosyaları oluşturulduktan sonra CSV değişiklikleri otomatik uygulanmaz. Gerçek CSV/JSON kayıtları, `.env`, özel anahtarlar ve sertifikalar GitHub'a yüklenmemelidir.

## Alan adı ve TLS

`tpplaka.rottexforge.com` A kaydı VPS'e yönlenmelidir. HTTPS sertifikası bu hostname için Nginx'te sonlandırılır. Nginx yalnızca bu `server_name` isteğini `http://127.0.0.1:4400` adresine proxy etmelidir.