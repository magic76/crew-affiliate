# Crew Affiliate

繁體中文選購內容網站 MVP。USB-C 充電周邊是暫定示範市場，尚未驗證搜尋量及競爭。

Node 20+：npm run build、npm test、npm run preview（Python 3）。public/ 內含靜態網站。Cloudflare Pages 建置指令 npm run build，輸出 public；設定 SITE_URL 為正式 HTTPS 網址（可含子路徑，不含結尾斜線）。未設定時 noindex、不產生 sitemap；正式上線前確認域名與內容、提交 Search Console。正式站已部署於 https://hicrewapps.com，暫不開放索引。

## 內容與分潤

data/guides.json 是指南來源；data/products.json 包含一筆一般商品連結示範（preview: true、approved: false），不計佣金。正式分潤與一般連結分開處理。取得平台與推廣媒體核准、真實分潤連結後，新增 id、guideSlug、name、affiliateUrl、verifiedOn（YYYY-MM-DD）、approved（人工核對後才設 true）。目前限定 HTTPS 的 s.shopee.tw、shope.ee、shopee.tw，須再依官方資料驗證可用網域。沒有商品連結時不渲染推薦。不存 API 金鑰或個資。資料驗證不代表已確認佣金歸因。

## 下一階段

- 搜尋需求、SERP 競爭、內容來源與商品規格驗證。
- 確認聯盟 API 權限、Sub_id、佣金與訂單資料，建立商品同步及報表。
- 確認正式網址及分析隱私規範，接 Search Console/GA4。
- 自動產文及排程尚未實作；不以文章數量為 KPI，不假造實測。

## 酷澎 Partners（台灣）

1. 登入 https://partners.tw.coupang.com/ ，確認推廣資格與 hicrewapps.com 媒體核准，再到「工具 → Partners API」。
2. 金鑰只存本機環境變數或經核准的伺服器 secrets：COUPANG_ACCESS_KEY、COUPANG_SECRET_KEY。不要貼到對話、commit 或前端。
3. 台灣 Partners Guide 確認 gateway 為 https://api-gateway.tw.coupang.com，POST /v2/providers/affiliate_open_api/apis/openapi/v1/deeplink，HMAC 簽章使用 UTC 時間、方法、路徑、query（不含問號）。使用者已在 Termux 成功取得 rCode=0 與 shortenUrl。
4. 執行 node scripts/coupang-smoke.mjs --self-test（不連網）；設定金鑰後執行 node scripts/coupang-smoke.mjs，單次 POST 產生測試分潤連結，只輸出狀態，不輸出原始回應或連結。雲端若被拒絕，遵守平台限制，不繞過。
5. 經人工核對的真實分潤商品可加入 data/products.json：provider: coupang、id、guideSlug、name、description（選填）、affiliateUrl（支援官方 https://coupa.ng/… 及 https://link.tw.coupang.com/a/…）、verifiedOn、approved: true。正式商品含分潤揭露。搜尋結果連結不得冒充特定商品。
6. 商品搜尋、推薦、業績報表、同步頻率、使用期限仍待 Partners Document / Reco API 文件確認；未排程、未發布真實酷澎商品，API 成功不等於成交佣金已驗證。
