import UIKit
import Capacitor
import FacebookCore
import AppTrackingTransparency
import AdSupport
import StoreKit

/*
 * SDK DA META NO iPHONE (06/09, refeito 07/09 SEM ATT) — espelho da v49 do
 * Android, que é o que vende hoje.
 *
 * DIVISÃO DE TRABALHO, igual à do Android: o SDK manda INSTALAÇÃO e ABERTURA
 * (é o que alimenta o SKAdNetwork e a medição agregada da Meta); a COMPRA sai
 * do SERVIDOR por CAPI, com e-mail/id em hash — fecha com o app em segundo
 * plano, e um evento do cliente ali seria perdido ou duplicado.
 *
 * ATT (19/09, build 15): a build 13 nasceu sem o pedido (decisão de 07/09,
 * depois de duas recusas 2.1 "unable to locate the ATT permission request" —
 * o framework estava embarcado SEM diálogo). Resultado medido no Gerenciador
 * de Eventos: 0% de rastreamento ligado, e a Meta distribuindo as compras
 * de iPhone entre campanhas por modelo estatístico. Agora o pedido existe de
 * verdade: o JS chama `MetaAds.pedirRastreamento()` depois da welcome, o
 * sistema mostra o diálogo com o texto do Info.plist, e o SDK só passa a
 * tratar o aparelho como rastreável se a pessoa aceitar. Quem nega segue
 * exatamente como antes (SKAdNetwork + agregado).
 *
 * Coerência que a Apple confere, os três juntos: NSUserTrackingUsageDescription
 * no Info.plist, FacebookAdvertiserIDCollectionEnabled=true, e
 * NSPrivacyTracking=true no manifesto. Um sem os outros = recusa.
 *
 * Token ausente = SDK DESLIGADO, de propósito. O repo é público, então o
 * client token nasce vazio no Info.plist e o `npm run loja:ios` injeta o real.
 */

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Token de verdade no bundle? Vazio = build de dev/simulador: não liga nada.
    static var metaConfigurada: Bool {
        let t = Bundle.main.object(forInfoDictionaryKey: "FacebookClientToken") as? String
        return !(t ?? "").trimmingCharacters(in: .whitespaces).isEmpty
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if AppDelegate.metaConfigurada {
            // O SDK só trata o aparelho como rastreável com o aceite do ATT —
            // lido do sistema a cada abertura, porque a pessoa pode mudar nos Ajustes.
            AppDelegate.aplicarStatusATT()
            ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
        }
        return true
    }

    /// Espelha a resposta do ATT no SDK da Meta. Chamado na abertura e logo
    /// depois do diálogo; sem aceite, o IDFA nunca sai deste aparelho.
    static func aplicarStatusATT() {
        let aceitou: Bool
        if #available(iOS 14, *) {
            aceitou = ATTrackingManager.trackingAuthorizationStatus == .authorized
        } else {
            aceitou = ASIdentifierManager.shared().isAdvertisingTrackingEnabled
        }
        Settings.shared.isAdvertiserTrackingEnabled = aceitou
        Settings.shared.isAdvertiserIDCollectionEnabled = aceitou
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // ABERTURA. É este evento que alimenta o "app open" da Meta; sem ele a
        // campanha só enxerga a instalação e perde retenção.
        if AppDelegate.metaConfigurada {
            AppEvents.shared.activateApp()
        }
        AppDelegate.pedirATTSePrecisar()
    }

    /* PEDIDO NATIVO NA PRIMEIRA ABERTURA (20/09, recusa 2.1 na build 16: o
     * revisor entrou pela tela de login com a conta demo e o pedido, que só
     * saía do JS pela welcome/Home, não apareceu). Aqui não depende de rota:
     * na primeira vez que o app fica ativo com status "não decidido", pede.
     * Chamado no instante em que o app ativa, o iOS 15+ devolve "notDetermined"
     * sem mostrar nada — por isso sempre com atraso. Se
     * mesmo assim não mostrar (app foi pro fundo no meio), fica armado pra
     * próxima ativação; o JS (welcome/Home) continua como segunda chance. */
    static var attEmAndamento = false
    /// 10/10 (build 38): quem veio da Porta não vê o ATT. Ligado pelo link core://entrar (open url)
    /// ou pelo JS (CoreNativo.pularATT, conta com user_metadata.porta). Vale pro processo.
    static var pularATT = false
    static func pedirATTSePrecisar() {
        #if targetEnvironment(simulator)
        return // no simulador o diálogo de ATT só atrapalha os prints
        #endif
        guard #available(iOS 14, *), !attEmAndamento else { return }
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { return }
        attEmAndamento = true
        /* 20/09 (dono, olhando o FitFolio): quem pede de verdade é a welcome
         * (JS), 3 s depois de estar na tela — a pessoa vê o app e a animação
         * primeiro. Este timer é só a RESERVA (10 s) pra um caminho que nunca
         * passe pela welcome; se o JS já pediu, encontra o status decidido e
         * não faz nada. */
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
            guard !AppDelegate.pularATT else { AppDelegate.attEmAndamento = false; return }
            guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { AppDelegate.attEmAndamento = false; return }
            ATTrackingManager.requestTrackingAuthorization { status in
                AppDelegate.aplicarStatusATT()
                AppDelegate.attEmAndamento = false
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // DE PROPÓSITO não passa pelo ApplicationDelegate da Meta: não usamos
        // Login do Facebook, e este caminho é o do `core://auth` (Sign in with
        // Apple / Supabase). Enfiar outro handler aqui é arriscar o deep link
        // que já custou um bug no Android em 28/07.
        // 10/10 (build 38): o "Abrir o CORE" da Porta (core://entrar?h=…) — a conta veio do site,
        // sem o diálogo de ATT. Marcado aqui, antes de o JS existir, pra a reserva de 10 s respeitar.
        if url.scheme == "core", url.host == "entrar" { AppDelegate.pularATT = true }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

/*
 * REGISTRO DO PLUGIN (07/09). No Android o MainActivity chama
 * registerPlugin(MetaAdsPlugin.class). No iOS o Capacitor só registra sozinho
 * o que está em `packageClassList` do capacitor.config.json — que o `cap sync`
 * regenera a partir dos plugins do node_modules. Plugin escrito DENTRO do app
 * não entra lá: precisa ser registrado à mão na subclasse do
 * CAPBridgeViewController, e o Main.storyboard tem que apontar pra ela.
 * Sem isto, `registerPlugin("MetaAds")` no JS vira "not implemented on ios",
 * o catch engole, e o anonId nunca chega ao servidor — foi por isso que as
 * builds 10-12 não emitiram um único evento do plugin.
 */
class CoreViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MetaAdsPlugin())
        bridge?.registerPluginInstance(CoreNativoPlugin())
    }
}

/*
 * A FOLHA "PROBLEMA DE COBRANÇA" DO STOREKIT (10/10, versão 1.0.14).
 *
 * O dinheiro parado: 59% das cobranças do iPhone falham no cartão e ~5%
 * recuperam. No iOS 16.4+ o StoreKit entrega uma `Message` de `.billingIssue`
 * — a folha do PRÓPRIO sistema que leva direto à troca do cartão. Sem ninguém
 * observar `Message.messages`, o iOS mostra ela sozinho na primeira vez que o
 * app vem pra frente — em qualquer tela, inclusive no meio do funil ou de um
 * passo da missão, por cima do que a pessoa estava fazendo.
 *
 * CUIDADO que não é detalhe: OBSERVAR a fila SUPRIME a exibição automática. Se
 * a gente ouvir e nunca chamar `display(in:)`, a folha nunca aparece — e a
 * pessoa perde o acesso sem aviso do sistema. Por isso:
 *   1. a observação só começa quando o JS pede (`ativarFolhaDeCobranca`, atrás
 *      da chave COBRANCA_V14 do app). Com a chave desligada este código não
 *      toca na fila e o iOS segue como sempre;
 *   2. billingIssue vai pra uma FILA e é exibida quando o JS diz que a rota é
 *      a Home (`telaAtual`). Se a Home não vier em 60 s, exibe mesmo assim;
 *   3. qualquer outra razão (aumento de preço, win-back…) é exibida na hora,
 *      como o sistema faria;
 *   4. sem cena ativa pra exibir, volta pra fila e tenta de novo.
 * Cada exibição avisa o JS (`billingSheetExibida` → evento billing_sheet_exibida).
 *
 * Não dá pra ensaiar no simulador sem conta sandbox com cartão recusado — ver
 * o teste manual no relatório da versão. Em iOS < 16.4 nada disto existe.
 */
@available(iOS 16.4, *)
@MainActor
final class FolhaDeCobranca {
    static let compartilhada = FolhaDeCobranca()

    private var observacao: Task<Void, Never>?
    private var fila: [(mensagem: Message, desde: Date)] = []
    private var naHome = false
    private var reserva: Timer?
    /// 1.0.17 (dono, 20/10: a folha do StoreKit apareceu pra 26 pessoas e recuperou 0; a tela cheia do app recupera):
    /// UMA superfície de cobrança por abertura, e a do app ganha. Enquanto o app segura (a tela cheia dele está na
    /// tela ou vai aparecer), billingIssue fica na fila e NUNCA é exibida — e a fila continua observada, então o
    /// iOS também não mostra sozinho. `respostaDoApp` guarda o que o JS disse antes de `ativar` (a ordem não importa).
    private var seguraPeloApp = false
    private var respostaDoApp: Bool?
    /// Avisa o plugin de cada exibição (motivo, espera em ms, forçada pela reserva?).
    var aoExibir: ((String, Int, Bool) -> Void)?

    static let ESPERA_MAXIMA: TimeInterval = 60

    var ativa: Bool { observacao != nil }

    func ativar(aguardarApp: Bool = false) {
        seguraPeloApp = respostaDoApp ?? aguardarApp
        guard observacao == nil else { return }
        observacao = Task { @MainActor [weak self] in
            for await mensagem in Message.messages {
                self?.receber(mensagem)
            }
        }
    }

    /// O JS (lib/cobranca-nativa `segurarFolhaNativa`): true = a tela cheia do app cuida do cartão recusado.
    func segurar(_ s: Bool) {
        respostaDoApp = s
        seguraPeloApp = s
        if s { reserva?.invalidate(); reserva = nil }
        else if naHome { exibirPendentes(forcado: false) }
        else if !fila.isEmpty { armarReserva() }
    }

    func telaAtual(rota: String) {
        naHome = rota == "/home" || rota == "/"
        if naHome { exibirPendentes(forcado: false) }
    }

    private func receber(_ m: Message) {
        if m.reason == .billingIssue {
            fila.append((m, Date()))
            if seguraPeloApp { return } // a tela cheia do app manda (fica na fila, sem reserva)
            if naHome { exibirPendentes(forcado: false) } else { armarReserva() }
        } else {
            exibir(m, desde: Date(), forcado: false)
        }
    }

    private func armarReserva() {
        guard reserva == nil else { return }
        reserva = Timer.scheduledTimer(withTimeInterval: FolhaDeCobranca.ESPERA_MAXIMA, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.exibirPendentes(forcado: true) }
        }
    }

    private func exibirPendentes(forcado: Bool) {
        reserva?.invalidate(); reserva = nil
        guard !seguraPeloApp else { return }
        guard !fila.isEmpty else { return }
        let pendentes = fila
        fila.removeAll()
        for item in pendentes { exibir(item.mensagem, desde: item.desde, forcado: forcado) }
    }

    private func cenaAtiva() -> UIWindowScene? {
        let cenas = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return cenas.first { $0.activationState == .foregroundActive } ?? cenas.first
    }

    private func exibir(_ m: Message, desde: Date, forcado: Bool) {
        guard let cena = cenaAtiva() else {
            // app no fundo: volta pra fila e tenta na próxima tela/reserva
            fila.append((m, desde)); armarReserva(); return
        }
        do {
            try m.display(in: cena)
            let esperou = Int(Date().timeIntervalSince(desde) * 1000)
            aoExibir?(m.reason == .billingIssue ? "billingIssue" : "outro", esperou, forcado)
            print("[Cobranca] folha do StoreKit exibida (\(m.reason == .billingIssue ? "billingIssue" : "outro"), esperou \(esperou) ms, forçada: \(forcado))")
        } catch {
            print("[Cobranca] display(in:) falhou: \(error)")
        }
    }
}

/*
 * Plugin `CoreNativo` — o que o JS (src/lib/cobranca-nativa.ts) chama:
 *   telaAtual({ rota })        a rota do React a cada navegação;
 *   ativarFolhaDeCobranca()    começa a observar a fila (só com a chave ligada);
 *   evento billingSheetExibida { motivo, esperou_ms, forcada };
 *   pularATT()                 (10/10, build 38) conta da Porta: segura a reserva de ATT de 10 s.
 * Registrado à mão no CoreViewController, como o MetaAds (plugin de dentro do
 * app não entra no packageClassList).
 */
@objc(CoreNativoPlugin)
public class CoreNativoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreNativoPlugin"
    public let jsName = "CoreNativo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "telaAtual", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ativarFolhaDeCobranca", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "segurarFolhaDeCobranca", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pularATT", returnType: CAPPluginReturnPromise)
    ]

    @objc func pularATT(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            AppDelegate.pularATT = true
            call.resolve()
        }
    }

    @objc func telaAtual(_ call: CAPPluginCall) {
        let rota = call.getString("rota") ?? ""
        if #available(iOS 16.4, *) {
            Task { @MainActor in FolhaDeCobranca.compartilhada.telaAtual(rota: rota) }
        }
        call.resolve()
    }

    /// 1.0.17: { segurar: true } = a tela cheia do app cuida do cartão recusado; a folha do StoreKit não aparece.
    @objc func segurarFolhaDeCobranca(_ call: CAPPluginCall) {
        let segurar = call.getBool("segurar") ?? false
        guard #available(iOS 16.4, *) else { call.resolve(); return }
        Task { @MainActor in
            FolhaDeCobranca.compartilhada.segurar(segurar)
            call.resolve()
        }
    }

    @objc func ativarFolhaDeCobranca(_ call: CAPPluginCall) {
        guard #available(iOS 16.4, *) else { call.resolve(["ativo": false, "suportado": false]); return }
        let aguardarApp = call.getBool("aguardarApp") ?? false
        Task { @MainActor [weak self] in
            let folha = FolhaDeCobranca.compartilhada
            folha.aoExibir = { [weak self] motivo, esperou, forcada in
                self?.notifyListeners("billingSheetExibida", data: ["motivo": motivo, "esperou_ms": esperou, "forcada": forcada])
            }
            folha.ativar(aguardarApp: aguardarApp)
            call.resolve(["ativo": folha.ativa, "suportado": true])
        }
    }
}

/*
 * Ponte pro JS — MESMO nome e MESMO formato de resposta do plugin Android
 * (br/com/coreaplicativo/app/MetaAdsPlugin.java), porque `src/lib/analytics.ts`
 * já chama `MetaAds.idPublicidade()` e espera `{ gaid, anonId }`.
 * "gaid" leva o IDFA quando a pessoa aceitou o ATT (build 15); sem aceite vai
 * vazio, e o que vale é o anonId — o id que a PRÓPRIA Meta deu a este aparelho, o mesmo que o SDK
 * usou pra registrar a instalação. O servidor manda ele no Purchase e a Meta
 * casa a compra com a instalação sem precisar de identificador de anúncio.
 */
@objc(MetaAdsPlugin)
public class MetaAdsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MetaAdsPlugin"
    public let jsName = "MetaAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "idPublicidade", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logCompra", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pedirRastreamento", returnType: CAPPluginReturnPromise)
    ]

    /* PEDIDO DE ATT (19/09). Mostra o diálogo do sistema (uma vez por
     * instalação; depois o sistema devolve a resposta guardada sem mostrar
     * nada) e espelha o resultado no SDK. Sempre na thread principal — a
     * Apple exige e, fora dela, o diálogo simplesmente não aparece. */
    @objc func pedirRastreamento(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        call.resolve(["status": "denied"]); return // simulador: sem diálogo
        #endif
        guard #available(iOS 14, *) else { call.resolve(["status": "restricted"]); return }
        DispatchQueue.main.async {
            ATTrackingManager.requestTrackingAuthorization { status in
                AppDelegate.aplicarStatusATT()
                let nome: String
                switch status {
                case .authorized: nome = "authorized"
                case .denied: nome = "denied"
                case .restricted: nome = "restricted"
                case .notDetermined: nome = "notDetermined"
                @unknown default: nome = "unknown"
                }
                call.resolve(["status": nome])
            }
        }
    }

    /* COMPRA PELO SDK (18/09). Até a build 13 a Meta só sabia da compra pelo
     * CAPI do servidor e casava 5 em 18 (anon_id/e-mail) — o resto ela
     * MODELAVA (R$ 113,76 por compra, sempre). Com o evento saindo do próprio
     * SDK ela casa 100% com a instalação que ela mesma registrou e passa a
     * otimizar pra quem paga. Dedup com o CAPI: o servidor manda o mesmo
     * order_id em event_id; aqui vai em fb_order_id. */
    @objc func logCompra(_ call: CAPPluginCall) {
        guard AppDelegate.metaConfigurada else { call.resolve(["ok": false]); return }
        let valor = call.getDouble("valor") ?? 0
        let moeda = call.getString("moeda") ?? "BRL"
        var params: [AppEvents.ParameterName: Any] = [:]
        if let produto = call.getString("produto") { params[.contentID] = produto; params[.contentType] = "product" }
        if let pedido = call.getString("pedido") { params[AppEvents.ParameterName("fb_order_id")] = pedido }
        AppEvents.shared.logPurchase(amount: valor, currency: moeda, parameters: params)
        call.resolve(["ok": true])
    }

    @objc func idPublicidade(_ call: CAPPluginCall) {
        var anonId = ""
        if AppDelegate.metaConfigurada { anonId = AppEvents.shared.anonymousID }
        // IDFA só com o aceite do ATT; sem ele o sistema devolve zeros e aqui
        // vai vazio, como sempre foi. Com ele, o servidor manda como `madid`.
        var idfa = ""
        if #available(iOS 14, *), ATTrackingManager.trackingAuthorizationStatus == .authorized {
            let id = ASIdentifierManager.shared().advertisingIdentifier.uuidString
            if id != "00000000-0000-0000-0000-000000000000" { idfa = id }
        }
        call.resolve(["gaid": idfa, "anonId": anonId])
    }
}
