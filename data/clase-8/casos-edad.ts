type CasoEdad = {
  readonly id: string;
  readonly edad: number;
  readonly motivo: string;
  readonly aceptada: boolean;
};

export const casosEdad: readonly CasoEdad[] = [
  { id: 'C-EDAD-17', edad: 17, motivo: 'inferior al mínimo', aceptada: false },
  { id: 'C-EDAD-18', edad: 18, motivo: 'mínimo válido', aceptada: true },
  { id: 'C-EDAD-120', edad: 120, motivo: 'máximo válido', aceptada: true },
  { id: 'C-EDAD-121', edad: 121, motivo: 'superior al máximo', aceptada: false },
];
