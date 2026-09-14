import React, { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "decants-finanzas-v1";

const DEFAULT_STATE = {
  investment: {
    items: [
      { id: "perfume-ms", name: "Perfume Mandarin Sky (100ml)", amount: 38998 },
      { id: "atomizadores", name: "50 atomizadores de vidrio (5ml)", amount: 38000 },
      { id: "jeringas", name: "2 jeringas", amount: 400 },
    ],
  },
  socios: ["Pedro", "Ángel"],
  pagador: "Ángel",
  transferido: false,
  atomizadores: { total: 50 },
  jeringas: { total: 2 },
  perfumes: [
    {
      id: "mandarin-sky",
      nombre: "Mandarin Sky",
      mlTotal: 100,
      mlPorDecant: 5,
      costoPorDecant: 3000,
      precioSugerido: 8500,
      atomizadoresUsados: 20,
      jeringasUsadas: 1,
    },
  ],
  ventas: [],
};

function formatARS(n) {
  const v = Math.round(n || 0);
  return "$" + v.toLocaleString("es-AR");
}

function loadState() {
  return DEFAULT_STATE;
}

export default function DecantsApp() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // load persisted state
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setState({ ...DEFAULT_STATE, ...parsed });
        }
      } catch (e) {
        // no previous data, fine
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setSaving(true);
    setError("");
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      if (!result) setError("No se pudo guardar. Los cambios quedan solo en esta sesión.");
    } catch (e) {
      setError("No se pudo guardar. Los cambios quedan solo en esta sesión.");
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  if (!ready) {
    return (
      <div style={{ fontFamily: "Work Sans, sans-serif", padding: 40, color: "#5C5347" }}>
        Cargando datos guardados…
      </div>
    );
  }

  // ---------- derived numbers ----------
  const totalInvertido = state.investment.items.reduce((s, i) => s + i.amount, 0);
  const perPersona = totalInvertido / (state.socios.length || 2);

  const perfumeStats = state.perfumes.map((p) => {
    const decantsTotal = Math.floor(p.mlTotal / p.mlPorDecant);
    const ventasPerfume = state.ventas.filter((v) => v.perfumeId === p.id);
    const vendidos = ventasPerfume.length;
    const restantes = Math.max(decantsTotal - vendidos, 0);
    const ingresos = ventasPerfume.reduce((s, v) => s + v.precio, 0);
    const costoTotal = vendidos * p.costoPorDecant;
    const gananciaBruta = ingresos - costoTotal;
    return { ...p, decantsTotal, vendidos, restantes, ingresos, costoTotal, gananciaBruta };
  });

  const ingresosTotales = state.ventas.reduce((s, v) => s + v.precio, 0);
  const recuperadoPct = totalInvertido > 0 ? Math.min(ingresosTotales / totalInvertido, 1) : 0;
  const netoAcumulado = ingresosTotales - totalInvertido;
  const inversionCubierta = ingresosTotales >= totalInvertido;
  const gananciaRepartible = netoAcumulado > 0 ? netoAcumulado : 0;
  const gananciaPorSocio = gananciaRepartible / (state.socios.length || 2);

  const atomizadoresUsados = state.perfumes.reduce((s, p) => s + (p.atomizadoresUsados || 0), 0);
  const atomizadoresRestantes = state.atomizadores.total - atomizadoresUsados;
  const jeringasUsadas = state.perfumes.reduce((s, p) => s + (p.jeringasUsadas || 0), 0);
  const jeringasRestantes = state.jeringas.total - jeringasUsadas;

  // ---------- actions ----------
  const registrarVenta = (perfumeId, precio, comprador, cantidad = 1) => {
    const fecha = new Date().toISOString().slice(0, 10);
    const n = Math.max(1, Number(cantidad) || 1);
    const nuevas = Array.from({ length: n }, (_, i) => ({
      id: "v" + Date.now() + "-" + i,
      perfumeId,
      precio: Number(precio),
      comprador: comprador || "",
      fecha,
    }));
    update((prev) => ({ ...prev, ventas: [...nuevas, ...prev.ventas] }));
  };

  const borrarVenta = (id) => {
    update((prev) => ({ ...prev, ventas: prev.ventas.filter((v) => v.id !== id) }));
  };

  const marcarTransferido = () => {
    update((prev) => ({ ...prev, transferido: !prev.transferido }));
  };

  const actualizarAtomizadoresTotal = (n) => {
    const total = Math.max(0, Number(n) || 0);
    update((prev) => ({ ...prev, atomizadores: { ...prev.atomizadores, total } }));
  };

  const actualizarJeringasTotal = (n) => {
    const total = Math.max(0, Number(n) || 0);
    update((prev) => ({ ...prev, jeringas: { ...prev.jeringas, total } }));
  };

  const actualizarPerfume = (id, patch) => {
    update((prev) => ({
      ...prev,
      perfumes: prev.perfumes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const agregarGasto = (nombre, monto) => {
    update((prev) => ({
      ...prev,
      investment: {
        items: [
          ...prev.investment.items,
          { id: "gasto-" + Date.now(), name: nombre, amount: Number(monto) },
        ],
      },
    }));
  };

  const borrarGasto = (id) => {
    update((prev) => ({
      ...prev,
      investment: { items: prev.investment.items.filter((i) => i.id !== id) },
    }));
  };

  const borrarPerfume = (id) => {
    update((prev) => ({
      ...prev,
      perfumes: prev.perfumes.filter((p) => p.id !== id),
    }));
  };

  const agregarPerfume = (perfume) => {
    update((prev) => ({
      ...prev,
      perfumes: [...prev.perfumes, perfume],
      investment: {
        items: [
          ...prev.investment.items,
          ...perfume._gastos.map((g, idx) => ({
            id: perfume.id + "-gasto-" + idx,
            name: g.nombre,
            amount: g.monto,
          })),
        ],
      },
    }));
  };

  return (
    <div style={styles.app}>
      <style>{fontImport}</style>
      <div style={styles.shell}>
        <Header saving={saving} error={error} />
        <TabNav tab={tab} setTab={setTab} />

        {tab === "resumen" && (
          <Resumen
            totalInvertido={totalInvertido}
            perPersona={perPersona}
            socios={state.socios}
            pagador={state.pagador}
            transferido={state.transferido}
            onToggleTransferido={marcarTransferido}
            recuperadoPct={recuperadoPct}
            ingresosTotales={ingresosTotales}
            inversionCubierta={inversionCubierta}
            netoAcumulado={netoAcumulado}
            gananciaPorSocio={gananciaPorSocio}
            perfumeStats={perfumeStats}
          />
        )}

        {tab === "ventas" && (
          <Ventas
            perfumes={state.perfumes}
            perfumeStats={perfumeStats}
            ventas={state.ventas}
            onRegistrar={registrarVenta}
            onBorrar={borrarVenta}
          />
        )}

        {tab === "inventario" && (
          <Inventario
            perfumeStats={perfumeStats}
            atomizadoresTotal={state.atomizadores.total}
            atomizadoresUsados={atomizadoresUsados}
            atomizadoresRestantes={atomizadoresRestantes}
            jeringasTotal={state.jeringas.total}
            jeringasUsadas={jeringasUsadas}
            jeringasRestantes={jeringasRestantes}
            onActualizarAtomizadoresTotal={actualizarAtomizadoresTotal}
            onActualizarJeringasTotal={actualizarJeringasTotal}
            onActualizarPerfume={actualizarPerfume}
            onBorrarPerfume={borrarPerfume}
          />
        )}

        {tab === "gastos" && (
          <Gastos
            items={state.investment.items}
            totalInvertido={totalInvertido}
            perfumes={state.perfumes}
            atomizadoresRestantes={atomizadoresRestantes}
            jeringasRestantes={jeringasRestantes}
            onAgregarPerfume={agregarPerfume}
            onAgregarGasto={agregarGasto}
            onBorrarGasto={borrarGasto}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function Header({ saving, error }) {
  return (
    <header style={styles.header}>
      <div>
        <div style={styles.eyebrowless}>Pedro &amp; Ángel</div>
        <h1 style={styles.wordmark}>Decants</h1>
      </div>
      <div style={styles.saveState}>
        {error ? (
          <span style={{ color: "#9C4A3B" }}>{error}</span>
        ) : saving ? (
          <span>Guardando…</span>
        ) : (
          <span>Guardado</span>
        )}
      </div>
    </header>
  );
}

function TabNav({ tab, setTab }) {
  const tabs = [
    ["resumen", "Resumen"],
    ["ventas", "Ventas"],
    ["inventario", "Inventario"],
    ["gastos", "Gastos"],
  ];
  return (
    <nav style={styles.tabNav}>
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          style={{
            ...styles.tabButton,
            ...(tab === key ? styles.tabButtonActive : {}),
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function Bottle({ pct }) {
  // pct: 0..1 fill of the bottle body
  const bodyHeight = 92;
  const fillHeight = Math.max(0, Math.min(1, pct)) * bodyHeight;
  const fillY = 30 + (bodyHeight - fillHeight);
  return (
    <svg width="72" height="130" viewBox="0 0 72 130" fill="none">
      <defs>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9A857" />
          <stop offset="100%" stopColor="#B8863E" />
        </linearGradient>
        <clipPath id="bottleClip">
          <path d="M22 30 Q22 22 30 22 L42 22 Q50 22 50 30 L54 34 Q60 40 60 52 L60 112 Q60 122 50 122 L22 122 Q12 122 12 112 L12 52 Q12 40 18 34 Z" />
        </clipPath>
      </defs>
      <path
        d="M22 30 Q22 22 30 22 L42 22 Q50 22 50 30 L54 34 Q60 40 60 52 L60 112 Q60 122 50 122 L22 122 Q12 122 12 112 L12 52 Q12 40 18 34 Z"
        fill="#F8F4EC"
        stroke="#DDD3BE"
        strokeWidth="1.5"
      />
      <rect x="12" y={fillY} width="48" height={bodyHeight + 30} fill="url(#liquid)" clipPath="url(#bottleClip)" />
      <rect x="26" y="8" width="20" height="16" rx="3" fill="#3F5744" />
      <rect x="24" y="4" width="24" height="7" rx="2" fill="#2D4033" />
    </svg>
  );
}

function Resumen({
  totalInvertido,
  perPersona,
  socios,
  pagador,
  transferido,
  onToggleTransferido,
  recuperadoPct,
  ingresosTotales,
  inversionCubierta,
  netoAcumulado,
  gananciaPorSocio,
  perfumeStats,
}) {
  const receptor = socios.find((s) => s !== pagador) || socios[0];
  return (
    <div style={styles.section}>
      <div style={styles.heroRow}>
        <Bottle pct={recuperadoPct} />
        <div style={{ flex: 1 }}>
          <div style={styles.heroLabel}>Inversión recuperada</div>
          <div style={styles.heroNumber}>
            {formatARS(ingresosTotales)}
            <span style={styles.heroNumberMuted}> / {formatARS(totalInvertido)}</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${recuperadoPct * 100}%` }} />
          </div>
          <div style={styles.heroSub}>
            {inversionCubierta
              ? `Inversión cubierta. Ganancia acumulada: ${formatARS(netoAcumulado)}.`
              : `Faltan ${formatARS(totalInvertido - ingresosTotales)} para cubrir lo invertido.`}
          </div>
        </div>
      </div>

      <div className="dk-grid-2" style={styles.cardGrid}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Reparto 50/50</div>
          <div style={styles.cardBig}>{formatARS(perPersona)}</div>
          <div style={styles.cardNote}>corresponde a cada uno de la inversión inicial</div>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={transferido} onChange={onToggleTransferido} />
            <span>
              {receptor} le transfirió {formatARS(perPersona)} a {pagador}
            </span>
          </label>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Ganancia repartible</div>
          {netoAcumulado >= 0 ? (
            <>
              <div style={styles.cardBig}>{formatARS(gananciaPorSocio)}</div>
              <div style={styles.cardNote}>
                para cada socio · ganancia total {formatARS(netoAcumulado)} dividida por 2
              </div>
            </>
          ) : (
            <>
              <div style={{ ...styles.cardBig, color: colors.brick }}>
                -{formatARS(Math.abs(netoAcumulado))}
              </div>
              <div style={styles.cardNote}>
                faltan para cubrir la inversión y empezar a repartir ganancia
              </div>
            </>
          )}
        </div>
      </div>

      <Objetivos ingresosTotales={ingresosTotales} />

      <h2 style={styles.subheading}>Por perfume</h2>
      <div style={styles.perfumeList}>
        {perfumeStats.map((p) => (
          <div key={p.id} style={styles.perfumeRow}>
            <div style={styles.perfumeName}>{p.nombre}</div>
            <div style={styles.perfumeMeta}>
              {p.vendidos} de {p.decantsTotal} decants vendidos · {p.restantes} disponibles
            </div>
            <div style={styles.perfumeBarTrack}>
              <div
                style={{
                  ...styles.perfumeBarFill,
                  width: `${p.decantsTotal ? (p.vendidos / p.decantsTotal) * 100 : 0}%`,
                }}
              />
            </div>
            <div style={styles.perfumeNumbers}>
              <span>Ingresos {formatARS(p.ingresos)}</span>
              <span>Ganancia bruta {formatARS(p.gananciaBruta)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCompactARS(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return formatARS(n);
}

const OBJETIVOS = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000];

function Objetivos({ ingresosTotales }) {
  const proximo = OBJETIVOS.find((o) => o > ingresosTotales) || OBJETIVOS[OBJETIVOS.length - 1];
  const alcanzados = OBJETIVOS.filter((o) => ingresosTotales >= o).length;

  return (
    <div>
      <h2 style={styles.subheading}>Objetivos de facturación</h2>
      <div style={styles.cardNote}>
        {alcanzados} de {OBJETIVOS.length} alcanzados · próximo: {formatCompactARS(proximo)}
      </div>
      <div className="dk-obj-grid" style={styles.objetivosGrid}>
        {OBJETIVOS.map((o) => {
          const logrado = ingresosTotales >= o;
          const anterior = OBJETIVOS[OBJETIVOS.indexOf(o) - 1] || 0;
          const pct = logrado
            ? 1
            : Math.max(0, Math.min(1, (ingresosTotales - anterior) / (o - anterior)));
          return (
            <div
              key={o}
              style={{
                ...styles.objetivoChip,
                ...(logrado ? styles.objetivoChipDone : {}),
              }}
            >
              <div style={styles.objetivoTop}>
                <span>{formatCompactARS(o)}</span>
                {logrado && <span style={styles.objetivoCheck}>✓</span>}
              </div>
              <div style={styles.perfumeBarTrack}>
                <div
                  style={{
                    ...styles.perfumeBarFill,
                    width: `${pct * 100}%`,
                    background: logrado ? colors.green : colors.amber,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ventas({ perfumes, perfumeStats, ventas, onRegistrar, onBorrar }) {
  const [perfumeId, setPerfumeId] = useState(perfumes[0]?.id || "");
  const [precio, setPrecio] = useState(perfumes[0]?.precioSugerido || "");
  const [comprador, setComprador] = useState("");
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    const p = perfumes.find((p) => p.id === perfumeId);
    if (p) setPrecio(p.precioSugerido);
    setCantidad(1);
  }, [perfumeId]); // eslint-disable-line

  const stat = perfumeStats.find((p) => p.id === perfumeId);
  const sinStock = stat && stat.restantes <= 0;
  const cantidadNum = Math.max(1, Number(cantidad) || 1);
  const excedeStock = stat && cantidadNum > stat.restantes;

  return (
    <div style={styles.section}>
      <div style={styles.card}>
        <div style={styles.cardLabel}>Registrar venta</div>
        <div style={styles.formRow}>
          <select style={styles.input} value={perfumeId} onChange={(e) => setPerfumeId(e.target.value)}>
            {perfumes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio"
          />
          <input
            style={{ ...styles.input, width: 70 }}
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Cant."
            title="Cantidad de decants vendidos a este precio"
          />
          <input
            style={styles.input}
            type="text"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            placeholder="Comprador (opcional)"
          />
          <button
            style={styles.buttonPrimary}
            disabled={!perfumeId || !(Number(precio) > 0)}
            onClick={() => {
              onRegistrar(perfumeId, precio, comprador, cantidadNum);
              setComprador("");
              setCantidad(1);
            }}
          >
            {cantidadNum > 1 ? `Agregar ${cantidadNum} ventas` : "Agregar venta"}
          </button>
        </div>
        {precio && !(Number(precio) > 0) && (
          <div style={styles.warningNote}>El precio tiene que ser mayor a $0.</div>
        )}
        {sinStock && <div style={styles.warningNote}>No quedan decants disponibles de este perfume.</div>}
        {!sinStock && excedeStock && (
          <div style={styles.warningNote}>
            Solo quedan {stat.restantes} disponibles, pero estás cargando {cantidadNum}.
          </div>
        )}
      </div>

      <h2 style={styles.subheading}>Historial de ventas</h2>
      {ventas.length === 0 ? (
        <div style={styles.emptyState}>Todavía no registraste ninguna venta.</div>
      ) : (
        <div style={styles.table}>
          {ventas.map((v) => {
            const p = perfumes.find((p) => p.id === v.perfumeId);
            return (
              <div key={v.id} style={styles.tableRow}>
                <div style={styles.tableCellMain}>
                  <div>{p?.nombre || v.perfumeId}</div>
                  <div style={styles.tableCellSub}>
                    {v.fecha}
                    {v.comprador ? ` · ${v.comprador}` : ""}
                  </div>
                </div>
                <div style={styles.tableCellPrice}>{formatARS(v.precio)}</div>
                <button style={styles.deleteButton} onClick={() => onBorrar(v.id)} aria-label="Borrar venta">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InlineNumberField({ value, onCommit, suffix, width = 64 }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isNaN(n)) {
      onCommit(n);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        style={{ ...styles.input, width, padding: "6px 8px" }}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {suffix ? <span style={{ fontSize: 12.5, color: colors.inkSoft }}>{suffix}</span> : null}
    </span>
  );
}

function Inventario({
  perfumeStats,
  atomizadoresTotal,
  atomizadoresUsados,
  atomizadoresRestantes,
  jeringasTotal,
  jeringasUsadas,
  jeringasRestantes,
  onActualizarAtomizadoresTotal,
  onActualizarJeringasTotal,
  onActualizarPerfume,
  onBorrarPerfume,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <div style={styles.section}>
      <div className="dk-grid-2" style={styles.cardGrid}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Atomizadores de vidrio</div>
          <div style={styles.cardBig}>
            {atomizadoresRestantes}
            <span style={styles.heroNumberMuted}> / </span>
            <InlineNumberField value={atomizadoresTotal} onCommit={onActualizarAtomizadoresTotal} />
          </div>
          <div style={styles.cardNote}>disponibles · {atomizadoresUsados} ya asignados</div>
          {atomizadoresRestantes < 0 && (
            <div style={styles.warningNote}>
              Asignaste {Math.abs(atomizadoresRestantes)} de más. Sumá stock o ajustá los perfumes.
            </div>
          )}
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Jeringas</div>
          <div style={styles.cardBig}>
            {jeringasRestantes}
            <span style={styles.heroNumberMuted}> / </span>
            <InlineNumberField value={jeringasTotal} onCommit={onActualizarJeringasTotal} />
          </div>
          <div style={styles.cardNote}>disponibles · {jeringasUsadas} ya asignadas</div>
          {jeringasRestantes < 0 && (
            <div style={styles.warningNote}>
              Asignaste {Math.abs(jeringasRestantes)} de más. Sumá stock o ajustá los perfumes.
            </div>
          )}
        </div>
      </div>

      <h2 style={styles.subheading}>Stock por perfume</h2>
      <div style={styles.perfumeList}>
        {perfumeStats.map((p) => {
          const expanded = expandedId === p.id;
          return (
            <div key={p.id} style={styles.perfumeRow}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpandedId(expanded ? null : p.id)}
              >
                <div>
                  <div style={styles.perfumeName}>{p.nombre}</div>
                  <div style={styles.perfumeMeta}>
                    {p.mlTotal}ml en frascos de {p.mlPorDecant}ml · rinde {p.decantsTotal} decants
                  </div>
                </div>
                <div style={styles.tableCellPrice}>{p.restantes} disponibles</div>
              </div>

              {expanded && (
                <div className="dk-form-grid" style={styles.formGrid}>
                  <label style={styles.formLabel}>
                    ml totales del frasco
                    <InlineNumberField
                      value={p.mlTotal}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { mlTotal: n })}
                    />
                  </label>
                  <label style={styles.formLabel}>
                    ml por decant
                    <InlineNumberField
                      value={p.mlPorDecant}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { mlPorDecant: Math.max(1, n) })}
                    />
                  </label>
                  <label style={styles.formLabel}>
                    Costo por decant
                    <InlineNumberField
                      value={p.costoPorDecant}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { costoPorDecant: n })}
                    />
                  </label>
                  <label style={styles.formLabel}>
                    Precio de venta sugerido
                    <InlineNumberField
                      value={p.precioSugerido}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { precioSugerido: n })}
                    />
                  </label>
                  <label style={styles.formLabel}>
                    Atomizadores usados
                    <InlineNumberField
                      value={p.atomizadoresUsados || 0}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { atomizadoresUsados: Math.max(0, n) })}
                    />
                  </label>
                  <label style={styles.formLabel}>
                    Jeringas usadas
                    <InlineNumberField
                      value={p.jeringasUsadas || 0}
                      width={90}
                      onCommit={(n) => onActualizarPerfume(p.id, { jeringasUsadas: Math.max(0, n) })}
                    />
                  </label>
                </div>
              )}

              {expanded && (
                <div style={{ marginTop: 12 }}>
                  {confirmDeleteId === p.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ ...styles.warningNote, marginTop: 0 }}>
                        ¿Eliminar {p.nombre} del inventario? Las ventas ya cargadas se mantienen en el
                        historial.
                      </span>
                      <button
                        style={{ ...styles.buttonPrimary, background: colors.brick }}
                        onClick={() => {
                          onBorrarPerfume(p.id);
                          setConfirmDeleteId(null);
                          setExpandedId(null);
                        }}
                      >
                        Sí, eliminar
                      </button>
                      <button style={styles.buttonGhost} onClick={() => setConfirmDeleteId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button style={styles.buttonGhost} onClick={() => setConfirmDeleteId(p.id)}>
                      Eliminar perfume del inventario
                    </button>
                  )}
                </div>
              )}
              <div style={styles.cardNote}>
                {p.vendidos} vendidos · {expanded ? "tocá la fila para cerrar" : "tocá la fila para editar el stock"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Gastos({
  items,
  totalInvertido,
  perfumes,
  atomizadoresRestantes,
  jeringasRestantes,
  onAgregarPerfume,
  onAgregarGasto,
  onBorrarGasto,
}) {
  const [showForm, setShowForm] = useState(false);
  const [showGastoSuelto, setShowGastoSuelto] = useState(false);
  const [gastoNombre, setGastoNombre] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [nombre, setNombre] = useState("");
  const [costoPerfume, setCostoPerfume] = useState("");
  const [mlTotal, setMlTotal] = useState(100);
  const [mlPorDecant, setMlPorDecant] = useState(5);
  const [costoPorDecant, setCostoPorDecant] = useState(3000);
  const [precioSugerido, setPrecioSugerido] = useState(8500);
  const [atomizadoresAUsar, setAtomizadoresAUsar] = useState(20);

  const decantsProyectados = mlPorDecant ? Math.floor(mlTotal / mlPorDecant) : 0;
  const puedeGuardar = nombre && costoPerfume && atomizadoresAUsar <= atomizadoresRestantes;

  const guardar = () => {
    const id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
    onAgregarPerfume({
      id,
      nombre,
      mlTotal: Number(mlTotal),
      mlPorDecant: Number(mlPorDecant),
      costoPorDecant: Number(costoPorDecant),
      precioSugerido: Number(precioSugerido),
      atomizadoresUsados: Number(atomizadoresAUsar),
      jeringasUsadas: 1,
      _gastos: [{ nombre: `Perfume ${nombre}`, monto: Number(costoPerfume) }],
    });
    setShowForm(false);
    setNombre("");
    setCostoPerfume("");
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.subheading}>Gastos realizados</h2>
      <div style={styles.table}>
        {items.map((it) => (
          <div key={it.id} style={styles.tableRow}>
            <div style={styles.tableCellMain}>{it.name}</div>
            <div style={styles.tableCellPrice}>{formatARS(it.amount)}</div>
            {onBorrarGasto && (
              <button style={styles.deleteButton} onClick={() => onBorrarGasto(it.id)} aria-label="Borrar gasto">
                ×
              </button>
            )}
          </div>
        ))}
        <div style={{ ...styles.tableRow, borderTop: "1px solid #24201A" }}>
          <div style={{ ...styles.tableCellMain, fontWeight: 600 }}>Total invertido</div>
          <div style={{ ...styles.tableCellPrice, fontWeight: 600 }}>{formatARS(totalInvertido)}</div>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        {!showForm && !showGastoSuelto && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={styles.buttonSecondary} onClick={() => setShowForm(true)}>
              + Sumar próxima compra / perfume
            </button>
            <button style={styles.buttonGhost} onClick={() => setShowGastoSuelto(true)}>
              + Agregar otro gasto
            </button>
          </div>
        )}

        {showGastoSuelto && (
          <div style={styles.card}>
            <div style={styles.cardLabel}>Nuevo gasto</div>
            <div className="dk-form-grid" style={styles.formGrid}>
              <label style={styles.formLabel}>
                Descripción
                <input
                  style={styles.input}
                  value={gastoNombre}
                  onChange={(e) => setGastoNombre(e.target.value)}
                  placeholder="Ej: envío, atomizadores extra"
                />
              </label>
              <label style={styles.formLabel}>
                Monto
                <input
                  style={styles.input}
                  type="number"
                  value={gastoMonto}
                  onChange={(e) => setGastoMonto(e.target.value)}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                style={styles.buttonPrimary}
                disabled={!gastoNombre || !(Number(gastoMonto) > 0)}
                onClick={() => {
                  onAgregarGasto(gastoNombre, gastoMonto);
                  setGastoNombre("");
                  setGastoMonto("");
                  setShowGastoSuelto(false);
                }}
              >
                Guardar
              </button>
              <button style={styles.buttonGhost} onClick={() => setShowGastoSuelto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div style={styles.card}>
            <div style={styles.cardLabel}>Nueva compra</div>
            <div className="dk-form-grid" style={styles.formGrid}>
              <label style={styles.formLabel}>
                Nombre del perfume
                <input style={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label style={styles.formLabel}>
                Costo total del perfume
                <input
                  style={styles.input}
                  type="number"
                  value={costoPerfume}
                  onChange={(e) => setCostoPerfume(e.target.value)}
                />
              </label>
              <label style={styles.formLabel}>
                ml totales
                <input
                  style={styles.input}
                  type="number"
                  value={mlTotal}
                  onChange={(e) => setMlTotal(e.target.value)}
                />
              </label>
              <label style={styles.formLabel}>
                ml por decant
                <input
                  style={styles.input}
                  type="number"
                  value={mlPorDecant}
                  onChange={(e) => setMlPorDecant(e.target.value)}
                />
              </label>
              <label style={styles.formLabel}>
                Costo por decant
                <input
                  style={styles.input}
                  type="number"
                  value={costoPorDecant}
                  onChange={(e) => setCostoPorDecant(e.target.value)}
                />
              </label>
              <label style={styles.formLabel}>
                Precio de venta sugerido
                <input
                  style={styles.input}
                  type="number"
                  value={precioSugerido}
                  onChange={(e) => setPrecioSugerido(e.target.value)}
                />
              </label>
              <label style={styles.formLabel}>
                Atomizadores a usar ({atomizadoresRestantes} disponibles)
                <input
                  style={styles.input}
                  type="number"
                  value={atomizadoresAUsar}
                  onChange={(e) => setAtomizadoresAUsar(e.target.value)}
                />
              </label>
            </div>
            <div style={styles.cardNote}>Rinde ~{decantsProyectados} decants</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={styles.buttonPrimary} disabled={!puedeGuardar} onClick={guardar}>
                Guardar
              </button>
              <button style={styles.buttonGhost} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');

.dk-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.dk-obj-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 10px; }
.dk-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }

@media (max-width: 520px) {
  .dk-grid-2 { grid-template-columns: 1fr; }
  .dk-obj-grid { grid-template-columns: repeat(2, 1fr); }
  .dk-form-grid { grid-template-columns: 1fr; }
}
`;

const colors = {
  bg: "#F1ECE1",
  surface: "#FFFFFF",
  border: "#E4DCC9",
  ink: "#24201A",
  inkSoft: "#5C5347",
  amber: "#B8863E",
  amberDeep: "#8F6A30",
  green: "#3F5744",
  brick: "#9C4A3B",
};

const styles = {
  app: {
    background: colors.bg,
    minHeight: "100%",
    fontFamily: "'Work Sans', sans-serif",
    color: colors.ink,
    padding: "0 0 40px",
  },
  shell: { maxWidth: 720, margin: "0 auto", padding: "28px 20px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 22,
  },
  eyebrowless: { fontSize: 13, color: colors.inkSoft, marginBottom: 2 },
  wordmark: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    fontSize: 34,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  saveState: { fontSize: 12, color: colors.inkSoft },
  tabNav: {
    display: "flex",
    gap: 4,
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: 24,
  },
  tabButton: {
    background: "none",
    border: "none",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "'Work Sans', sans-serif",
    color: colors.inkSoft,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -1,
  },
  tabButtonActive: {
    color: colors.ink,
    borderBottom: `2px solid ${colors.amber}`,
    fontWeight: 600,
  },
  section: { display: "flex", flexDirection: "column", gap: 24 },
  heroRow: {
    display: "flex",
    gap: 20,
    alignItems: "center",
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "22px 24px",
  },
  heroLabel: { fontSize: 13, color: colors.inkSoft, marginBottom: 4 },
  heroNumber: {
    fontFamily: "'Fraunces', serif",
    fontSize: 30,
    fontWeight: 500,
  },
  heroNumberMuted: { color: colors.inkSoft, fontSize: 18 },
  heroSub: { fontSize: 13, color: colors.inkSoft, marginTop: 8 },
  progressTrack: {
    height: 6,
    background: colors.border,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", background: colors.amber },
  cardGrid: {},
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "18px 20px",
  },
  cardLabel: { fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  cardBig: { fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500 },
  cardNote: { fontSize: 12.5, color: colors.inkSoft, marginTop: 4 },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    marginTop: 12,
    color: colors.ink,
  },
  subheading: {
    fontFamily: "'Fraunces', serif",
    fontSize: 19,
    fontWeight: 500,
    margin: "4px 0 -8px",
  },
  perfumeList: { display: "flex", flexDirection: "column", gap: 14 },
  perfumeRow: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "16px 18px",
  },
  perfumeName: { fontWeight: 600, fontSize: 15 },
  perfumeMeta: { fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  perfumeBarTrack: {
    height: 5,
    background: colors.border,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  perfumeBarFill: { height: "100%", background: colors.green },
  perfumeNumbers: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 8,
  },
  formRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  formGrid: {},
  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13.5,
    fontFamily: "'Work Sans', sans-serif",
    background: "#FCFAF5",
    color: colors.ink,
    outline: "none",
  },
  buttonPrimary: {
    background: colors.amber,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Work Sans', sans-serif",
  },
  buttonSecondary: {
    background: "transparent",
    color: colors.amberDeep,
    border: `1px solid ${colors.amber}`,
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Work Sans', sans-serif",
  },
  buttonGhost: {
    background: "transparent",
    color: colors.inkSoft,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "'Work Sans', sans-serif",
  },
  warningNote: { fontSize: 12.5, color: colors.brick, marginTop: 10 },
  emptyState: {
    fontSize: 13.5,
    color: colors.inkSoft,
    border: `1px dashed ${colors.border}`,
    borderRadius: 10,
    padding: "20px",
    textAlign: "center",
  },
  table: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: `1px solid ${colors.border}`,
    gap: 10,
  },
  tableCellMain: { fontSize: 13.5 },
  tableCellSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  tableCellPrice: { fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" },
  objetivosGrid: {},
  objetivoChip: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "10px 12px",
  },
  objetivoChipDone: {
    borderColor: colors.green,
  },
  objetivoTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  },
  objetivoCheck: { color: colors.green, fontSize: 13 },
  deleteButton: {
    background: "none",
    border: "none",
    color: colors.inkSoft,
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 4px",
  },
};
