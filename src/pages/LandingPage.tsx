import { useNavigate } from 'react-router-dom'
import { Wrench, Car, Package, Users, BarChart3, ShieldCheck, Smartphone, ArrowRight, CheckCircle } from 'lucide-react'

const FEATURES_PARTS = [
  'Автомобили на разборку',
  'Склад запчастей',
  'Каталог с ценами (UAH / USD)',
  'Заказы клиентов',
  'История продаж',
  'Публичный профиль клиента',
]

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Безопасно', desc: 'Supabase RLS — каждая компания видит только свои данные' },
  { icon: Smartphone, title: 'Мобильный', desc: 'PWA — работает как приложение на iOS и Android' },
  { icon: BarChart3, title: 'Аналитика', desc: 'Графики доходов, статистика по клиентам и услугам' },
  { icon: Users, title: 'Мультироль', desc: 'Администратор, менеджер, механик — у каждого свой доступ' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .lp { font-family: 'DM Sans', system-ui, sans-serif; }
        .lp .bf { font-family: 'Bebas Neue', sans-serif; }
        .lp-grid-bg {
          background-image:
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-fu-1 { animation: lp-fade-up 0.6s ease forwards; animation-delay: 0.1s; opacity: 0; }
        .lp-fu-2 { animation: lp-fade-up 0.6s ease forwards; animation-delay: 0.25s; opacity: 0; }
        .lp-fu-3 { animation: lp-fade-up 0.6s ease forwards; animation-delay: 0.4s; opacity: 0; }
        .lp-btn-primary {
          background: linear-gradient(135deg, #2563EB, #1D4ED8);
          transition: opacity 0.2s, transform 0.15s;
        }
        .lp-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .lp-btn-ghost {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          transition: background 0.2s, border-color 0.2s;
        }
        .lp-btn-ghost:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); }
        .lp-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.2s, background 0.2s;
        }
        .lp-card:hover { background: rgba(59,130,246,0.05); border-color: rgba(59,130,246,0.2); }
        .lp-check { color: #34D399; flex-shrink: 0; }
      `}</style>

      <div className="lp" style={{ background: '#080C14', minHeight: '100vh' }}>

        {/* ── NAV ─────────────────────────────────────────────── */}
        <nav style={{ borderBottom: '1px solid rgba(59,130,246,0.1)', background: 'rgba(8,12,20,0.9)', backdropFilter: 'blur(12px)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', background: '#2563EB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={16} color="white" />
              </div>
              <span className="bf" style={{ color: '#F1F5F9', fontSize: '20px', letterSpacing: '2px' }}>TSP CRM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => navigate('/market')}
                className="lp-btn-ghost"
                style={{ color: '#CBD5E1', fontWeight: '600', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Каталог запчастей
              </button>
              <button
                onClick={() => navigate('/login')}
                className="lp-btn-primary"
                style={{ color: 'white', fontWeight: '600', fontSize: '13px', padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
              >
                Войти
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────── */}
        <section className="lp-grid-bg" style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(60px, 10vw, 100px) 20px clamp(48px, 8vw, 80px)' }}>
          {/* Glow */}
          <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <div className="lp-fu-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '20px', padding: '6px 16px', marginBottom: '32px' }}>
              <span style={{ width: '6px', height: '6px', background: '#3B82F6', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ color: '#93C5FD', fontSize: '13px', fontWeight: '500' }}>CRM для автобизнеса</span>
            </div>

            <h1 className="bf lp-fu-2" style={{ fontSize: 'clamp(52px, 8vw, 88px)', lineHeight: '0.95', color: '#F1F5F9', letterSpacing: '1px', marginBottom: '24px' }}>
              УПРАВЛЯЙ<br />
              <span style={{ color: '#3B82F6' }}>АВТО</span>БИЗНЕСОМ<br />
              УМНО
            </h1>

            <p className="lp-fu-3" style={{ color: '#64748B', fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: '1.7', maxWidth: '520px', margin: '0 auto 40px' }}>
              Полная система управления для авторазборки.
              Автомобили на разборку, склад запчастей, заказы клиентов — всё в одном месте.
            </p>

            <div className="lp-fu-3" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={() => navigate('/login')}
                className="lp-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'white', fontWeight: '600', fontSize: '15px', padding: '14px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer', width: 'clamp(200px, 60vw, 280px)', justifyContent: 'center' }}
              >
                Начать работу <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/market')}
                className="lp-btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontWeight: '600', fontSize: '15px', padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', width: 'clamp(200px, 60vw, 280px)', justifyContent: 'center' }}
              >
                <Package size={16} /> Каталог запчастей
              </button>
            </div>
          </div>
        </section>

        {/* ── TWO SYSTEMS ─────────────────────────────────────── */}
        <section style={{ padding: '80px 20px', maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>

            {/* Авторазборка */}
            <div style={{ background: 'linear-gradient(135deg, rgba(20,44,20,0.5) 0%, rgba(15,23,42,0.8) 100%)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '44px', height: '44px', background: '#15803D', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={22} color="white" />
                </div>
                <div>
                  <div className="bf" style={{ color: '#F1F5F9', fontSize: '24px', letterSpacing: '1px' }}>АВТОРАЗБОРКА</div>
                  <div style={{ color: '#4B5563', fontSize: '13px' }}>Учёт запчастей и продаж</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {FEATURES_PARTS.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle size={15} style={{ color: '#34D399', flexShrink: 0 }} />
                    <span style={{ color: '#CBD5E1', fontSize: '14px' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── HIGHLIGHTS ──────────────────────────────────────── */}
        <section style={{ padding: '20px 20px 80px', maxWidth: '1100px', margin: '0 auto' }}>
          <h2 className="bf" style={{ color: '#F1F5F9', fontSize: '36px', letterSpacing: '1px', marginBottom: '32px', textAlign: 'center' }}>
            ПОЧЕМУ TSP CRM
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
            {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="lp-card" style={{ borderRadius: '12px', padding: '24px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(37,99,235,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Icon size={20} color="#60A5FA" />
                </div>
                <div style={{ color: '#F1F5F9', fontWeight: '600', fontSize: '15px', marginBottom: '6px' }}>{title}</div>
                <div style={{ color: '#4B5563', fontSize: '13px', lineHeight: '1.6' }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section style={{ padding: '60px 20px 80px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: 'linear-gradient(135deg, rgba(30,58,95,0.4) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '20px', padding: 'clamp(32px, 5vw, 52px) clamp(20px, 4vw, 32px)' }}>
            <div style={{ width: '52px', height: '52px', background: '#1D4ED8', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Car size={26} color="white" />
            </div>
            <h2 className="bf" style={{ color: '#F1F5F9', fontSize: '36px', letterSpacing: '1px', marginBottom: '12px' }}>ГОТОВЫ НАЧАТЬ?</h2>
            <p style={{ color: '#64748B', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
              Войдите в систему и начните управлять своим автобизнесом прямо сейчас.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="lp-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'white', fontWeight: '600', fontSize: '15px', padding: '14px 32px', borderRadius: '10px', border: 'none', cursor: 'pointer', width: 'clamp(200px, 60vw, 280px)', justifyContent: 'center' }}
            >
              Войти в TSP CRM <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
            <div style={{ width: '22px', height: '22px', background: '#1D4ED8', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={12} color="white" />
            </div>
            <span className="bf" style={{ color: '#374151', fontSize: '14px', letterSpacing: '2px' }}>TSP CRM</span>
          </div>
          <p style={{ color: '#1F2937', fontSize: '12px' }}>Система управления для авторазборки</p>
        </footer>

      </div>
    </>
  )
}
