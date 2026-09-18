import UIKit
import Capacitor
import FacebookCore

/*
 * SDK DA META NO iPHONE (06/09, refeito 07/09 SEM ATT) — espelho da v49 do
 * Android, que é o que vende hoje.
 *
 * DIVISÃO DE TRABALHO, igual à do Android: o SDK manda INSTALAÇÃO e ABERTURA
 * (é o que alimenta o SKAdNetwork e a medição agregada da Meta); a COMPRA sai
 * do SERVIDOR por CAPI, com e-mail/id em hash — fecha com o app em segundo
 * plano, e um evento do cliente ali seria perdido ou duplicado.
 *
 * POR QUE NÃO HÁ ATT AQUI (decisão do dono, 07/09, depois de duas recusas
 * 2.1 "unable to locate the ATT permission request"): a atribuição da Apple
 * pra anúncio (SKAdNetwork) NÃO depende de consentimento nem de IDFA. Sem o
 * pedido, a Meta perde a atribuição POR APARELHO e fica com o agregado por
 * campanha — que é o que ela teria pros 60-75% que negam de qualquer jeito.
 * Em troca: nenhum diálogo na primeira tela, nenhum framework de rastreio
 * pra Apple cobrar, manifesto com NSPrivacyTracking=false. É o desenho do
 * Cal AI e da maioria dos apps de consumo. Se um dia a campanha do iPhone
 * escalar e o agregado ficar curto, o ATT entra numa atualização — como
 * decisão, não como pré-requisito.
 *
 * Coerência que a Apple confere: FacebookAdvertiserIDCollectionEnabled=false
 * no Info.plist, sem NSUserTrackingUsageDescription, sem import de
 * AppTrackingTransparency, isAdvertiserTrackingEnabled=false. Um desses
 * ligado sem o pedido = a recusa de volta.
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
            // Sem ATT o SDK NUNCA pode achar que tem permissão de rastreio.
            Settings.shared.isAdvertiserTrackingEnabled = false
            Settings.shared.isAdvertiserIDCollectionEnabled = false
            ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
        }
        return true
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
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // DE PROPÓSITO não passa pelo ApplicationDelegate da Meta: não usamos
        // Login do Facebook, e este caminho é o do `core://auth` (Sign in with
        // Apple / Supabase). Enfiar outro handler aqui é arriscar o deep link
        // que já custou um bug no Android em 28/07.
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
    }
}

/*
 * Ponte pro JS — MESMO nome e MESMO formato de resposta do plugin Android
 * (br/com/coreaplicativo/app/MetaAdsPlugin.java), porque `src/lib/analytics.ts`
 * já chama `MetaAds.idPublicidade()` e espera `{ gaid, anonId }`.
 * "gaid" vem VAZIO de propósito: sem ATT não existe IDFA. O que vale aqui é o
 * anonId — o id que a PRÓPRIA Meta deu a este aparelho, o mesmo que o SDK
 * usou pra registrar a instalação. O servidor manda ele no Purchase e a Meta
 * casa a compra com a instalação sem precisar de identificador de anúncio.
 */
@objc(MetaAdsPlugin)
public class MetaAdsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MetaAdsPlugin"
    public let jsName = "MetaAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "idPublicidade", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logCompra", returnType: CAPPluginReturnPromise)
    ]

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
        call.resolve(["gaid": "", "anonId": anonId])
    }
}
