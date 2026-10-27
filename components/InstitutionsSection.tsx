import React, { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Check, ExternalLink, MapPin } from 'lucide-react';
import { Card } from './UI';
import { Institution, loadInstitutions } from '../lib/institutions';
import { InstitutionTheme } from '../lib/institutionProfiles';

const safeUrl = (value: string): string => (/^https?:\/\//i.test(value) ? value : '');

const splitParagraphs = (text: string): string[] => text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

// Sem apresentação própria (instituição só da planilha), o painel usa as cores do SAE.
const DEFAULT_THEME: InstitutionTheme = {
  bg: 'transparent',
  fg: 'rgb(var(--sae-text))',
  muted: 'rgb(var(--sae-muted))',
  accent: 'rgb(var(--sae-accent-text))',
  surface: 'rgb(var(--sae-soft) / var(--sae-soft-a))',
  border: 'rgb(var(--sae-border))',
};

const Chip: React.FC<{ theme: InstitutionTheme; children: React.ReactNode; strong?: boolean }> = ({ theme, children, strong }) => (
  <span
    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
    style={
      strong
        ? { backgroundColor: theme.accent, color: theme.bg === 'transparent' ? '#FFFFFF' : theme.bg, borderColor: theme.accent }
        : { backgroundColor: theme.surface, color: theme.fg, borderColor: theme.border }
    }
  >
    {children}
  </span>
);

const InstitutionPanel: React.FC<{ item: Institution }> = ({ item }) => {
  const profile = item.profile;
  const theme = profile?.theme ?? DEFAULT_THEME;
  const [logoFailed, setLogoFailed] = useState(false);

  // A planilha tem prioridade sobre o texto padrão (lib/institutionProfiles.ts). Um logotipo vindo da planilha
  // não tem fundo conhecido: vai sobre uma placa branca.
  const sheetLogo = safeUrl(item.logo);
  const logo = sheetLogo || safeUrl(theme.logo ?? '') || safeUrl(profile?.logo ?? '');
  const logoPlate = sheetLogo ? '#FFFFFF' : theme.logoPlate;
  const site = safeUrl(item.site) || safeUrl(profile?.site ?? '');
  const tradition = item.year ? `Desde ${item.year}` : profile?.tradition ?? '';
  const tagline = item.summary || profile?.tagline || '';
  const about = item.history ? splitParagraphs(item.history) : profile?.about ?? [];
  const title = profile?.fullName ?? item.name;

  return (
    <div className="p-6 md:p-8 animate-fadeIn space-y-8" role="tabpanel" style={{ backgroundColor: theme.bg, color: theme.fg }}>
      <div className="flex flex-wrap items-center gap-5">
        {logo && !logoFailed && (
          <div
            className={`flex items-center justify-center min-w-[7rem] ${logoPlate ? 'rounded-xl p-3' : ''}`}
            style={logoPlate ? { backgroundColor: logoPlate } : undefined}
          >
            <img
              src={logo}
              alt={`Logo ${item.name}`}
              className="h-14 w-auto max-w-[11rem] object-contain"
              onError={() => setLogoFailed(true)}
            />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-2xl font-heading font-bold">{title}</h3>
          {!title.toLowerCase().includes(item.name.toLowerCase()) && (
            <p className="text-sm" style={{ color: theme.muted }}>
              Conhecida no SAE como {item.name}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {profile?.kind && (
              <Chip theme={theme} strong>
                {profile.kind}
              </Chip>
            )}
            {tradition && <Chip theme={theme}>{tradition}</Chip>}
            {profile?.location && (
              <Chip theme={theme}>
                <MapPin size={12} /> {profile.location}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {tagline && (
        <p className="text-lg font-heading font-semibold italic" style={{ color: theme.accent }}>
          {tagline}
        </p>
      )}

      {profile && profile.stats.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {profile.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border p-4" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
              <dt className="text-2xl font-heading font-bold" style={{ color: theme.accent }}>
                {stat.value}
              </dt>
              <dd className="text-sm mt-1 leading-snug" style={{ color: theme.muted }}>
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div>
        <h4 className="font-heading font-bold mb-2">Quem é</h4>
        {about.length > 0 ? (
          <div className="space-y-3 leading-relaxed">
            {about.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="italic" style={{ color: theme.muted }}>
            A apresentação desta instituição será publicada em breve.
          </p>
        )}
      </div>

      {profile && (profile.highlights.length > 0 || profile.courseTypes.length > 0 || profile.modalities.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {profile.highlights.length > 0 && (
            <div>
              <h4 className="font-heading font-bold mb-3">Diferenciais</h4>
              <ul className="space-y-2">
                {profile.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <Check size={18} className="shrink-0 mt-0.5" style={{ color: theme.accent }} />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(profile.courseTypes.length > 0 || profile.modalities.length > 0) && (
            <div>
              <h4 className="font-heading font-bold mb-3">O que oferece</h4>
              <div className="space-y-4">
                {[
                  { title: 'Tipos de curso', items: profile.courseTypes },
                  { title: 'Modalidades', items: profile.modalities },
                ]
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <div key={group.title}>
                      <p className="text-sm font-semibold">{group.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {group.items.map((entry) => (
                          <Chip key={entry} theme={theme}>
                            {entry}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-5 flex flex-wrap items-start justify-between gap-4" style={{ borderColor: theme.border }}>
        <div className="space-y-2 text-sm min-w-0" style={{ color: theme.muted }}>
          {profile?.address && (
            <p className="flex items-start gap-2">
              <MapPin size={16} className="shrink-0 mt-0.5" /> <span>{profile.address}</span>
            </p>
          )}
          {profile?.accreditation && (
            <p className="flex items-start gap-2">
              <BadgeCheck size={16} className="shrink-0 mt-0.5" /> <span>{profile.accreditation}</span>
            </p>
          )}
          {profile && <p className="text-xs">Informações dos sites oficiais. Confirme valores, prazos e condições no site antes de passar ao aluno.</p>}
        </div>
        {site && (
          <a
            href={site}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ borderColor: theme.accent, color: theme.accent }}
          >
            <ExternalLink size={16} /> Visitar site
          </a>
        )}
      </div>
    </div>
  );
};

export const InstitutionsSection: React.FC = () => {
  const [items, setItems] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let active = true;
    loadInstitutions().then((result) => {
      if (!active) return;
      setItems(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const current = items[selected] ?? items[0];

  return (
    <section aria-labelledby="institutions-title">
      <h2 id="institutions-title" className="text-2xl font-heading font-bold text-sae-text flex items-center gap-2 mb-1">
        <Building2 size={24} className="text-sae-accentText" /> Nossas instituições
      </h2>
      <p className="text-sae-muted mb-5">Conheça cada instituição: quem é, o que oferece e o que a diferencia.</p>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin w-8 h-8 border-4 border-sae-accent border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-wrap gap-2 p-4 border-b border-sae-border bg-sae-soft" role="tablist" aria-label="Instituições">
            {items.map((item, index) => (
              <button
                key={item.name}
                type="button"
                role="tab"
                aria-selected={index === selected}
                onClick={() => setSelected(index)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  index === selected
                    ? 'bg-sae-accent text-white border-sae-accent'
                    : 'bg-sae-card text-sae-text border-sae-border hover:border-sae-accent'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {current && <InstitutionPanel key={current.name} item={current} />}
        </Card>
      )}
    </section>
  );
};
