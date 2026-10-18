export type MapaDoTempo = {
  nascimento: Date;
  hoje: Date;
  idade: number;
  anoDeVida: number;
  marco: number;
  dataMarco: Date;
  dias: number;
  semanas: number;
  sabados: number;
};

const inicioDoDia = (data: Date) => new Date(data.getFullYear(), data.getMonth(), data.getDate());
const diasEntre = (inicio: Date, fim: Date) =>
  Math.round((
    Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate())
    - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  ) / 86_400_000);

export function idadeEm(dataNascimento: Date, hoje: Date): number {
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const aniversarioPassou =
    hoje.getMonth() > dataNascimento.getMonth()
    || (hoje.getMonth() === dataNascimento.getMonth() && hoje.getDate() >= dataNascimento.getDate());
  if (!aniversarioPassou) idade -= 1;
  return idade;
}

export function contarSabados(inicio: Date, fimExclusivo: Date): number {
  const atual = inicioDoDia(inicio);
  const fim = inicioDoDia(fimExclusivo);
  const atePrimeiroSabado = (6 - atual.getDay() + 7) % 7;
  atual.setDate(atual.getDate() + atePrimeiroSabado);
  if (atual >= fim) return 0;
  return Math.ceil(diasEntre(atual, fim) / 7);
}

export function calcularMapa(dataNascimento: Date, agora = new Date()): MapaDoTempo {
  const nascimento = inicioDoDia(dataNascimento);
  const hoje = inicioDoDia(agora);
  if (!Number.isFinite(nascimento.getTime()) || nascimento > hoje) throw new Error("data_invalida");

  const idade = idadeEm(nascimento, hoje);
  if (idade < 18 || idade > 89) throw new Error("idade_fora");

  const marco = (Math.floor(idade / 10) + 1) * 10;
  const anoMarco = nascimento.getFullYear() + marco;
  const ultimoDiaDoMes = new Date(anoMarco, nascimento.getMonth() + 1, 0).getDate();
  const dataMarco = new Date(anoMarco, nascimento.getMonth(), Math.min(nascimento.getDate(), ultimoDiaDoMes));
  const dias = Math.max(0, diasEntre(hoje, dataMarco));

  return {
    nascimento,
    hoje,
    idade,
    anoDeVida: idade + 1,
    marco,
    dataMarco,
    dias,
    semanas: Math.floor(dias / 7),
    sabados: contarSabados(hoje, dataMarco),
  };
}

export function dataDeInput(valor: string): Date | null {
  const partes = valor.trim().split("-");
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return data;
}

export const faixaEtaria = (idade: number): string => {
  const inicio = Math.floor(idade / 5) * 5;
  return `${inicio}-${inicio + 4}`;
};

