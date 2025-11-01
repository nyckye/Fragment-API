// УСТАНОВКА ЗАВИСИМОСТЕЙ:
// dotnet add package Newtonsoft.Json
// dotnet add package TonSdk.Client
// dotnet add package TonSdk.Core

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TonSdk.Client;
using TonSdk.Core;
using TonSdk.Core.Boc;
using TonSdk.Core.Crypto;

namespace FragmentStarsBot
{
    // КОНФИГУРАЦИЯ
    public class Config
    {
        public static readonly string[] MNEMONIC = new[]
        {
            "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
            "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
            "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
        };

        public static readonly Dictionary<string, string> DATA = new()
        {
            { "stel_ssid", "ваш_ssid" },
            { "stel_dt", "-240" },
            { "stel_ton_token", "ваш_ton_token" },
            { "stel_token", "ваш_token" }
        };

        public const string FRAGMENT_HASH = "ed3ec875a724358cea";
        public const string FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03";
        public const string FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq";
        public const string FRAGMENT_ADDRESS = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118";
    }

    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    public static class Helpers
    {
        public static string FixBase64Padding(string b64String)
        {
            int missingPadding = b64String.Length % 4;
            if (missingPadding > 0)
            {
                b64String += new string('=', 4 - missingPadding);
            }
            return b64String;
        }

        public static string CookiesToString(Dictionary<string, string> cookies)
        {
            return string.Join("; ", cookies.Select(kvp => $"{kvp.Key}={kvp.Value}"));
        }
    }

    // FRAGMENT CLIENT
    public class FragmentClient
    {
        private readonly string _url;
        private readonly Dictionary<string, string> _cookies;
        private readonly HttpClient _httpClient;

        public FragmentClient(string fragmentHash, Dictionary<string, string> cookiesData)
        {
            _url = $"https://fragment.com/api?hash={fragmentHash}";
            _cookies = cookiesData;
            _httpClient = new HttpClient();
        }

        public async Task<string> FetchRecipient(string query)
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "query", query },
                { "method", "searchStarsRecipient" }
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _url)
            {
                Content = content
            };
            request.Headers.Add("Cookie", Helpers.CookiesToString(_cookies));

            var response = await _httpClient.SendAsync(request);
            var result = await response.Content.ReadAsStringAsync();
            var json = JObject.Parse(result);

            Console.WriteLine($"Recipient search: {result}");
            return json["found"]?["recipient"]?.ToString();
        }

        public async Task<string> FetchReqId(string recipient, int quantity)
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "recipient", recipient },
                { "quantity", quantity.ToString() },
                { "method", "initBuyStarsRequest" }
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _url)
            {
                Content = content
            };
            request.Headers.Add("Cookie", Helpers.CookiesToString(_cookies));

            var response = await _httpClient.SendAsync(request);
            var result = await response.Content.ReadAsStringAsync();
            var json = JObject.Parse(result);

            Console.WriteLine($"Request ID: {result}");
            return json["req_id"]?.ToString();
        }

        public async Task<(string address, string amount, string payload)> FetchBuyLink(
            string recipient, string reqId, int quantity)
        {
            var features = JsonConvert.SerializeObject(new object[]
            {
                "SendTransaction",
                new { name = "SendTransaction", maxMessages = 255 }
            });

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "address", Config.FRAGMENT_ADDRESS },
                { "chain", "-239" },
                { "walletStateInit", Config.FRAGMENT_WALLETS },
                { "publicKey", Config.FRAGMENT_PUBLICKEY },
                { "features", features },
                { "maxProtocolVersion", "2" },
                { "platform", "iphone" },
                { "appName", "Tonkeeper" },
                { "appVersion", "5.0.14" },
                { "transaction", "1" },
                { "id", reqId },
                { "show_sender", "0" },
                { "method", "getBuyStarsLink" }
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _url)
            {
                Content = content
            };

            request.Headers.Add("Accept", "application/json, text/javascript, */*; q=0.01");
            request.Headers.Add("Origin", "https://fragment.com");
            request.Headers.Add("Referer", $"https://fragment.com/stars/buy?recipient={recipient}&quantity={quantity}");
            request.Headers.Add("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15");
            request.Headers.Add("X-Requested-With", "XMLHttpRequest");
            request.Headers.Add("Cookie", Helpers.CookiesToString(_cookies));

            var response = await _httpClient.SendAsync(request);
            var result = await response.Content.ReadAsStringAsync();
            var json = JObject.Parse(result);

            Console.WriteLine($"Buy link: {result}");

            if (json["ok"]?.ToObject<bool>() == true && json["transaction"] != null)
            {
                var msg = json["transaction"]["messages"][0];
                return (
                    msg["address"]?.ToString(),
                    msg["amount"]?.ToString(),
                    msg["payload"]?.ToString()
                );
            }

            return (null, null, null);
        }
    }

    // TON TRANSACTION
    public class TonTransaction
    {
        private readonly string[] _mnemonic;
        private readonly TonClient _client;

        public TonTransaction(string[] mnemonic)
        {
            _mnemonic = mnemonic;
            _client = new TonClient(TonClientParameters.MainNet);
        }

        public string DecodePayload(string payloadBase64, int starsCount)
        {
            try
            {
                var fixedBase64 = Helpers.FixBase64Padding(payloadBase64);
                var decodedBytes = Convert.FromBase64String(fixedBase64);

                var decodedText = new StringBuilder();
                foreach (var b in decodedBytes)
                {
                    decodedText.Append(b >= 32 && b < 127 ? (char)b : ' ');
                }

                var cleanText = Regex.Replace(decodedText.ToString(), @"\s+", " ").Trim();
                var match = Regex.Match(cleanText, $@"{starsCount} Telegram Stars.*");

                return match.Success ? match.Value : cleanText;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка декодирования payload: {ex.Message}");
                return payloadBase64;
            }
        }

        public async Task<string> SendTransaction(string recipientAddress, double amountTon, 
            string payload, int starsCount)
        {
            try
            {
                Console.WriteLine("\n🔐 Инициализация кошелька...");

                // Создаем ключи из мнемоники
                var mnemonicString = string.Join(" ", _mnemonic);
                var mnemonic = new Mnemonic(mnemonicString);
                var keys = mnemonic.Keys;

                // Создаем кошелек V4R2
                var wallet = new WalletV4R2(new WalletV4R2Options
                {
                    PublicKey = keys.PublicKey,
                    Workchain = 0
                });

                var walletAddress = wallet.Address.ToString(AddressType.Base64, new AddressStringifyOptions
                {
                    Bounceable = true,
                    TestOnly = false,
                    UrlSafe = true
                });

                Console.WriteLine($"✅ Адрес кошелька: {walletAddress}");

                // Получаем seqno
                var seqno = await _client.GetSeqno(wallet.Address);
                Console.WriteLine($"📊 Seqno: {seqno}");

                // Декодируем payload
                var payloadCell = Cell.From(Convert.FromBase64String(Helpers.FixBase64Padding(payload)));

                // Конвертируем сумму в nanotons
                var amountInNano = new Coins(amountTon);

                Console.WriteLine($"\n💸 Отправка транзакции...");
                Console.WriteLine($"   Получатель: {recipientAddress}");
                Console.WriteLine($"   Сумма: {amountTon} TON");
                Console.WriteLine($"   Комментарий: {DecodePayload(payload, starsCount)}");

                // Создаем сообщение перевода
                var transfer = wallet.CreateTransferMessage(new[]
                {
                    new WalletTransfer
                    {
                        Message = new InternalMessage(new InternalMessageOptions
                        {
                            Info = new CommonMessageInfoInternal(new CommonMessageInfoInternalOptions
                            {
                                Dest = new Address(recipientAddress),
                                Value = amountInNano,
                                Bounce = true
                            }),
                            Body = payloadCell
                        }),
                        Mode = 3
                    }
                }, seqno);

                // Подписываем транзакцию
                var signedMessage = wallet.Sign(keys.PrivateKey, transfer.SigningMessage);
                var externalMessage = transfer.Message(signedMessage);

                // Отправляем
                await _client.SendBoc(externalMessage);

                var txHash = Convert.ToBase64String(externalMessage.Hash());

                Console.WriteLine($"\n✅ Транзакция отправлена успешно!");
                Console.WriteLine($"📝 Hash: {txHash}");

                return txHash;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n❌ Ошибка при отправке транзакции: {ex.Message}");
                throw;
            }
        }

        public async Task<decimal> GetBalance()
        {
            try
            {
                var mnemonicString = string.Join(" ", _mnemonic);
                var mnemonic = new Mnemonic(mnemonicString);
                var keys = mnemonic.Keys;

                var wallet = new WalletV4R2(new WalletV4R2Options
                {
                    PublicKey = keys.PublicKey,
                    Workchain = 0
                });

                var balance = await _client.GetBalance(wallet.Address);
                var balanceInTon = balance.ToDecimal();

                Console.WriteLine($"💰 Баланс кошелька: {balanceInTon} TON");
                return balanceInTon;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка получения баланса: {ex.Message}");
                return 0;
            }
        }
    }

    // ОСНОВНОЙ ПРОЦЕСС
    public class Program
    {
        public static async Task<(bool success, string txHash)> BuyStars(
            string username, int starsCount, string fragmentHash,
            Dictionary<string, string> cookiesData, string[] mnemonic)
        {
            var fragment = new FragmentClient(fragmentHash, cookiesData);
            var ton = new TonTransaction(mnemonic);

            Console.WriteLine("\n" + new string('=', 60));
            Console.WriteLine("🌟 ПОКУПКА TELEGRAM STARS");
            Console.WriteLine(new string('=', 60));

            // Проверяем баланс
            await ton.GetBalance();

            // Шаг 1: Поиск получателя
            Console.WriteLine($"\n📍 Шаг 1: Поиск получателя {username}...");
            var recipient = await fragment.FetchRecipient(username);
            if (string.IsNullOrEmpty(recipient))
            {
                Console.WriteLine("❌ Получатель не найден");
                return (false, null);
            }
            Console.WriteLine($"✅ Получатель найден: {recipient}");

            // Шаг 2: Создание запроса
            Console.WriteLine($"\n📝 Шаг 2: Создание запроса на {starsCount} звезд...");
            var reqId = await fragment.FetchReqId(recipient, starsCount);
            if (string.IsNullOrEmpty(reqId))
            {
                Console.WriteLine("❌ Не удалось создать запрос");
                return (false, null);
            }
            Console.WriteLine($"✅ Request ID: {reqId}");

            // Шаг 3: Получение данных транзакции
            Console.WriteLine("\n🔍 Шаг 3: Получение данных транзакции...");
            var (address, amount, payload) = await fragment.FetchBuyLink(recipient, reqId, starsCount);
            if (string.IsNullOrEmpty(address) || string.IsNullOrEmpty(amount) || string.IsNullOrEmpty(payload))
            {
                Console.WriteLine("❌ Не удалось получить данные транзакции");
                return (false, null);
            }

            var amountTon = double.Parse(amount) / 1_000_000_000;
            Console.WriteLine($"✅ Сумма к оплате: {amountTon:F4} TON");
            Console.WriteLine($"✅ Адрес Fragment: {address}");

            // Шаг 4: Отправка TON
            Console.WriteLine("\n💳 Шаг 4: Отправка транзакции в блокчейн...");
            try
            {
                var txHash = await ton.SendTransaction(address, amountTon, payload, starsCount);

                if (!string.IsNullOrEmpty(txHash))
                {
                    Console.WriteLine("\n" + new string('=', 60));
                    Console.WriteLine("🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!");
                    Console.WriteLine(new string('=', 60));
                    return (true, txHash);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n❌ Ошибка при отправке: {ex.Message}");
                return (false, null);
            }

            return (false, null);
        }

        public static async Task Main(string[] args)
        {
            try
            {
                // Параметры покупки
                string username = "@example";
                int starsCount = 100;

                var (success, txHash) = await BuyStars(
                    username,
                    starsCount,
                    Config.FRAGMENT_HASH,
                    Config.DATA,
                    Config.MNEMONIC
                );

                if (success)
                {
                    Console.WriteLine("\n🔗 Просмотр транзакции:");
                    Console.WriteLine($"   https://tonviewer.com/transaction/{txHash}");
                    Console.WriteLine($"   https://tonscan.org/tx/{txHash}");
                }
                else
                {
                    Console.WriteLine("\n❌ Покупка не удалась. Проверьте конфигурацию.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n💥 Критическая ошибка: {ex.Message}");
            }
        }
    }
}
