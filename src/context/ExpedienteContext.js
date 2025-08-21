import React, { createContext, useContext, useEffect, useState } from "react";

// ----- Modelos simples -----
export const DEFAULT_LIMITS = {
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

export const EMPTY_EXPEDIENTE = {
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

const ExpedienteContext = createContext();

export function ExpedienteProvider({ children }) {
  const [limits, setLimits] = useState(() => {
    const saved = localStorage.getItem("corufa_limits_v1");
    return saved ? JSON.parse(saved) : DEFAULT_LIMITS;
    });
  const [exp, setExp] = useState(() => {
    const saved = localStorage.getItem("corufa_exp_v1");
    return saved ? JSON.parse(saved) : EMPTY_EXPEDIENTE;
  });

  useEffect(() => {
    localStorage.setItem("corufa_limits_v1", JSON.stringify(limits));
  }, [limits]);

  useEffect(() => {
    localStorage.setItem("corufa_exp_v1", JSON.stringify(exp));
  }, [exp]);

  const value = { exp, setExp, limits, setLimits };
  return <ExpedienteContext.Provider value={value}>{children}</ExpedienteContext.Provider>;
}

export function useExpediente() {
  const ctx = useContext(ExpedienteContext);
  if (!ctx) {
    throw new Error("useExpediente debe usarse dentro de ExpedienteProvider");
  }
  return ctx;
}

