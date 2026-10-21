/**
 * A CAIXA DE PRESENTE (07/10, do Presente69 do iPhone; 21/10 virou peça própria pra o BACK dos funis web usar
 * sem puxar o RevenueCat pro bundle da web). Mesmo desenho, mesma animação.
 */
import { motion } from "framer-motion";

/* A caixa: grafite com fita magenta, tampa que levanta e o cartão do preço
 * saindo de dentro. Tudo transform/opacity (nada de layout) e curto: 1,4 s.
 * Com "reduzir movimento" ligado, nasce aberta. */
export const CaixaDePresente = ({ aberta, reduzir, largura = 220 }: { aberta: boolean; reduzir: boolean; largura?: number }) => {
  const t = (delay: number, dur: number) => (reduzir ? { duration: 0 } : { delay, duration: dur, ease: [0.2, 0.9, 0.3, 1] as const });
  return (
    <motion.svg
      viewBox="0 0 220 200" width={largura} height={Math.round((largura * 200) / 220)} aria-hidden
      initial={reduzir ? false : { scale: 0.6, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18 }}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="p69-caixa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2433" />
          <stop offset="1" stopColor="#16121c" />
        </linearGradient>
        <linearGradient id="p69-fita" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2559a" />
          <stop offset="1" stopColor="#c21f6b" />
        </linearGradient>
        <linearGradient id="p69-tampa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3346" />
          <stop offset="1" stopColor="#221c2b" />
        </linearGradient>
      </defs>
      {/* sombra no chão */}
      <ellipse cx="110" cy="188" rx="78" ry="9" fill="#16121c" opacity="0.12" />
      {/* corpo */}
      <motion.g
        initial={false}
        animate={aberta && !reduzir ? { rotate: [0, -2.5, 2.5, -1.5, 0] } : { rotate: 0 }}
        transition={reduzir ? { duration: 0 } : { delay: 0.35, duration: 0.5, ease: "easeInOut" }}
        style={{ transformOrigin: "110px 180px" }}
      >
        <rect x="40" y="86" width="140" height="96" rx="14" fill="url(#p69-caixa)" />
        <rect x="98" y="86" width="24" height="96" fill="url(#p69-fita)" />
        <rect x="40" y="118" width="140" height="18" fill="url(#p69-fita)" opacity="0.92" />
        {/* luz fina na borda */}
        <rect x="40.5" y="86.5" width="139" height="95" rx="13.5" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
      </motion.g>
      {/* o cartão que sai de dentro (só a luz dele; o cartão real é HTML) */}
      <motion.rect
        x="62" y="60" width="96" height="40" rx="8" fill="#ffffff"
        initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={aberta ? { opacity: [0, 0.9, 0], y: -30 } : { opacity: 0, y: 40 }}
        transition={t(0.95, 0.45)}
      />
      {/* tampa + laço */}
      <motion.g
        initial={false}
        animate={aberta ? { y: -46, rotate: -12, x: 10 } : { y: 0, rotate: 0, x: 0 }}
        transition={t(0.8, 0.45)}
        style={{ transformOrigin: "180px 86px" }}
      >
        <rect x="30" y="66" width="160" height="28" rx="10" fill="url(#p69-tampa)" />
        <rect x="98" y="66" width="24" height="28" fill="url(#p69-fita)" />
        <rect x="30.5" y="66.5" width="159" height="27" rx="9.5" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
        {/* laço */}
        <path d="M110 66 C 96 50, 72 48, 74 60 C 76 70, 98 68, 110 66 Z" fill="url(#p69-fita)" />
        <path d="M110 66 C 124 50, 148 48, 146 60 C 144 70, 122 68, 110 66 Z" fill="url(#p69-fita)" />
        <circle cx="110" cy="65" r="6" fill="#f0a3c7" />
      </motion.g>
      {/* faíscas */}
      {[[52, 54], [172, 48], [92, 30], [140, 24], [30, 100], [192, 108]].map(([x, y], i) => (
        <motion.circle
          key={i} cx={x} cy={y} r={i % 2 ? 2.2 : 3} fill={i % 3 === 0 ? "#f0a3c7" : "#d2297a"}
          initial={{ opacity: 0, scale: 0 }}
          animate={aberta ? { opacity: [0, 1, 0], scale: [0, 1.2, 0.6] } : { opacity: 0, scale: 0 }}
          transition={reduzir ? { duration: 0 } : { delay: 0.9 + i * 0.06, duration: 0.7 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </motion.svg>
  );
};
