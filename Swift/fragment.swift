// УСТАНОВКА ЗАВИСИМОСТЕЙ (Package.swift):
// dependencies: [
//     .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
//     .package(url: "https://github.com/jedisct1/swift-sodium.git", from: "0.9.1")
// ]

import Foundation
import Alamofire
import Sodium
import CommonCrypto

// КОНФИГУРАЦИЯ
struct Config {
    static let MNEMONIC: [String] = [
        "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
        "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
        "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
    ]
    
    static let DATA: [String: String] = [
        "stel_ssid": "ваш_ssid",
        "stel_dt": "-240",
        "stel_ton_token": "ваш_ton_token",
        "stel_token": "ваш_token"
    ]
    
    static let FRAGMENT_HASH = "ed3ec875a724358cea"
    static let FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03"
    static let FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq"
    static let FRAGMENT_ADDRESS = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118"
    static let TON_API_ENDPOINT = "https://toncenter.com/api/v2/sendBoc"
}

// СТРУКТУРЫ ДАННЫХ
struct RecipientResponse: Codable {
    struct Found: Codable {
        let recipient: String
    }
    let found: Found?
}

struct ReqIdResponse: Codable {
    let req_id: String?
}

struct BuyLinkResponse: Codable {
    struct Transaction: Codable {
        struct Message: Codable {
            let address: String
            let amount: String
            let payload: String
        }
        let messages: [Message]
    }
    let ok: Bool?
    let transaction: Transaction?
}

struct BuyStarsResult {
    let success: Bool
    let txHash: String?
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
class Helpers {
    static func getCookies(_ data: [String: String]) -> [String: String] {
        return [
            "stel_ssid": data["stel_ssid"] ?? "",
            "stel_dt": data["stel_dt"] ?? "",
            "stel_ton_token": data["stel_ton_token"] ?? "",
            "stel_token": data["stel_token"] ?? ""
        ]
    }
    
    static func fixBase64Padding(_ b64String: String) -> String {
        var result = b64String
        let missingPadding = result.count % 4
        if missingPadding > 0 {
            result += String(repeating: "=", count: 4 - missingPadding)
        }
        return result
    }
    
    static func cookiesToString(_ cookies: [String: String]) -> String {
        return cookies.map { "\($0.key)=\($0.value)" }.joined(separator: "; ")
    }
    
    static func sha256(_ data: Data) -> Data {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return Data(hash)
    }
    
    static func pbkdf2SHA512(password: String, salt: String, iterations: Int, keyLength: Int) -> Data? {
        guard let passwordData = password.data(using: .utf8),
              let saltData = salt.data(using: .utf8) else {
            return nil
        }
        
        var derivedKey = Data(repeating: 0, count: keyLength)
        let result = derivedKey.withUnsafeMutableBytes { derivedKeyBytes in
            saltData.withUnsafeBytes { saltBytes in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    password,
                    passwordData.count,
                    saltBytes.bindMemory(to: UInt8.self).baseAddress,
                    saltData.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA512),
                    UInt32(iterations),
                    derivedKeyBytes.bindMemory(to: UInt8.self).baseAddress,
                    keyLength
                )
            }
        }
        
        return result == kCCSuccess ? derivedKey : nil
    }
}

// TON CRYPTO
class TonCrypto {
    static func mnemonicToKeys(_ mnemonic: [String]) -> (publicKey: Data, privateKey: Data)? {
        let sodium = Sodium()
        let mnemonicStr = mnemonic.joined(separator: " ")
        let salt = "TON default seed"
        
        guard let seed = Helpers.pbkdf2SHA512(
            password: mnemonicStr,
            salt: salt,
            iterations: 100000,
            keyLength: 64
        ) else {
            return nil
        }
        
        let seedBytes = [UInt8](seed.prefix(32))
        guard let keyPair = sodium.sign.keyPair(seed: Bytes(seedBytes)) else {
            return nil
        }
        
        return (
            publicKey: Data(keyPair.publicKey),
            privateKey: Data(keyPair.secretKey)
        )
    }
    
    static func sign(message: Data, privateKey: Data) -> Data? {
        let sodium = Sodium()
        let messageBytes = [UInt8](message)
        let privateKeyBytes = [UInt8](privateKey)
        
        guard let signature = sodium.sign.signature(message: messageBytes, secretKey: privateKeyBytes) else {
            return nil
        }
        
        return Data(signature)
    }
}

// TON CELL
class TonCell {
    private var data: [UInt8] = []
    private var refs: [TonCell] = []
    
    init() {}
    
    init(data: [UInt8]) {
        self.data = data
    }
    
    func writeUint(_ value: UInt64, bits: Int) {
        let bytes = (bits + 7) / 8
        var valueBytes: [UInt8] = []
        
        for i in (0..<bytes).reversed() {
            valueBytes.append(UInt8((value >> (8 * i)) & 0xFF))
        }
        
        data.append(contentsOf: valueBytes)
    }
    
    func writeBytes(_ bytes: Data) {
        data.append(contentsOf: [UInt8](bytes))
    }
    
    func writeAddress(_ address: String) throws {
        let parts = address.split(separator: ":")
        guard parts.count == 2,
              let workchain = Int8(parts[0]),
              let hashHex = parts[1].data(using: .utf8) else {
            throw NSError(domain: "TonCell", code: 1, userInfo: [NSLocalizedDescriptionKey: "Неверный формат адреса"])
        }
        
        let hash = Data(hex: String(parts[1]))
        
        data.append(0x01) // addr_std
        data.append(UInt8(bitPattern: workchain))
        writeBytes(hash)
    }
    
    func addRef(_ cell: TonCell) {
        refs.append(cell)
    }
    
    func serialize() -> [UInt8] {
        var result: [UInt8] = []
        
        result.append(UInt8(refs.count))
        result.append(UInt8(data.count))
        result.append(contentsOf: data)
        
        for ref in refs {
            result.append(contentsOf: ref.serialize())
        }
        
        return result
    }
    
    func hash() -> Data {
        let serialized = serialize()
        return Helpers.sha256(Data(serialized))
    }
    
    func toBoc() -> String {
        let serialized = serialize()
        return Data(serialized).base64EncodedString()
    }
    
    static func fromBoc(_ boc: String) -> TonCell? {
        let fixed = Helpers.fixBase64Padding(boc)
        guard let data = Data(base64Encoded: fixed) else {
            return nil
        }
        return TonCell(data: [UInt8](data))
    }
}

// TON WALLET
class TonWallet {
    private let publicKey: Data
    private let privateKey: Data
    private let workchain: Int8
    private let walletId: UInt32
    
    init(mnemonic: [String], workchain: Int8 = 0) throws {
        guard let keys = TonCrypto.mnemonicToKeys(mnemonic) else {
            throw NSError(domain: "TonWallet", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ошибка создания ключей"])
        }
        
        self.publicKey = keys.publicKey
        self.privateKey = keys.privateKey
        self.workchain = workchain
        self.walletId = 698983191 // Wallet V4R2
    }
    
    func getAddress() -> String {
        let hash = Helpers.sha256(publicKey)
        return "\(workchain):\(hash.hexEncodedString())"
    }
    
    func createTransferMessage(destAddress: String, amount: UInt64, payload: TonCell, seqno: UInt32) throws -> TonCell {
        let msgBody = TonCell()
        msgBody.writeUint(0, bits: 1) // int_msg_info
        msgBody.writeUint(1, bits: 1) // ihr_disabled
        msgBody.writeUint(1, bits: 1) // bounce
        msgBody.writeUint(0, bits: 1) // bounced
        msgBody.writeUint(0, bits: 2) // src addr_none
        
        try msgBody.writeAddress(destAddress)
        msgBody.writeUint(amount, bits: 128)
        msgBody.writeUint(0, bits: 1) // extra currencies
        msgBody.writeUint(0, bits: 4) // ihr_fee
        msgBody.writeUint(0, bits: 4) // fwd_fee
        msgBody.writeUint(0, bits: 64) // created_lt
        msgBody.writeUint(0, bits: 32) // created_at
        msgBody.writeUint(0, bits: 1) // init
        msgBody.writeUint(1, bits: 1) // body present
        
        let extMsg = TonCell()
        extMsg.writeUint(UInt64(seqno), bits: 32)
        extMsg.writeUint(UInt64(Date().timeIntervalSince1970 + 60), bits: 32) // valid_until
        extMsg.writeUint(UInt64(walletId), bits: 32)
        extMsg.writeUint(3, bits: 8) // mode
        
        return extMsg
    }
    
    func signAndSend(_ message: TonCell) -> String? {
        let msgData = Data(message.serialize())
        
        guard let signature = TonCrypto.sign(message: msgData, privateKey: privateKey) else {
            return nil
        }
        
        let signedMsg = TonCell()
        signedMsg.writeBytes(signature)
        signedMsg.writeBytes(msgData)
        
        return signedMsg.toBoc()
    }
}

// FRAGMENT CLIENT
class FragmentClient {
    private let url: String
    private let cookies: [String: String]
    
    init(fragmentHash: String, cookiesData: [String: String]) {
        self.url = "https://fragment.com/api?hash=\(fragmentHash)"
        self.cookies = Helpers.getCookies(cookiesData)
    }
    
    func fetchRecipient(query: String) async throws -> String? {
        let parameters: [String: String] = [
            "query": query,
            "method": "searchStarsRecipient"
        ]
        
        let headers: HTTPHeaders = [
            "Cookie": Helpers.cookiesToString(cookies),
            "Content-Type": "application/x-www-form-urlencoded"
        ]
        
        let response = await AF.request(url, method: .post, parameters: parameters, headers: headers)
            .serializingDecodable(RecipientResponse.self)
            .response
        
        guard let result = response.value else {
            throw response.error ?? NSError(domain: "FragmentClient", code: 1)
        }
        
        print("Recipient search:", result)
        return result.found?.recipient
    }
    
    func fetchReqId(recipient: String, quantity: Int) async throws -> String? {
        let parameters: [String: String] = [
            "recipient": recipient,
            "quantity": String(quantity),
            "method": "initBuyStarsRequest"
        ]
        
        let headers: HTTPHeaders = [
            "Cookie": Helpers.cookiesToString(cookies),
            "Content-Type": "application/x-www-form-urlencoded"
        ]
        
        let response = await AF.request(url, method: .post, parameters: parameters, headers: headers)
            .serializingDecodable(ReqIdResponse.self)
            .response
        
        guard let result = response.value else {
            throw response.error ?? NSError(domain: "FragmentClient", code: 2)
        }
        
        print("Request ID:", result)
        return result.req_id
    }
    
    func fetchBuyLink(recipient: String, reqId: String, quantity: Int) async throws -> (address: String?, amount: String?, payload: String?) {
        let features = try! JSONSerialization.data(withJSONObject: ["SendTransaction", ["name": "SendTransaction", "maxMessages": 255]])
        
        var parameters: [String: String] = [
            "address": Config.FRAGMENT_ADDRESS,
            "chain": "-239",
            "walletStateInit": Config.FRAGMENT_WALLETS,
            "publicKey": Config.FRAGMENT_PUBLICKEY,
            "features": String(data: features, encoding: .utf8)!,
            "maxProtocolVersion": "2",
            "platform": "iphone",
            "appName": "Tonkeeper",
            "appVersion": "5.0.14",
            "transaction": "1",
            "id": reqId,
            "show_sender": "0",
            "method": "getBuyStarsLink"
        ]
        
        let headers: HTTPHeaders = [
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://fragment.com",
            "Referer": "https://fragment.com/stars/buy?recipient=\(recipient)&quantity=\(quantity)",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": Helpers.cookiesToString(cookies)
        ]
        
        let response = await AF.request(url, method: .post, parameters: parameters, headers: headers)
            .serializingDecodable(BuyLinkResponse.self)
            .response
        
        guard let result = response.value else {
            throw response.error ?? NSError(domain: "FragmentClient", code: 3)
        }
        
        print("Buy link:", result)
        
        if let ok = result.ok, ok,
           let messages = result.transaction?.messages.first {
            return (messages.address, messages.amount, messages.payload)
        }
        
        return (nil, nil, nil)
    }
}

// TON TRANSACTION
class TonTransaction {
    private let wallet: TonWallet
    
    init(mnemonic: [String]) throws {
        self.wallet = try TonWallet(mnemonic: mnemonic)
    }
    
    func decodePayload(_ payloadBase64: String, starsCount: Int) -> String {
        let fixed = Helpers.fixBase64Padding(payloadBase64)
        guard let decodedData = Data(base64Encoded: fixed) else {
            return payloadBase64
        }
        
        var decodedText = ""
        for byte in decodedData {
            decodedText += (byte >= 32 && byte < 127) ? String(UnicodeScalar(byte)) : " "
        }
        
        let cleanText = decodedText.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
        
        let pattern = "\(starsCount) Telegram Stars.*"
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: cleanText, range: NSRange(cleanText.startIndex..., in: cleanText)) {
            return String(cleanText[Range(match.range, in: cleanText)!])
        }
        
        return cleanText
    }
    
    func sendTransaction(recipientAddress: String, amountTon: Double, payloadBase64: String, starsCount: Int) async throws -> String {
        print("\n🔐 Инициализация кошелька...")
        
        let walletAddress = wallet.getAddress()
        print("✅ Адрес кошелька: \(walletAddress)")
        
        let amountNano = UInt64(amountTon * 1e9)
        let seqno: UInt32 = 0
        let payloadDecoded = decodePayload(payloadBase64, starsCount: starsCount)
        
        print("\n💸 Отправка транзакции...")
        print("   Получатель: \(recipientAddress)")
        print("   Сумма: \(String(format: "%.4f", amountTon)) TON (\(amountNano) nanoTON)")
        print("   Seqno: \(seqno)")
        print("   Комментарий: \(payloadDecoded)")
        
        guard let payloadCell = TonCell.fromBoc(payloadBase64) else {
            throw NSError(domain: "TonTransaction", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ошибка декодирования payload"])
        }
        
        let message = try wallet.createTransferMessage(
            destAddress: recipientAddress,
            amount: amountNano,
            payload: payloadCell,
            seqno: seqno
        )
        
        guard let boc = wallet.signAndSend(message) else {
            throw NSError(domain: "TonTransaction", code: 2, userInfo: [NSLocalizedDescriptionKey: "Ошибка подписи транзакции"])
        }
        
        let txHash = try await sendBoc(boc)
        
        print("\n✅ Транзакция отправлена успешно!")
        print("📝 Hash: \(txHash)")
        
        return txHash
    }
    
    private func sendBoc(_ boc: String) async throws -> String {
        let parameters: [String: String] = ["boc": boc]
        
        let response = await AF.request(Config.TON_API_ENDPOINT, method: .post, parameters: parameters, encoding: JSONEncoding.default)
            .serializingData()
            .response
        
        guard response.error == nil else {
            throw response.error!
        }
        
        let fixed = Helpers.fixBase64Padding(boc)
        guard let bocData = Data(base64Encoded: fixed) else {
            throw NSError(domain: "TonTransaction", code: 3)
        }
        
        let hash = Helpers.sha256(bocData)
        return hash.hexEncodedString()
    }
    
    func getBalance() {
        print("💰 Адрес кошелька: \(wallet.getAddress())")
        print("   (Проверка баланса требует запроса к TON API)")
    }
}

// ОСНОВНОЙ ПРОЦЕСС
func buyStars(username: String, starsCount: Int, fragmentHash: String, cookiesData: [String: String], mnemonic: [String]) async throws -> BuyStarsResult {
    let fragment = FragmentClient(fragmentHash: fragmentHash, cookiesData: cookiesData)
    let ton = try TonTransaction(mnemonic: mnemonic)
    
    print(String(repeating: "=", count: 60))
    print("🌟 ПОКУПКА TELEGRAM STARS")
    print(String(repeating: "=", count: 60))
    
    ton.getBalance()
    
    // Шаг 1
    print("\n📍 Шаг 1: Поиск получателя \(username)...")
    guard let recipient = try await fragment.fetchRecipient(query: username) else {
        print("❌ Получатель не найден")
        return BuyStarsResult(success: false, txHash: nil)
    }
    print("✅ Получатель найден: \(recipient)")
    
    // Шаг 2
    print("\n📝 Шаг 2: Создание запроса на \(starsCount) звезд...")
    guard let reqId = try await fragment.fetchReqId(recipient: recipient, quantity: starsCount) else {
        print("❌ Не удалось создать запрос")
        return BuyStarsResult(success: false, txHash: nil)
    }
    print("✅ Request ID: \(reqId)")
    
    // Шаг 3
    print("\n🔍 Шаг 3: Получение данных транзакции...")
    let (address, amount, payload) = try await fragment.fetchBuyLink(recipient: recipient, reqId: reqId, quantity: starsCount)
    
    guard let address = address, let amount = amount, let payload = payload else {
        print("❌ Не удалось получить данные транзакции")
        return BuyStarsResult(success: false, txHash: nil)
    }
    
    let amountTon = Double(amount)! / 1e9
    print("✅ Сумма к оплате: \(String(format: "%.4f", amountTon)) TON")
    print("✅ Адрес Fragment: \(address)")
    
    // Шаг 4
    print("\n💳 Шаг 4: Отправка транзакции в блокчейн...")
    let txHash = try await ton.sendTransaction(recipientAddress: address, amountTon: amountTon, payloadBase64: payload, starsCount: starsCount)
    
    print("\n" + String(repeating: "=", count: 60))
    print("🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!")
    print(String(repeating: "=", count: 60))
    
    return BuyStarsResult(success: true, txHash: txHash)
}

// РАСШИРЕНИЯ
extension Data {
    init(hex: String) {
        var data = Data()
        var hex = hex
        while !hex.isEmpty {
            let subIndex = hex.index(hex.startIndex, offsetBy: 2)
            let c = String(hex[..<subIndex])
            hex = String(hex[subIndex...])
            var ch: UInt8 = 0
            Scanner(string: c).scanHexInt8(&ch)
            data.append(ch)
        }
        self = data
    }
    
    func hexEncodedString() -> String {
        return map { String(format: "%02hhx", $0) }.joined()
    }
}

// MAIN
@main
struct FragmentStarsApp {
    static func main() async {
        let username = "@example"  // Замените на реальный username
        let starsCount = 100
        
        do {
            let result = try await buyStars(
                username: username,
                starsCount: starsCount,
                fragmentHash: Config.FRAGMENT_HASH,
                cookiesData: Config.DATA,
                mnemonic: Config.MNEMONIC
            )
            
            if result.success, let txHash = result.txHash {
                print("\n🔗 Просмотр транзакции:")
                print("   https://tonviewer.com/transaction/\(txHash)")
                print("   https://tonscan.org/tx/\(txHash)")
            } else {
                print("\n❌ Покупка не удалась. Проверьте конфигурацию.")
            }
        } catch {
            print("\n💥 Критическая ошибка: \(error)")
        }
    }
}
