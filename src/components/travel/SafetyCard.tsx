import { usePersistedState } from "@/hooks/use-persisted-state";
import { SafetyInfo } from "./types";
import { Input } from "@/components/ui/input";
import { Shield, Phone, Heart, Droplets, Pill, AlertTriangle } from "lucide-react";

const FIELD_GROUPS = [
  {
    title: "CONTATOS DE EMERGÊNCIA",
    emoji: "🚨",
    color: "bg-red-200 dark:bg-red-800/50",
    body: "bg-red-50 dark:bg-red-950/20",
    fields: [
      { key: "insuranceNumber" as const, label: "Seguro Viagem", icon: Shield, placeholder: "Nº da apólice" },
      { key: "embassyPhone" as const, label: "Embaixada", icon: Phone, placeholder: "Telefone" },
      { key: "localEmergency" as const, label: "Emergência Local", icon: AlertTriangle, placeholder: "Polícia, SAMU..." },
      { key: "emergencyContact" as const, label: "Contato de Emergência", icon: Heart, placeholder: "Nome" },
      { key: "emergencyContactPhone" as const, label: "Tel. Contato", icon: Phone, placeholder: "Telefone" },
    ],
  },
  {
    title: "INFORMAÇÕES MÉDICAS",
    emoji: "🏥",
    color: "bg-blue-200 dark:bg-blue-800/50",
    body: "bg-blue-50 dark:bg-blue-950/20",
    fields: [
      { key: "bloodType" as const, label: "Tipo Sanguíneo", icon: Droplets, placeholder: "A+, O-, etc." },
      { key: "allergies" as const, label: "Alergias", icon: AlertTriangle, placeholder: "Penicilina, amendoim..." },
      { key: "medications" as const, label: "Medicamentos", icon: Pill, placeholder: "Uso contínuo" },
    ],
  },
];

export const SafetyCard = () => {
  const [info, setInfo] = usePersistedState<SafetyInfo>("travel-safety", {
    insuranceNumber: "", embassyPhone: "", localEmergency: "", allergies: "",
    bloodType: "", emergencyContact: "", emergencyContactPhone: "", medications: "",
  });

  const update = (key: keyof SafetyInfo, value: string) => setInfo(prev => ({ ...prev, [key]: value }));

  const allKeys: (keyof SafetyInfo)[] = ["insuranceNumber", "embassyPhone", "localEmergency", "emergencyContact", "emergencyContactPhone", "bloodType", "allergies", "medications"];
  const filledCount = allKeys.filter(k => info[k].trim()).length;

  return (
    <div className="space-y-4">
      {/* Header - Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-red-200 dark:bg-red-800/50 px-3 py-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">FICHA DE EMERGÊNCIA</span>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            Tenha tudo à mão em caso de emergência. <span className="font-bold text-foreground">{filledCount}/{allKeys.length}</span> preenchidos.
          </p>
        </div>
      </div>

      {/* Field groups - Notion-style */}
      {FIELD_GROUPS.map(group => (
        <div key={group.title} className="rounded-xl border border-border overflow-hidden">
          <div className={`${group.color} px-3 py-1.5`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">{group.emoji} {group.title}</span>
          </div>
          <div className={`${group.body} p-3 space-y-2`}>
            {group.fields.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-medium text-muted-foreground w-24 shrink-0">{f.label}</span>
                  <Input
                    value={info[f.key]}
                    onChange={e => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="h-7 rounded-lg text-xs border-none bg-background/50 focus-visible:bg-background flex-1"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
