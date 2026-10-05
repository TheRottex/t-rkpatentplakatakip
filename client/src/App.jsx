import { useEffect, useMemo, useState } from "react";
import { api, clearOfflineData, getOfflineSnapshot, getOfflineUser, getToken, isOfflineEnabled, saveOfflineUser, setSession } from "./api.js";

const SHOW_LOCATION_FIELDS = 0;
const ONBOARD_KEY = "bloktakip_onboarded";
const OFFLINE_ENABLED = isOfflineEnabled();

function haptic(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function formatPlate(value) {
  const raw = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return "•• ••• ••";
  const city = raw.slice(0, 2);
  const rest = raw.slice(2);
  const letters = rest.match(/^[A-Z]+/)?.[0] || "";
  const digits = rest.slice(letters.length);
  return [city, letters, digits].filter(Boolean).join(" ");
}

export default function App() {
  const [tab, setTab] = useState("sorgula");
  const [installDevice, setInstallDevice] = useState(() => {
    const agent = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(agent) ? "iphone" : "android";
  });
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === "1");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", nickname: "" });
  const [notice, setNotice] = useState("");
  const [add, setAdd] = useState({ isim: "", plaka: "", blok: "", daire: "" });
  const [savingPlate, setSavingPlate] = useState(false);
  const [uploadingPlates, setUploadingPlates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.health().then(setHealth).catch(() => {
      const cached = OFFLINE_ENABLED ? getOfflineSnapshot() : null;
      setHealth(cached ? { stats: cached.stats || { uniquePlates: cached.items.length } } : null);
    });
    const token = getToken();
    const snapshot = OFFLINE_ENABLED ? getOfflineSnapshot() : null;
    const cachedUser = OFFLINE_ENABLED ? getOfflineUser() : null;

    if (token && snapshot?.items?.length && cachedUser) {
      setUser({ ...cachedUser, offline: true });
      setHealth({ stats: snapshot.stats || { uniquePlates: snapshot.items.length } });
      setNotice(`${snapshot.items.length} kayıt bu cihazda çevrimdışı kullanım için hazır.`);
    }

    if (token) {
      api.me().then((profile) => {
        if (cancelled) return;
        saveOfflineUser(profile);
        setUser(profile);
      }).catch(() => {
        if (cancelled) return;
        if (!OFFLINE_ENABLED || !snapshot?.items?.length || !cachedUser) {
          setSession(null);
          setUser(null);
        }
      });
    }

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!OFFLINE_ENABLED || !user || user.offline) return;
    api.plates().then((payload) => {
      setNotice(`${payload.items.length} kayıt çevrimdışı kullanım için eşitlendi.`);
    }).catch((error) => {
      if (navigator.onLine) setNotice(`Çevrimdışı veri eşitlenemedi: ${error.message}`);
    });
  }, [user]);

  useEffect(() => {
    if (!user?.offline) return;
    const reconnect = () => {
      api.me().then((profile) => {
        saveOfflineUser(profile);
        setUser(profile);
        return api.plates();
      }).catch(() => {});
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setResult(null);
      return;
    }
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResult(null);
        return;
      }
      try {
        setResult(await api.search(query));
      } catch (error) {
        setNotice(error.message);
      }
    }, 90);
    return () => clearTimeout(handle);
  }, [query, user]);

  useEffect(() => {
    if (tab === "filo" && user) {
      api.plates().then((payload) => setFleet(payload.items || [])).catch((error) => setNotice(error.message));
    }
  }, [tab, user]);

  const hit = result?.exact?.[0] || result?.similar?.[0];
  const ring = useMemo(() => {
    if (!query) return 0.12;
    if (result?.exact?.length) return 1;
    if (result?.similar?.length) return 0.55;
    return 0.22;
  }, [query, result]);

  async function submitAuth(event) {
    event.preventDefault();
    setNotice("");
    try {
      const payload = authMode === "register" ? await api.register(form) : await api.login(form);
      setSession(payload.token);
      saveOfflineUser(payload.user);
      setUser(payload.user);
      haptic(20);
      setNotice(payload.via === "vortex" ? "Vortex hesabı bağlandı." : "Hesap hazır.");
      setTab("sorgula");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function addPlate(event) {
    event.preventDefault();
    setSavingPlate(true);
    try {
      await api.addPlate(add);
      setAdd({ isim: "", plaka: "", blok: "", daire: "" });
      const [payload, status] = await Promise.all([api.plates(), api.health()]);
      setFleet(payload.items || []);
      setHealth(status);
      setNotice("Plaka filoya eklendi.");
      haptic(16);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSavingPlate(false);
    }
  }

  async function downloadTemplate() {
    try {
      await api.downloadPlateTemplate();
      setNotice("Excel şablonu indirildi.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function importPlates(event) {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    const file = uploadForm.elements.namedItem("file")?.files?.[0];
    if (!file) {
      setNotice("Önce bir Excel veya CSV dosyası seçin.");
      return;
    }

    setUploadingPlates(true);
    try {
      const result = await api.importPlates(file);
      const [payload, status] = await Promise.all([api.plates(), api.health()]);
      setFleet(payload.items || []);
      setHealth(status);
      uploadForm.reset();
      setNotice(`${result.added} plaka eklendi; ${result.duplicates} tekrar atlandı.`);
      haptic(20);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploadingPlates(false);
    }
  }

  if (!onboarded) {
    const slides = [
      { title: "Plakayı ve sürücüyü bul", copy: "Yetkili hesabınla giriş yapıp plakayı sorgula. Sürücü adı görünür; dosyada varsa blok ve daire de gösterilir." },
      { title: "Filo kayıtları tek yerde", copy: "Plaka kayıtları uygulama sunucusunda tutulur. Filo listesini görüntülemek için hesabınla giriş yap." },
      { title: "Hesap ve yetkiler", copy: "Vortex bağlantısı varsa onunla, yoksa yerel hesapla giriş yapılır. Yönetici yetkisi sunucuda ayrıca tanımlanır." },
    ];
    const slide = slides[page];
    return (
      <main className="phone">
        <section className="onboard">
          <div className="pulse-ring" />
          <img className="brand-logo onboarding-logo" src="/turkpatenetanalogo.jpg" alt="Türk Patent ve Marka Kurumu" />
          <h1>{slide.title}</h1>
          <p className="lede">{slide.copy}</p>
          <div className="dots">
            {slides.map((_, index) => (
              <span key={index} className={index === page ? "on" : ""} />
            ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              haptic();
              if (page === slides.length - 1) {
                localStorage.setItem(ONBOARD_KEY, "1");
                setOnboarded(true);
              } else setPage(page + 1);
            }}
          >
            {page === slides.length - 1 ? "Uygulamayı Aç" : "Devam"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="phone">
      <header className="top">
        <div>
          <img className="brand-logo" src="/turkpatenetanalogo.jpg" alt="Türk Patent ve Marka Kurumu" />
          <p className="eyebrow">{new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{tab === "sorgula" ? "Plaka" : tab === "filo" ? "Filo" : "Hesap"}</h1>
        </div>
        <div className="stat">
          <b>{health?.stats?.uniquePlates ?? "—"}</b>
          <span>kayıt</span>
        </div>
      </header>

      {notice ? <p className="toast">{notice}</p> : null}

      {tab === "sorgula" && (
        <section className="stack">
          {!user ? (
            <Empty title="Plaka sorgusu için giriş yap" copy="Sürücü adı, plaka ve varsa konum bilgileri yalnızca yetkili hesaplara gösterilir." action="Hesaba geç" onAction={() => setTab("hesap")} />
          ) : (
            <>
          <div className="ring-wrap">
            <svg viewBox="0 0 120 120" className="ring">
              <circle cx="60" cy="60" r="52" />
              <circle cx="60" cy="60" r="52" style={{ strokeDashoffset: 327 - 327 * ring }} />
            </svg>
            <article className="plate">
              <span className="tr">TR</span>
              <strong>{formatPlate(query || hit?.plaka)}</strong>
            </article>
          </div>
          <label className="search">
            <span>Sorgula</span>
            <input
              value={query}
              autoCapitalize="characters"
              autoCorrect="off"
              placeholder="06 ABC 06"
              onChange={(event) => {
                haptic(8);
                setQuery(event.target.value);
              }}
            />
          </label>
          <div className="metrics">
            {hit?.isim ? <Metric label="Sürücü" value={hit.isim} /> : null}
            {hit?.blok ? <Metric label="Blok" value={hit.blok} /> : null}
            {hit?.daire ? <Metric label="Daire" value={hit.daire} /> : null}
            <Metric label="Durum" value={result?.exact?.length ? "Tam" : result?.similar?.length ? "Yakın" : query ? "Yok" : "Hazır"} />
          </div>
          <section className="install-guide" aria-labelledby="install-title">
            <div className="install-heading">
              <span className="install-icon"><Icon name="install" /></span>
              <div>
                <p className="eyebrow">Ana ekrana ekle</p>
                <h2 id="install-title">Telefonunda uygulama gibi kullan</h2>
              </div>
            </div>
            <div className="segment device-switch" aria-label="Telefon türü">
              <button type="button" className={installDevice === "android" ? "on" : ""} onClick={() => setInstallDevice("android")}>Android</button>
              <button type="button" className={installDevice === "iphone" ? "on" : ""} onClick={() => setInstallDevice("iphone")}>iPhone</button>
            </div>
            {installDevice === "android" ? (
              <ol className="install-steps">
                <li>Uygulama bağlantısını <b>Chrome</b> ile aç.</li>
                <li>Sağ üstteki <b>⋮</b> menüsüne dokun.</li>
                <li><b>Uygulamayı yükle</b> veya <b>Ana ekrana ekle</b> seçeneğini seçip onayla.</li>
              </ol>
            ) : (
              <ol className="install-steps">
                <li>Uygulama bağlantısını <b>Safari</b> ile aç.</li>
                <li><b>Paylaş</b> düğmesine dokun.</li>
                <li><b>Ana Ekrana Ekle</b> seçeneğini seçip <b>Ekle</b> düğmesine dokun.</li>
              </ol>
            )}
            <p className="install-note">Kurulum için uygulama adresi güvenli HTTPS bağlantısı olmalı. Bu işlem uygulamayı mağazadan indirmez; ana ekrana ekler. {OFFLINE_ENABLED ? "Bir kez internet bağlantısıyla giriş yapıp veri eşitlendikten sonra arama çevrimdışı da çalışır." : "Plaka araması için sunucuya internet bağlantısı gerekir."}</p>
          </section>
          {result?.similar?.length ? (
            <ul className="list">
              {result.similar.map((row) => (
                <li key={row.id} onClick={() => setQuery(row.plaka)}>
                  <b>{formatPlate(row.plaka)}</b>
                  <span>{plateDetails(row)}</span>
                </li>
              ))}
            </ul>
          ) : null}
            </>
          )}
        </section>
      )}

      {tab === "filo" && (
        <section className="stack">
          {!user ? (
            <Empty title="Filoyu görmek için giriş yap" copy="Filo kayıtları yalnızca yetkili hesaplara gösterilir." action="Hesaba geç" onAction={() => setTab("hesap")} />
          ) : (
            <>
              {user.role === "admin" && !user.offline ? (
                <div className="admin-tools">
                  <form className="card-form" onSubmit={addPlate}>
                    <h2>Yeni plaka ekle</h2>
                    <label htmlFor="new-driver">Sürücü adı soyadı</label>
                    <input id="new-driver" name="isim" required placeholder="Ad Soyad" value={add.isim} onChange={(e) => setAdd({ ...add, isim: e.target.value })} />
                    <label htmlFor="new-plate">Plaka</label>
                    <input id="new-plate" name="plaka" required placeholder="06 ABC 06" value={add.plaka} onChange={(e) => setAdd({ ...add, plaka: e.target.value })} />
                    {SHOW_LOCATION_FIELDS === 1 ? (<>
                    <label htmlFor="new-block">Blok</label>
                    <input id="new-block" name="blok" placeholder="C2/47" value={add.blok} onChange={(e) => setAdd({ ...add, blok: e.target.value })} />
                    <label htmlFor="new-unit">Daire</label>
                    <input id="new-unit" name="daire" placeholder="2" value={add.daire} onChange={(e) => setAdd({ ...add, daire: e.target.value })} />
                    </>) : null}
                    <button className="primary" type="submit" disabled={savingPlate}>{savingPlate ? "Ekleniyor..." : "Plakayı ekle"}</button>
                  </form>
                  <form className="card-form" onSubmit={importPlates}>
                    <h2>Excel veya CSV aktar</h2>
                    <button className="secondary template-download" type="button" onClick={downloadTemplate}>Excel şablonunu indir</button>
                    <label htmlFor="plate-file">Plaka listesi</label>
                    <input id="plate-file" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
                    <p className="hint">Şablonda sürücü adı ve plaka zorunlu; blok ve daire isteğe bağlıdır. Bu aktarım uygulama hesabı değil, filo kaydı ekler. En fazla 5 MB ve 10.000 satır.</p>
                    <button className="primary" type="submit" disabled={uploadingPlates}>{uploadingPlates ? "Aktarılıyor..." : "Dosyayı aktar"}</button>
                  </form>
                </div>
              ) : user.offline ? (
                <p className="hint">Çevrimdışı kullanım salt okunurdur. Plaka ekleme, silme ve aktarım için internet bağlantısı gerekir.</p>
              ) : (
                <p className="hint">Yeni plaka ekleme ve dosyadan toplu aktarım yönetici yetkisi gerektirir. Yetki için site yöneticisine başvurun.</p>
              )}
              <ul className="list">
                {fleet.map((row) => (
                  <li key={row.id}>
                    <b>{formatPlate(row.plaka)}</b>
                    <span>{plateDetails(row)}</span>
                    {user.role === "admin" && !user.offline && (
                      <button
                        className="ghost"
                        onClick={async () => {
                          await api.removePlate(row.id);
                          setFleet((items) => items.filter((item) => item.id !== row.id));
                        }}
                      >
                        Sil
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "hesap" && (
        <section className="stack">
          {user ? (
            <div className="profile">
              <div className="avatar">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</div>
              <h2>{user.displayName || user.email}</h2>
              <p>{user.email}</p>
              <p className="pill">{user.offline ? "Çevrimdışı · salt okunur" : `${user.vortexLinked ? "Vortex bağlı" : "Yerel hesap"} · ${user.role}`}</p>
              <button
                className="secondary"
                onClick={() => {
                  setSession(null);
                  clearOfflineData();
                  setUser(null);
                  setFleet([]);
                }}
              >
                Çıkış yap
              </button>
            </div>
          ) : (
            <form className="card-form" onSubmit={submitAuth}>
              <div className="segment">
                <button type="button" className={authMode === "login" ? "on" : ""} onClick={() => setAuthMode("login")}>Giriş</button>
                <button type="button" className={authMode === "register" ? "on" : ""} onClick={() => setAuthMode("register")}>Hesap aç</button>
              </div>
              {authMode === "register" && (
                <>
                  <input placeholder="Ad" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  <input placeholder="Soyad" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  <input placeholder="Takma ad" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
                </>
              )}
              <input type="email" required placeholder="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input type="password" required minLength={8} placeholder="Parola (en az 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button className="primary" type="submit">{authMode === "register" ? "Hesap aç" : "Giriş yap"}</button>
              <p className="hint">Vortex bağlantısı yapılandırılmışsa hesap orada doğrulanır; bağlantı kapalıysa yerel hesap kullanılır. Yeni hesaplar normal kullanıcı yetkisindedir; yönetici yetkisi sunucudan verilir.</p>
            </form>
          )}
        </section>
      )}

      <nav className="tabbar">
        <Tab id="sorgula" label="Sorgula" icon="search" current={tab} onPick={setTab} />
        <Tab id="filo" label="Filo" icon="car" current={tab} onPick={setTab} />
        <Tab id="hesap" label="Hesap" icon="user" current={tab} onPick={setTab} />
      </nav>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <article>
      <span>{label}</span>
      <b>{value}</b>
    </article>
  );
}

function plateDetails(row) {
  return [row.isim, row.blok, row.daire ? `daire ${row.daire}` : ""].filter(Boolean).join(" · ");
}

function Empty({ title, copy, action, onAction }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{copy}</p>
      <button className="primary" onClick={onAction}>{action}</button>
    </div>
  );
}

function Tab({ id, label, icon, current, onPick }) {
  return (
    <button className={current === id ? "on" : ""} aria-current={current === id ? "page" : undefined} onClick={() => { haptic(); onPick(id); }}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    car: <><path d="m5 11 1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><path d="M3.5 11h17v6h-17zM6.5 17v2m11-2v2M6 14h.01M18 14h.01" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    install: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M12 7v7m-3-3 3 3 3-3M10 17h4" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
