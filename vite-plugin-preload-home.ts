/**
 * PRÉ-CARGA DA HOME NO HTML (07/11, desempenho — lente "abertura").
 *
 * O pedaço da Home (pages/Home, 181 KB + ~30 pedaços que ela importa) é `lazy`: o navegador só descobre que precisa
 * dele DEPOIS que a entrada (1,86 MB) baixou, rodou, o React montou e a sessão foi lida — fila de downloads. Medido na
 * 1ª visita pela rede de celular (diagnostico-abertura.md): a entrada chega aos 4,5 s, a Home só é pedida aos 5,0 s e
 * chega aos 6,0 s. No app da loja (JS já no aparelho) é a mesma fila, só que em compilar: a Home só começa a compilar
 * depois de a entrada rodar.
 *
 * Aqui, no build, o HTML ganha um script inline minúsculo (ES5, como os outros blocos do index.html) que, SÓ quando já
 * existe sessão no aparelho (a chave do supabase-js no localStorage) e a rota é a raiz ou /home, manda o navegador
 * pré-carregar os pedaços da Home (JS: modulepreload = baixa e compila sem rodar; CSS: preload) em paralelo com a
 * entrada. Quem vai ver a HOME NOVA (o espelho `core-home-nova-origem-aparelho` desta conta diz "nova", ou a força de
 * QA) recebe também os pedaços dela. Visitante sem sessão (landing, funil, login): nada muda — nem um byte a mais.
 *
 * Os nomes dos pedaços têm hash e mudam a cada build: o plugin lê o bundle pronto (transformIndexHtml, order "post") e
 * escreve os nomes certos. Se a Home não estiver no bundle, o HTML sai como sempre. O helper de pré-carga do Vite
 * (__vitePreload) encontra o <link> já no documento e não cria outro.
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import type { OutputBundle, OutputChunk } from "rollup";

type Pedaco = { f: string; c?: 1 };

/** O `ref` do projeto Supabase, lido do client.ts no build (a chave da sessão é `sb-<ref>-auth-token`). */
const refDoSupabase = (raiz: string): string | null => {
  try {
    const s = fs.readFileSync(path.join(raiz, "src/integrations/supabase/client.ts"), "utf8");
    return s.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  } catch { return null; }
};

/** Fecho transitivo (imports estáticos + CSS) de um pedaço, sem o que o HTML já pré-carrega e sem o que já foi listado. */
const fecho = (bundle: OutputBundle, raiz: OutputChunk | undefined, noHtml: Set<string>, vistos: Set<string>): Pedaco[] => {
  const out: Pedaco[] = [];
  if (!raiz) return out;
  const fila: OutputChunk[] = [raiz];
  while (fila.length) {
    const c = fila.shift()!;
    if (vistos.has(c.fileName)) continue;
    vistos.add(c.fileName);
    if (!noHtml.has(c.fileName)) out.push({ f: c.fileName });
    for (const css of c.viteMetadata?.importedCss ?? []) {
      if (vistos.has(css) || noHtml.has(css)) continue;
      vistos.add(css);
      out.push({ f: css, c: 1 });
    }
    for (const i of c.imports) {
      const d = bundle[i];
      if (d && d.type === "chunk") fila.push(d);
    }
  }
  return out;
};

export function preloadDaHome(raiz: string): Plugin {
  return {
    name: "core-preload-da-home",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        const nome = ctx.path || ctx.filename || "";
        if (!bundle || !/(^|\/)index\.html$/.test(nome)) return html;
        const ref = refDoSupabase(raiz);
        if (!ref) return html;
        const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === "chunk");
        const porArquivo = (fim: string) => chunks.find((c) => !!c.facadeModuleId && c.facadeModuleId.replace(/\\/g, "/").endsWith(fim));
        // o que o HTML já manda baixar (a entrada e os modulepreload do próprio Vite)
        const noHtml = new Set<string>();
        for (const m of html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)) noHtml.add(m[1]);
        const vistos = new Set<string>();
        const home = fecho(bundle, porArquivo("/src/pages/Home.tsx"), noHtml, vistos);
        const homeE = fecho(bundle, porArquivo("/src/components/home-nova/e/HomeE.tsx"), noHtml, vistos);
        if (!home.length) return html;
        const script =
          `<script>` +
          `// 07/11 (desempenho): já tem sessão e vai cair na Home → os pedaços dela baixam junto com a entrada (vite-plugin-preload-home.ts)\n` +
          `(function(){try{var p=location.pathname;if(p!=="/"&&p!=="/home")return;var ls=window.localStorage;if(!ls||!ls.getItem("sb-${ref}-auth-token"))return;` +
          `var l=${JSON.stringify(home)};var e=ls.getItem("core-home-nova-origem-aparelho")||"";if(/:nova$/.test(e)||ls.getItem("forcar-home-nova")==="on")l=l.concat(${JSON.stringify(homeE)});` +
          `for(var i=0;i<l.length;i++){var k=document.createElement("link");if(l[i].c){k.rel="preload";k.as="style";}else{k.rel="modulepreload";}k.crossOrigin="";k.href="/"+l[i].f;document.head.appendChild(k);}}catch(x){}})();` +
          `</script>\n`;
        return html.replace("</head>", `${script}</head>`);
      },
    },
  };
}
