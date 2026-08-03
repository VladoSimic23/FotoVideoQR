import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-100 font-sans">
      {/* --- NAVIGATION --- */}
      <header className="sticky top-0 z-50 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-serif font-semibold tracking-tight text-emerald-950">
              Moje Uspomene
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-10 text-sm font-medium text-slate-600">
            <a
              href="#kako-radi"
              className="hover:text-emerald-900 transition-colors"
            >
              Kako radi
            </a>
            <a
              href="#znacajke"
              className="hover:text-emerald-900 transition-colors"
            >
              Mogućnosti
            </a>
          </nav>
          <a
            href="#kontakt"
            className="bg-emerald-900 hover:bg-emerald-950 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-all duration-200 shadow-sm hover:shadow"
          >
            Zatraži ponudu
          </a>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-20 pb-28 md:pt-32 md:pb-36 overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/50 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-900 text-xs font-semibold tracking-wide uppercase mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Digitalna galerija za vaša slavlja
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif font-normal text-slate-900 tracking-tight leading-[1.15] mb-8">
            Sačuvajte svaki trenutak slavlja <br className="hidden sm:inline" />
            <span className="italic font-light text-emerald-900">
              kroz oči vaših gostiju.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
            Gosti skeniraju QR kod na stolu i u nekoliko sekundi dijele
            fotografije i videozapise s vjenčanja — bez instalacije aplikacija i
            bez kompresije kvalitete.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#kontakt"
              className="w-full sm:w-auto bg-emerald-900 hover:bg-emerald-950 text-white font-medium px-8 py-4 rounded-full shadow-md hover:shadow-lg transition-all duration-200 text-center"
            >
              Kontaktirajte nas
            </a>
            <a
              href="#kako-radi"
              className="w-full sm:w-auto bg-white hover:bg-slate-100/80 text-slate-800 font-medium px-8 py-4 rounded-full border border-slate-200 transition-all duration-200 text-center"
            >
              Kako funkcionira?
            </a>
          </div>
        </div>
      </section>

      {/* --- KAKO RADI SECTION --- */}
      <section
        id="kako-radi"
        className="py-24 bg-white border-y border-slate-200/60"
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-20">
            <h2 className="text-3xl font-serif font-normal text-slate-900 mb-4">
              Brzo, jednostavno i intuitivno
            </h2>
            <p className="text-slate-500 font-light">
              Osmišljeno tako da i najstariji gosti mogu bez problema podijeliti
              svoju uspomenu.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 text-center relative">
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-serif text-lg mb-6 shadow-sm">
                01
              </div>
              <h3 className="font-semibold text-lg mb-3 text-slate-900">
                QR kod na stolovima
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                Gosti na stolovima pronalaze elegantno dizajnirane kartice s QR
                kodom pripremljenim za vaše slavlje.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-serif text-lg mb-6 shadow-sm">
                02
              </div>
              <h3 className="font-semibold text-lg mb-3 text-slate-900">
                Skeniranje i slanje
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                Kamera mobitela otvara galeriju ili fotoaparat. Odabir više
                slika i videa traje svega par sekundi.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-serif text-lg mb-6 shadow-sm">
                03
              </div>
              <h3 className="font-semibold text-lg mb-3 text-slate-900">
                Trajna galerija
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                Svi uslikani trenuci automatski se slažu u vašu privatnu online
                galeriju dostatnu za naknadno preuzimanje.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- ALL-IN-ONE ZNAČAJKE (SINGLE SECTION) --- */}
      <section id="znacajke" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-emerald-900 text-xs font-semibold tracking-wider uppercase mb-3 block">
              Sve u jednom rješenju
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mb-4">
              Mogućnosti koje nudimo za vaše vjenčanje
            </h2>
            <p className="text-slate-600 font-light">
              Pružamo vam kompletnu podršku — od tehničke platforme do estetske
              pripreme za sale.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                ✨
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Bez registracije i aplikacija
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Gosti ne moraju preuzimati nikakve aplikacije iz trgovine niti
                kreirati račune. Sve radi izravno u pregledniku mobitela.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                📸
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Izvorna (Full HD/4K) kvaliteta
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Za razliku od društvenih mreža ili WhatsAppa, fotografije i
                videozapisi ne gube oštrinu niti se komprimiraju.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                📁
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Višestruki odabir (Multiple Upload)
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Omogućeno je slanje više slika i videa odjednom iz galerije
                telefona ili izravno snimanje novih trenutaka na podiju.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                🎨
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Personalizirani tisak i stakla
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Dizajniramo tiskane letke i kartice na premium papiru te
                osiguravamo ukrasne drvene ili zlatne držače prilagođene dekoru
                sale.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                🛡️
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Moderacija i nadzorna ploča
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Potpuni nadzor nad sadržajem — po želji možete odobriti svaki
                unos prije nego postane vidljiv u zajedničkoj galeriji.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 font-bold mb-6">
                ♾️
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">
                Trajna dostupnost galerije
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Vaš zajednički album ostaje trajno dostupan putem privatnog
                linka kako biste mu se mogli vratiti na svaku godišnjicu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- CALL TO ACTION --- */}
      <section
        id="kontakt"
        className="py-20 bg-emerald-950 text-white relative overflow-hidden"
      >
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-serif font-normal mb-6 leading-tight">
            Želite li zabilježiti trenutke s vašeg slavlja?
          </h2>
          <p className="text-slate-300 font-light text-lg mb-10 max-w-2xl mx-auto">
            Javite nam se s datumom i lokacijom vjenčanja kako bismo pripremili
            ponudu i personalizirani dizajn za vaše stolove.
          </p>
          <a
            href="mailto:info@moje-uspomene.com"
            className="inline-block bg-white text-emerald-950 font-medium px-9 py-4 rounded-full shadow-lg hover:bg-slate-100 transition-all duration-200"
          >
            Pošaljite upit
          </a>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-3">
          <p className="font-serif text-xl text-slate-200">Moje Uspomene</p>
          <p className="text-xs font-light text-slate-500">
            © {new Date().getFullYear()} Moje Uspomene. Sva prava pridržana.
          </p>
        </div>
      </footer>
    </div>
  );
}
