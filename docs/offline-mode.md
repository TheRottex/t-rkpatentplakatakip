# Çevrimdışı ve Misafir Kullanımı

Offline arama ile guest oturumları iki ayrı ayardır. Varsayılanları kapalıdır.

| `VITE_OFFLINE_ENABLED` | `VITE_ALLOW_GUEST_SESSIONS` | Davranış |
| --- | --- | --- |
| `false` | `false` | Normal hesap girişi; uygulama online çalışır. |
| `false` | `true` | Online kullanım ve **Misafir olarak devam et** düğmesi. |
| `true` | `false` | Normal hesapla online giriş ve cihazda arka plan eşitleme; sonraki açılışlarda cache ile offline salt-okunur kullanım. |
| `true` | `true` | İlk online açılışta otomatik guest oturumu ve arka plan eşitleme; sonraki açılışlarda cache ile offline salt-okunur kullanım. |

## Sunucuda yapılandırma

Debian sunucusunda `/opt/tpplaka/app/.env` dosyasını açın. Diğer ayarları ve sırları koruyarak istediğiniz iki değeri ekleyin veya değiştirin:

```dotenv
VITE_OFFLINE_ENABLED=true
VITE_ALLOW_GUEST_SESSIONS=true
```

Ardından proje kökünde:

```bash
cd /opt/tpplaka/app
git pull --ff-only https://github.com/TheRottex/t-rkpatentplakatakip.git main
npm run build
sudo systemctl restart tpplaka
systemctl is-active tpplaka
curl --fail --show-error http://127.0.0.1:4400/api/health
```

Bu değerler Vite build sırasında istemciye gömülür; `.env` değişikliğinin etkili olması için yeniden build ve servis restart gerekir. Guest izni açık olduğunda HTTPS adresine erişebilen herkes tüm plaka/sürücü listesini okuyabilir. Misafirler ekleme, silme veya dosya aktarımı yapamaz. Liste gizli kalmalıysa `VITE_ALLOW_GUEST_SESSIONS=false` bırakın.

## İlk eşitleme

Offline modunda ilk eşitleme için cihaz internet bağlantısı ister. İki ayar da açıksa uygulama ilk online açılışta guest oturumu açıp listeyi otomatik eşitler. Guest kapalıysa yetkili hesapla bir kez giriş yapılmalıdır. Eşitlemeden sonra aynı tarayıcı/PWA offline arama ve filo listesini salt okunur kullanabilir. Çıkış cihazdaki offline kopyayı siler.

Sürücü adı, plaka ve varsa konum bilgileri cihazdaki tarayıcı depolamasında şifrelenmeden tutulur. Yalnızca güvenilir, ekran kilitli cihazlarda kullanın; offline cache kalıcı yedek değildir.
