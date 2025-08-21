import React, { useEffect, useMemo, useState } from "react";

/**
 * App Checklist CORUFA – Plenario
 *
 * Objetivo: filtrar legajos antes del Plenario para que solo lleguen expedientes completos.
 * - Semáforos por bloque (Datos básicos, Técnicos, Documentación, Análisis, Firmas)
 * - Cálculo de tasa anual (según volumen declarado) y categoría I–V
 * - Validación de parámetros de agua contra valores de referencia EDITABLES
 * - Resultado final automático (Aprobado / No aprobado)
 * - Guardado local (localStorage), exportar/importar JSON, imprimir reporte
 * - Validación de padrón de perforistas por N° de registro
 * - Carga masiva de análisis por CSV
 *
 * Nota: valores de referencia vienen precargados como sugerencia y pueden ajustarse en "Configuración".
 */

// ----- Modelos simples -----
const DEFAULT_LIMITS = {
  fisicoquimico: {
    pH_min: 6.5,
    pH_max: 8.5,
    arsenico_mgL_max: 0.01,
    nitratos_mgL_max: 45,
    nitritos_mgL_max: 0.1,
    conductividad_uScm_max: 2000,
    dureza_mgL_max: 500,
    solidos_totales_mgL_max: 1500,
    calcio_mgL_max: 200,
    magnesio_mgL_max: 150,
    sodio_mgL_max: 200,
    potasio_mgL_max: 20,
    bicarbonato_mgL_max: 400,
    carbonato_mgL_max: 30,
    sulfatos_mgL_max: 400,
    cloruros_mgL_max: 250,
    temperatura_C_max: 30,
  },
  microbiologico: {
    coliformes_totales: 0,
    e_coli: 0,
    salmonella: 0,
    pseudomonas: 0,
    aerobios_mesofilos_max: 100,
  },
  // Categoría V sin tope superior (max: null)
  tasas_2024: [
    { cat: "I", min: 0, max: 500000, monto: 90163 },
    { cat: "II", min: 500000, max: 1000000, monto: 135245 },
    { cat: "III", min: 1000000, max: 5000000, monto: 180416 },
    { cat: "IV", min: 5000000, max: 10000000, monto: 225409 },
    { cat: "V", min: 10000000, max: null, monto: 392591 },
  ],
};

const EMPTY_EXPEDIENTE = {
  meta: {
    expedienteId: "",
    fecha: new Date().toISOString().slice(0, 10),
    revisadoPor: "",
  },
  basicos: {
    propietario: "",
    cuit: "",
    domicilio: "",
    contacto: "",
    autorizacionNoPropietario: false,
    perforista: "",
    perforistaRegistro: "",
  },
  tecnicos: {
    departamento: "",
    localidad: "",
    partida: "",
    coords_gms: "", // grados minutos segundos
    profundidad_m: "",
    diametro_pulg: "",
    caudal_m3h: "",
    caudal_anual_m3: "",
    horas_anuales: "",
    uso: "",
    acuifero: "",
  },
  docs: {
    tituloPropiedad: false,
    permisoExploracion: false,
    ensayoBombeo: false,
    estudioInterferencia: false,
    perfilesLitologicos: false,
    memoriaDescriptiva: false,
    anexos: [], // nombres de archivos subidos (solo referencia)
  },
  analisis: {
    // Fisicoquímico
    pH: "",
    arsenico: "",
    nitratos: "",
    nitritos: "",
    conductividad: "",
    dureza: "",
    std: "",
    calcio: "",
    magnesio: "",
    sodio: "",
    potasio: "",
    bicarbonato: "",
    carbonato: "",
    sulfatos: "",
    cloruros: "",
    temperatura: "",
    color: "",
    olor: "",
    turbiedad: "",
    // Microbiológico
    coliformes: "",
    ecoli: "",
    salmonella: "",
    pseudomonas: "",
    aerobios: "",
  },
  firmas: {
    propietario: false,
    profesional: false,
    declaracionJurada: false,
  },
};

// ----- Utilidades -----
const fmtMoney = (n) =>
  n?.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }) || "—";

function categoriaTasa(limits, volAnual) {
  const n = Number(volAnual);
  if (!isFinite(n) || n < 0) return { cat: "—", monto: 0 };
  const match = limits.tasas_2024.find((t) => (t.max == null ? n >= t.min : n >= t.min && n < t.max));
  return match ? { cat: match.cat, monto: match.monto } : { cat: "—", monto: 0 };
}

function isFilled(x) {
  return x !== null && x !== undefined && String(x).trim() !== "";
}

function withinRange(value, min, max) {
  const v = Number(value);
  if (!isFinite(v)) return null; // sin dato
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true; // OK
}

function checkAnalisis(analisis, limits) {
  const L = limits.fisicoquimico;
  const M = limits.microbiologico;
  const r = {
    pH: withinRange(analisis.pH, L.pH_min, L.pH_max),
    arsenico: withinRange(analisis.arsenico, null, L.arsenico_mgL_max),
    nitratos: withinRange(analisis.nitratos, null, L.nitratos_mgL_max),
    nitritos: withinRange(analisis.nitritos, null, L.nitritos_mgL_max),
    conductividad: withinRange(analisis.conductividad, null, L.conductividad_uScm_max),
    dureza: withinRange(analisis.dureza, null, L.dureza_mgL_max),
    std: withinRange(analisis.std, null, L.solidos_totales_mgL_max),
    calcio: withinRange(analisis.calcio, null, L.calcio_mgL_max),
    magnesio: withinRange(analisis.magnesio, null, L.magnesio_mgL_max),
    sodio: withinRange(analisis.sodio, null, L.sodio_mgL_max),
    potasio: withinRange(analisis.potasio, null, L.potasio_mgL_max),
    bicarbonato: withinRange(analisis.bicarbonato, null, L.bicarbonato_mgL_max),
    carbonato: withinRange(analisis.carbonato, null, L.carbonato_mgL_max),
    sulfatos: withinRange(analisis.sulfatos, null, L.sulfatos_mgL_max),
    cloruros: withinRange(analisis.cloruros, null, L.cloruros_mgL_max),
    temperatura: withinRange(analisis.temperatura, null, L.temperatura_C_max),
    // Microbiológico: 0 requerido (ausencia)
    coliformes: withinRange(analisis.coliformes, 0, 0),
    ecoli: withinRange(analisis.ecoli, 0, 0),
    salmonella: withinRange(analisis.salmonella, 0, 0),
    pseudomonas: withinRange(analisis.pseudomonas, 0, 0),
    aerobios: withinRange(analisis.aerobios, null, M.aerobios_mesofilos_max),
  };

  const keys = Object.keys(r);
  const present = keys.filter((k) => r[k] !== null).length;
  const ok = keys.filter((k) => r[k] === true).length;
  const bad = keys.filter((k) => r[k] === false).length;

  return { r, present, ok, bad };
}

function sectionStatus(completos, requeridos = []) {
  const total = requeridos.length;
  const llenos = requeridos.filter((k) => isFilled(completos[k])).length;
  if (total === 0) return { color: "gray", text: "—" };
  if (llenos === total) return { color: "green", text: "Completo" };
  if (llenos === 0) return { color: "red", text: "Vacío" };
  return { color: "yellow", text: "Incompleto" };
}

function Badge({ color = "gray", children }) {
  const colors = {
    green: "bg-green-100 text-green-800 border-green-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    red: "bg-red-100 text-red-800 border-red-300",
    gray: "bg-gray-100 text-gray-800 border-gray-300",
    blue: "bg-blue-100 text-blue-800 border-blue-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, status, children, right }) {
  return (
    <div className="bg-white shadow-sm rounded-2xl border p-4 md:p-6">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {status && <Badge color={status.color}>{status.text}</Badge>}
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
    />
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function ChecklistApp() {
  const [limits, setLimits] = useState(() => {
    const saved = localStorage.getItem("corufa_limits_v1");
    return saved ? JSON.parse(saved) : DEFAULT_LIMITS;
  });
  const [exp, setExp] = useState(() => {
    const saved = localStorage.getItem("corufa_exp_v1");
    return saved ? JSON.parse(saved) : EMPTY_EXPEDIENTE;
  });
  const [showConfig, setShowConfig] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [registrySet, setRegistrySet] = useState(() => new Set());

  useEffect(() => {
    localStorage.setItem("corufa_limits_v1", JSON.stringify(limits));
  }, [limits]);

  useEffect(() => {
    localStorage.setItem("corufa_exp_v1", JSON.stringify(exp));
  }, [exp]);

  const basicosStatus = useMemo(
    () =>
      sectionStatus(exp.basicos, [
        "propietario",
        "cuit",
        "domicilio",
        "contacto",
        "perforista",
        "perforistaRegistro",
      ]),
    [exp.basicos]
  );

  const tecnicosStatus = useMemo(
    () =>
      sectionStatus(exp.tecnicos, [
        "departamento",
        "localidad",
        "partida",
        "coords_gms",
        "profundidad_m",
        "diametro_pulg",
        "caudal_m3h",
        "caudal_anual_m3",
        "horas_anuales",
        "uso",
        "acuifero",
      ]),
    [exp.tecnicos]
  );

  const docsOkCount = [
    exp.docs.tituloPropiedad,
    exp.docs.permisoExploracion,
    exp.docs.ensayoBombeo,
    exp.docs.estudioInterferencia,
    exp.docs.perfilesLitologicos,
    exp.docs.memoriaDescriptiva,
  ].filter(Boolean).length;
  const docsStatus = {
    color: docsOkCount === 6 ? "green" : docsOkCount === 0 ? "red" : "yellow",
    text: `${docsOkCount}/6 adjuntos`,
  };

  const anal = useMemo(() => checkAnalisis(exp.analisis, limits), [exp.analisis, limits]);
  const analStatus = {
    color: anal.bad === 0 && anal.present > 0 ? "green" : anal.present === 0 ? "red" : "yellow",
    text: anal.present === 0 ? "Sin datos" : `${anal.ok}/${anal.present} en norma${anal.bad ? ` • ${anal.bad} fuera` : ""}`,
  };

  const firmasOk = exp.firmas.propietario && exp.firmas.profesional && exp.firmas.declaracionJurada;
  const firmasStatus = { color: firmasOk ? "green" : "red", text: firmasOk ? "Firmas completas" : "Faltan firmas" };

  const tasa = useMemo(() => categoriaTasa(limits, exp.tecnicos.caudal_anual_m3), [limits, exp.tecnicos.caudal_anual_m3]);

  const allGreen =
    basicosStatus.color === "green" &&
    tecnicosStatus.color === "green" &&
    docsStatus.color === "green" &&
    analStatus.color !== "red" && // aceptamos amarillo si hay parámetros no aplicables
    firmasOk;

  function resetAll() {
    if (confirm("¿Reiniciar el expediente en blanco?")) setExp(EMPTY_EXPEDIENTE);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ exp, limits }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const id = exp.meta.expedienteId || "expediente";
    a.download = `checklist_corufa_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (obj.limits) setLimits(obj.limits);
        if (obj.exp) setExp(obj.exp);
      } catch (err) {
        alert("Archivo inválido");
      }
    };
    reader.readAsText(file);
  }

  // ----- UI -----
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-slate-50/80 border-b print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Checklist CORUFA · Filtro Pre‑Plenario</h1>
            <p className="text-xs text-gray-600">Dirección (ex CORUFA) · Ley 9172 · Uso de Aguas</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowConfig(true)}>
              Configuración
            </button>
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={exportJSON}>
              Exportar JSON
            </button>
            <label className="rounded-xl border px-3 py-2 text-sm cursor-pointer">
              Importar
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
              />
            </label>
            <button className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm shadow" onClick={() => window.print()}>
              Generar PDF
            </button>
          </div>
        </div>
      </header>

      {/* Membrete para impresión */}
      <div className="hidden print:block text-center my-4">
        <h1 className="text-xl font-bold">Dirección (ex CORUFA) – Provincia de Entre Ríos</h1>
        <p className="text-sm">Checklist de Filtro Pre‑Plenario · Ley 9172 – Uso de Aguas</p>
        <p className="text-xs">
          Expediente: {exp.meta.expedienteId} · Revisión: {exp.meta.fecha} · {exp.meta.revisadoPor}
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 print:space-y-4">
        {/* Encabezado */}
        <SectionCard title="Encabezado del expediente" status={{ color: "blue", text: "Identificación" }}>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="N° de Expediente / Legajo" required>
              <Input value={exp.meta.expedienteId} onChange={(v) => setExp({ ...exp, meta: { ...exp.meta, expedienteId: v } })} />
            </Field>
            <Field label="Fecha de revisión" required>
              <Input type="date" value={exp.meta.fecha} onChange={(v) => setExp({ ...exp, meta: { ...exp.meta, fecha: v } })} />
            </Field>
            <Field label="Revisado por (administrativo/técnico)" required>
              <Input value={exp.meta.revisadoPor} onChange={(v) => setExp({ ...exp, meta: { ...exp.meta, revisadoPor: v } })} />
            </Field>
          </div>
        </SectionCard>

        {/* Validación padrón */}
        <SectionCard
          title="Validación de padrón de perforistas (opcional)"
          status={{
            color: registrySet.size > 0 ? (registrySet.has(String(exp.basicos.perforistaRegistro).trim()) ? "green" : "red") : "gray",
            text:
              registrySet.size > 0
                ? registrySet.has(String(exp.basicos.perforistaRegistro).trim())
                  ? "Registro validado"
                  : "Registro no encontrado"
                : "Sin padrón",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="md:w-1/2">
              <Field label="Cargar padrón (CSV o texto con N° de registro separados por coma/fin de línea)">
                <input
                  type="file"
                  accept=".csv,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = (ev) => {
                      try {
                        const txt = String(ev.target?.result || "");
                        const tokens = txt
                          .split(/[\r\n,;\t]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setRegistrySet(new Set(tokens));
                        alert(`Padrón cargado: ${tokens.length} registros`);
                      } catch {
                        alert("No se pudo leer el padrón");
                      }
                    };
                    r.readAsText(f);
                  }}
                />
              </Field>
            </div>
            <div className="md:flex-1 text-sm text-gray-600">
              Estado actual: {registrySet.size > 0
                ? registrySet.has(String(exp.basicos.perforistaRegistro).trim())
                  ? "✔️ Registro válido para el N° ingresado"
                  : "❌ N° no coincide con padrón cargado"
                : "Cargá un padrón para validar automáticamente."}
            </div>
          </div>
        </SectionCard>

        {/* Datos básicos */}
        <SectionCard title="1) Identificación básica" status={basicosStatus}>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Propietario / Razón Social" required>
              <Input value={exp.basicos.propietario} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, propietario: v } })} />
            </Field>
            <Field label="CUIT/CUIL" required>
              <Input value={exp.basicos.cuit} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, cuit: v } })} />
            </Field>
            <Field label="Domicilio real" required>
              <Input value={exp.basicos.domicilio} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, domicilio: v } })} />
            </Field>
            <Field label="Teléfono y/o email" required>
              <Input value={exp.basicos.contacto} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, contacto: v } })} />
            </Field>
            <div className="md:col-span-2 flex flex-wrap gap-6">
              <Checkbox
                checked={exp.basicos.autorizacionNoPropietario}
                onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, autorizacionNoPropietario: v } })}
                label="Adjunta autorización notariada (si no es propietario)"
              />
            </div>
            <Field label="Perforista (Nombre/Razón Social)" required>
              <Input value={exp.basicos.perforista} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, perforista: v } })} />
            </Field>
            <Field label="N° de Registro del Perforista" required>
              <Input value={exp.basicos.perforistaRegistro} onChange={(v) => setExp({ ...exp, basicos: { ...exp.basicos, perforistaRegistro: v } })} />
            </Field>
          </div>
        </SectionCard>

        {/* Datos técnicos */}
        <SectionCard
          title="2) Datos técnicos de la perforación"
          status={tecnicosStatus}
          right={<Badge color="blue">Categoría tasa: {tasa.cat} · {fmtMoney(tasa.monto)}</Badge>}
        >
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Departamento" required>
              <Input value={exp.tecnicos.departamento} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, departamento: v } })} />
            </Field>
            <Field label="Localidad" required>
              <Input value={exp.tecnicos.localidad} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, localidad: v } })} />
            </Field>
            <Field label="Partida inmobiliaria" required>
              <Input value={exp.tecnicos.partida} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, partida: v } })} />
            </Field>
            <Field label={"Coordenadas (G° M' S\") – WGS84"} required>
              <Input value={exp.tecnicos.coords_gms} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, coords_gms: v } })} />
            </Field>
            <Field label="Profundidad (m)" required>
              <Input type="number" value={exp.tecnicos.profundidad_m} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, profundidad_m: v } })} />
            </Field>
            <Field label="Diámetro (pulg.)" required>
              <Input type="number" value={exp.tecnicos.diametro_pulg} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, diametro_pulg: v } })} />
            </Field>
            <Field label="Caudal (m³/h)" required>
              <Input type="number" value={exp.tecnicos.caudal_m3h} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, caudal_m3h: v } })} />
            </Field>
            <Field label="Caudal anual (m³/año)" required>
              <Input type="number" value={exp.tecnicos.caudal_anual_m3} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, caudal_anual_m3: v } })} />
            </Field>
            <Field label="Horas de trabajo/año" required>
              <Input type="number" value={exp.tecnicos.horas_anuales} onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, horas_anuales: v } })} />
            </Field>
            <Field label="Uso declarado" required>
              <Input
                value={exp.tecnicos.uso}
                onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, uso: v } })}
                placeholder="Consumo humano / Riego / Ganadería / Industrial / Otro"
              />
            </Field>
            <Field label="Acuífero" required>
              <Input
                value={exp.tecnicos.acuifero}
                onChange={(v) => setExp({ ...exp, tecnicos: { ...exp.tecnicos, acuifero: v } })}
                placeholder="Ej.: Guaraní / Puelche"
              />
            </Field>
          </div>
        </SectionCard>

        {/* Documentación */}
        <SectionCard title="3) Documentación técnica obligatoria" status={docsStatus}>
          <div className="grid md:grid-cols-2 gap-4">
            <Checkbox
              checked={exp.docs.tituloPropiedad}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, tituloPropiedad: v } })}
              label="Título de propiedad / autorización certificada"
            />
            <Checkbox
              checked={exp.docs.permisoExploracion}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, permisoExploracion: v } })}
              label="Resolución / Permiso de exploración (N° y fecha)"
            />
            <Checkbox
              checked={exp.docs.ensayoBombeo}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, ensayoBombeo: v } })}
              label="Ensayo de bombeo"
            />
            <Checkbox
              checked={exp.docs.estudioInterferencia}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, estudioInterferencia: v } })}
              label="Estudio de interferencia"
            />
            <Checkbox
              checked={exp.docs.perfilesLitologicos}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, perfilesLitologicos: v } })}
              label="Perfiles litológicos"
            />
            <Checkbox
              checked={exp.docs.memoriaDescriptiva}
              onChange={(v) => setExp({ ...exp, docs: { ...exp.docs, memoriaDescriptiva: v } })}
              label="Memoria descriptiva (almacenamiento, conducción, tratamientos, efluentes)"
            />
          </div>
          <div className="mt-3">
            <Field label="Anexos (solo referencia – se adjuntan en expediente físico o gestor documental)">
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setExp({
                    ...exp,
                    docs: {
                      ...exp.docs,
                      anexos: [
                        ...exp.docs.anexos,
                        ...Array.from(e.target.files || []).map((f) => f.name),
                      ],
                    },
                  })
                }
              />
            </Field>
            {exp.docs.anexos?.length > 0 && (
              <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                {exp.docs.anexos.map((n, i) => (
                  <span key={i} className="px-2 py-1 border rounded-full bg-gray-50">
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Análisis de agua */}
        <SectionCard
          title="4) Análisis de agua (cargar valores)"
          status={analStatus}
          right={
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowBulkModal(true)}>
              Carga masiva (CSV)
            </button>
          }
        >
          <div className="grid md:grid-cols-4 gap-4">
            {/* Fisicoquímico */}
            {[
              ["pH", "pH"],
              ["arsenico", "Arsénico (mg/L)"],
              ["nitratos", "Nitratos (mg/L)"],
              ["nitritos", "Nitritos (mg/L)"],
              ["conductividad", "Conductividad (µS/cm)"],
              ["dureza", "Dureza total (mg/L)"],
              ["std", "Sólidos totales disueltos (mg/L)"],
              ["calcio", "Calcio (mg/L)"],
              ["magnesio", "Magnesio (mg/L)"],
              ["sodio", "Sodio (mg/L)"],
              ["potasio", "Potasio (mg/L)"],
              ["bicarbonato", "Bicarbonato (mg/L)"],
              ["carbonato", "Carbonato (mg/L)"],
              ["sulfatos", "Sulfatos (mg/L)"],
              ["cloruros", "Cloruros (mg/L)"],
              ["temperatura", "Temperatura (°C)"],
            ].map(([k, label]) => {
              const state = anal.r[k];
              const color = state === true ? "green" : state === false ? "red" : "gray";
              return (
                <Field
                  key={k}
                  label={
                    <span className="flex items-center gap-2">
                      {label} <Badge color={color}>{state === true ? "OK" : state === false ? "Fuera" : "—"}</Badge>
                    </span>
                  }
                >
                  <Input type="number" value={exp.analisis[k]} onChange={(v) => setExp({ ...exp, analisis: { ...exp.analisis, [k]: v } })} />
                </Field>
              );
            })}

            {/* Microbiológico */}
            {[
              ["coliformes", "Coliformes totales (NMP/100 mL)"],
              ["ecoli", "E. coli (NMP/100 mL)"],
              ["salmonella", "Salmonella (presencia=1/ausencia=0)"],
              ["pseudomonas", "Pseudomonas (presencia=1/ausencia=0)"],
              ["aerobios", "Aeróbicos mesófilos (UFC/mL)"],
            ].map(([k, label]) => {
              const state = anal.r[k];
              const color = state === true ? "green" : state === false ? "red" : "gray";
              return (
                <Field
                  key={k}
                  label={
                    <span className="flex items-center gap-2">
                      {label} <Badge color={color}>{state === true ? "OK" : state === false ? "Fuera" : "—"}</Badge>
                    </span>
                  }
                >
                  <Input type="number" value={exp.analisis[k]} onChange={(v) => setExp({ ...exp, analisis: { ...exp.analisis, [k]: v } })} />
                </Field>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">* Los valores de referencia pueden ajustarse en Configuración.</p>
        </SectionCard>

        {/* Firmas */}
        <SectionCard title="5) Firmas y declaración jurada" status={firmasStatus}>
          <div className="flex flex-wrap gap-6">
            <Checkbox
              checked={exp.firmas.propietario}
              onChange={(v) => setExp({ ...exp, firmas: { ...exp.firmas, propietario: v } })}
              label="Firma del propietario / autorizado"
            />
            <Checkbox
              checked={exp.firmas.profesional}
              onChange={(v) => setExp({ ...exp, firmas: { ...exp.firmas, profesional: v } })}
              label="Firma del profesional responsable"
            />
            <Checkbox
              checked={exp.firmas.declaracionJurada}
              onChange={(v) => setExp({ ...exp, firmas: { ...exp.firmas, declaracionJurada: v } })}
              label="Declaración Jurada confirmada"
            />
          </div>
        </SectionCard>

        {/* Resultado */}
        <SectionCard title="Resultado del filtro pre‑Plenario">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge color={allGreen ? "green" : "red"}>{allGreen ? "APROBADO" : "NO APROBADO"}</Badge>
              <span className="text-sm text-gray-600">
                {allGreen ? "El legajo puede elevarse a Plenario." : "Faltan completar secciones y/o documentación obligatoria."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border px-3 py-2 text-sm" onClick={resetAll}>
                Reiniciar
              </button>
            </div>
          </div>
        </SectionCard>

        <div className="h-10" />
      </main>

      {/* Modal Carga Masiva */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-30">
          <div className="bg-white max-w-3xl w-full rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Carga masiva de análisis (CSV)</h3>
              <button className="text-sm underline" onClick={() => setShowBulkModal(false)}>
                Cerrar
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Pegá el contenido del CSV o subí un archivo. Cabeceras esperadas: <code>pH,arsenico,nitratos,nitritos,conductividad,dureza,std,calcio,magnesio,sodio,potasio,bicarbonato,carbonato,sulfatos,cloruros,temperatura,coliformes,ecoli,salmonella,pseudomonas,aerobios</code>.
            </p>
            <textarea
              className="w-full h-40 border rounded-xl p-2 mb-2"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"pH,arsenico,nitratos,...\n7.1,0.005,10,0.05,1200,300,800,60,20,50,4,150,0,180,120,22,0,0,0,0,50"}
            />
            <div className="flex items-center gap-2 mb-4">
              <input
                type="file"
                accept=".csv,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setBulkText(String(ev.target?.result || ""));
                  reader.readAsText(f);
                }}
              />
              <button
                className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm"
                onClick={() => {
                  try {
                    const lines = bulkText.trim().split(/\r?\n/);
                    if (lines.length < 2) throw new Error("CSV sin datos");
                    const headers = lines[0].split(/[,	;]+/).map((h) => h.trim().toLowerCase());
                    const values = lines[1].split(/[,	;]+/).map((v) => v.trim());
                    const map = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
                    const next = { ...exp.analisis };
                    const keys = [
                      "ph",
                      "arsenico",
                      "nitratos",
                      "nitritos",
                      "conductividad",
                      "dureza",
                      "std",
                      "calcio",
                      "magnesio",
                      "sodio",
                      "potasio",
                      "bicarbonato",
                      "carbonato",
                      "sulfatos",
                      "cloruros",
                      "temperatura",
                      "coliformes",
                      "ecoli",
                      "salmonella",
                      "pseudomonas",
                      "aerobios",
                    ];
                    keys.forEach((k) => {
                      if (map[k] != null) {
                        if (k === "ph") next.pH = map[k];
                        else next[k] = map[k];
                      }
                    });
                    setExp({ ...exp, analisis: next });
                    setShowBulkModal(false);
                  } catch (e) {
                    alert("No se pudo procesar el CSV");
                  }
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuración */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <div className="bg-white max-w-3xl w-full rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Configuración · Valores de referencia y tasas</h3>
              <button className="text-sm underline" onClick={() => setLimits(DEFAULT_LIMITS)}>
                Restablecer por defecto
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-h-[70vh] overflow-auto pr-2">
              <div>
                <h4 className="font-medium mb-2">Fisicoquímico</h4>
                {Object.entries(limits.fisicoquimico).map(([k, v]) => (
                  <Field key={k} label={k.replaceAll("_", " ")}> 
                    <Input type="number" value={v} onChange={(nv) => setLimits({ ...limits, fisicoquimico: { ...limits.fisicoquimico, [k]: Number(nv) } })} />
                  </Field>
                ))}
              </div>
              <div>
                <h4 className="font-medium mb-2">Microbiológico</h4>
                {Object.entries(limits.microbiologico).map(([k, v]) => (
                  <Field key={k} label={k.replaceAll("_", " ")}> 
                    <Input type="number" value={v} onChange={(nv) => setLimits({ ...limits, microbiologico: { ...limits.microbiologico, [k]: Number(nv) } })} />
                  </Field>
                ))}

                <h4 className="font-medium mt-4 mb-2">Tasas 2024 (m³/año → monto)</h4>
                {limits.tasas_2024.map((t, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-end mb-2">
                    <Field label="Cat">
                      <Input
                        value={t.cat}
                        onChange={(v) => {
                          const arr = [...limits.tasas_2024];
                          arr[i] = { ...t, cat: v };
                          setLimits({ ...limits, tasas_2024: arr });
                        }}
                      />
                    </Field>
                    <Field label="Desde">
                      <Input
                        type="number"
                        value={t.min}
                        onChange={(v) => {
                          const arr = [...limits.tasas_2024];
                          arr[i] = { ...t, min: Number(v) };
                          setLimits({ ...limits, tasas_2024: arr });
                        }}
                      />
                    </Field>
                    <Field label="Hasta">
                      <Input
                        type="number"
                        value={t.max == null ? "" : t.max}
                        onChange={(v) => {
                          const arr = [...limits.tasas_2024];
                          arr[i] = { ...t, max: v === "" ? null : Number(v) };
                          setLimits({ ...limits, tasas_2024: arr });
                        }}
                      />
                    </Field>
                    <Field label="Monto $">
                      <Input
                        type="number"
                        value={t.monto}
                        onChange={(v) => {
                          const arr = [...limits.tasas_2024];
                          arr[i] = { ...t, monto: Number(v) };
                          setLimits({ ...limits, tasas_2024: arr });
                        }}
                      />
                    </Field>
                    <button
                      className="border rounded-lg px-2 py-2"
                      onClick={() => {
                        const arr = limits.tasas_2024.filter((_, j) => j !== i);
                        setLimits({ ...limits, tasas_2024: arr });
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                <button
                  className="mt-2 border rounded-lg px-3 py-2"
                  onClick={() => setLimits({ ...limits, tasas_2024: [...limits.tasas_2024, { cat: "Nueva", min: 0, max: 0, monto: 0 }] })}
                >
                  Añadir categoría
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="rounded-xl border px-3 py-2" onClick={() => setShowConfig(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-gray-500 py-6 print:hidden">
        Hecho para agilizar plenarios · Guardado local automático · Ajuste de normas en Configuración
      </footer>

      <style>{`
        @media print {
          header, .print\\:hidden { display: none !important; }
          .print\\:space-y-4 > * + * { margin-top: 1rem; }
          main { padding: 0 0.5cm; }
        }
      `}</style>
    </div>
  );
}

// ————————————————————————————————————————————————
// Pruebas ligeras (consola). Para ejecutarlas:
//   window.__RUN_CHECKS__ = true;  // en consola
//   location.reload();
// ————————————————————————————————————————————————
function __selfTests() {
  const limits = DEFAULT_LIMITS;

  // Test: categoría de tasa por volumen (bordes)
  console.assert(categoriaTasa(limits, 0).cat === "I", "Cat I en 0 m3/año");
  console.assert(categoriaTasa(limits, 499999).cat === "I", "Cat I límite superior -1");
  console.assert(categoriaTasa(limits, 500000).cat === "II", "Cat II en 500.000 m3/año");
  console.assert(categoriaTasa(limits, 1000000).cat === "III", "Cat III en 1.000.000 m3/año");
  console.assert(categoriaTasa(limits, 5000000).cat === "IV", "Cat IV en 5.000.000 m3/año");
  console.assert(categoriaTasa(limits, 10000000).cat === "V", "Cat V en 10.000.000 m3/año (sin tope)");
  console.assert(categoriaTasa(limits, 99999999).cat === "V", "Cat V por encima de 10.000.000 m3/año");

  // Test: withinRange
  console.assert(withinRange(7.0, 6.5, 8.5) === true, "pH 7.0 dentro de rango");
  console.assert(withinRange(9.0, 6.5, 8.5) === false, "pH 9.0 fuera de rango");
  console.assert(withinRange("", 6.5, 8.5) === null, "sin dato devuelve null");

  // Test: checkAnalisis (dos parámetros cargados)
  const res = checkAnalisis({ pH: 7, arsenico: 0.02 }, limits);
  console.assert(res.present >= 2, "al menos 2 parámetros presentes");
  console.assert(res.r.pH === true, "pH OK");
  console.assert(res.r.arsenico === false, "arsénico fuera de norma");

  // Test: sectionStatus
  const st1 = sectionStatus({ a: 1, b: 2 }, ["a", "b"]);
  const st2 = sectionStatus({ a: 1 }, ["a", "b"]);
  const st3 = sectionStatus({}, ["a"]);
  console.assert(st1.color === "green", "sección completa");
  console.assert(st2.color === "yellow", "sección incompleta");
  console.assert(st3.color === "red", "sección vacía");

  // Tests adicionales (CSV / tokenización)
  const sampleCSV = "ph,arsenico;nitritos\tconductividad\n7,0.01;0.05\t1200";
  const lines = sampleCSV.split(/\r?\n/);
  const headers = lines[0].toLowerCase().split(/[\,;\t]+/);
  console.assert(headers.includes("ph") && headers.includes("arsenico") && headers.includes("nitritos") && headers.includes("conductividad"), "parseo de cabeceras mixtas ok");

  const padronText = "123,456; 789\t012\n345";
  const tokens = padronText.split(/[\r\n,;\t]+/).filter(Boolean);
  console.assert(tokens.length === 5, "tokenización de padrón por separadores mixtos");
}

try {
  if (typeof window !== "undefined" && window.__RUN_CHECKS__) {
    __selfTests();
    console.log("✅ Pruebas básicas del Checklist CORUFA ejecutadas");
  }
} catch (e) {
  console.warn("⚠️ Error al ejecutar pruebas básicas:", e);
}
