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
6. Reco API 已確認：POST /v2/providers/affiliate_open_api/apis/openapi/v2/products/reco。執行 node scripts/coupang-reco.mjs --self-test 或設定金鑰後執行 node scripts/coupang-reco.mjs。單次診斷只傳實際網站 domain/page 與 imp 的原生廣告、圖片尺寸及暫定 placementId；不傳 device/user、不呼叫 impressionUrl 或商品連結、不記錄原始資料。回傳商品數量及必要欄位完整數；空結果不等於認證失敗。
7. Reco 是廣告推薦，未記載 keyword 查詢；正式展示須在真實曝光時依文件呼叫 impressionUrl，並先核對隱私、平台規則、媒體核准、快取期限及 placement/subId 設定。Document 已確認商品搜尋、分類、特價、活動及報表端點；詳細參數及回應 schema 仍需核對。尚未排程、發布真實商品或驗證成交佣金。

8. 商品診斷：node scripts/coupang-products.mjs --self-test；設定金鑰後執行 node scripts/coupang-products.mjs，單次並行查詢 search、hotcategories、goldbox。搜尋暫用 keyword=USB-C&limit=5；參數及回傳欄位以實測和展開的官方 Document 確認。僅輸出狀態、結構與筆數，不保存原始商品資料或開啟追蹤網址。
9. 官方速率限制：search 50 次/分鐘、reports 500 次/小時、Reco 1000 次/分鐘；goldbox 每日 07:30 更新，報表每日 12:00 更新（時區待確認）。reports/clicks、orders、cancels、commission 及 ads 報表已列於官方文件，日期參數、資料格式、歸因維度尚未提供，暫不呼叫或發布收益。

## 商品型網站預覽（不發布）

- 首頁每日特價（8 筆摘要）、特價完整頁、最多 10 個熱門分類頁、三篇既有指南的關鍵字相關商品。使用真實 API 圖片、價格與追蹤網址，保留分潤揭露及資料更新時間，不把搜尋結果稱為實測。
- 同步上限：3 個主題搜尋（各 5 筆）及最多 1 次 USB-C fallback、1 次 goldbox、1 次 hotcategories、最多 10 次分類詳情；分類詳情最多並行 3 次，失敗顯示空狀態。不呼叫 impressionUrl、不點擊商品。URL 與必要欄位白名單、去重、關鍵字名稱篩選，仍需人工確認商品與主題相關性。
- 本地私密預覽（先安全設定環境變數金鑰）：export CATALOG_PREVIEW_FILE="$(mktemp -d)/catalog.json"；npm run catalog:preview；SITE_URL= npm run build；python3 -m http.server 8080 --bind 127.0.0.1 --directory public。預覽快照在 repo 外、限 0600、不覆寫，建置要求資料未超過一小時，預覽伺服器僅應在可信本地環境使用。完成後移除快照目錄，再執行 unset CATALOG_PREVIEW_FILE; npm run build 清除產出。勿提交、上傳或部署預覽檔案。
- CI 只驗證真實資料渲染與頁面數，未保存或上傳快照、未發布商品、未啟用排程。Cloudflare 正常建置不讀取預覽資料；預覽禁止 SITE_URL，維持 noindex。noindex 不是存取控制，勿部署預覽。正式資料留存/圖片及價格展示條款、媒體核准、報表詳細參數仍待確認。正式管理後台應採存取控制及私有資料庫，不放在公開 Pages 或 repo。

- 商品搜尋回傳的圖片實測使用 ads-partners.tw.coupang.com，已加入精確主機白名單；搜尋資料診斷只記錄固定分類及公開圖片主機，不輸出商品或追蹤 URL。正式發布仍未開啟。

## 正式商品發布（受控試行）

Cloudflare Pages Functions + KV: CATALOG_KV 綁定只在 production，CATALOG_PUBLISH_ENABLED=1 開啟正式商品；0 關閉並回退靜態網站。僅 hicrewapps.com 可用，頁面維持 noindex。GitHub Actions catalog-publish.yml 以限定 repo/main/工作流的 OIDC 短效 JWT 授權上傳，金鑰留在 GitHub Secrets。快照最長一小時，過期或資料異常時回退；每 30 分鐘嘗試刷新（GitHub cron 可能延遲）。不保存原始 API 回應、不提交商品資料、不傳用戶識別資料、不製造曝光、不點擊連結。仍需核對媒體登錄與官方資料使用條款，若平台要求更短保留或不允許展示則停用並調整。報表與 AI 產文不包含在此次變更。

- 正式同步成功必須讀回新鮮快照狀態及首頁、特價頁、分類頁與有配對的指南頁 HTML；檢查商品卡、價格與 sponsored 連結標記，不開啟商品 URL。若發布端點無法存取或頁面未更新則 CI 失敗，不將未發布誤報為成功。

## 商品探索

首頁導向商品探索、每日特價、熱門分類與指南。搜尋使用已驗證且未過期的本站商品快照，支援關鍵字、分類、最低/最高價格、火箭配送與價格排序；跨來源以商品 ID 去重。不直接呼叫酷澎搜尋 API、不存使用者搜尋歷史、不宣稱全站搜尋。商品資料過期顯示暫未同步；正式站繼續 noindex。

## SEO 正式索引開關

SEO_INDEX_ENABLED=1（僅 Cloudflare production）時，hicrewapps.com 的首頁、關於、功率工具及三篇已列名的指南允許索引。src/seo.mjs 明確列出允許頁面；新指南預設 noindex，審閱後才加入。搜尋、特價列表、分類商品頁、API 與 preview 均不開放索引。正式 robots.txt 宣告 sitemap，僅列允許頁面，以 trailing slash URL 為 canonical，舊 index.html URL 301 轉址。商品快照失效不影響內容頁的索引。將 SEO_INDEX_ENABLED 設為 0 並重新部署可停用索引。索引允許不等於 Google 已收錄；需另外在 Search Console 驗證網站並提交 sitemap。

## 選購指南轉換版型

既有三篇文章保留網址及索引政策，新增購買意圖標題、快速結論、商品價格比較、使用情境表及 FAQ。商品依 API 當前價格排序，不推測未提供的瓦數、插孔或協議，不宣稱實測或最低價。

## First-party conversion metrics

Production-only METRICS_ENABLED=1 and METRICS_DB binding to dedicated D1. Apply migrations/001_metrics.sql before enabling. Counts are browser pageviews and observed trusted sponsored-link activations, grouped by Taipei date, known page bucket, event and platform. No personal IDs, cookies, IP, user agent, search query, price or product URL are stored by the metrics code. GPC/DNT honored. Category pages grouped; no arbitrary paths. POST only, same-origin browser headers, bounded payload. Counts are directional and may be affected by bots, blocking, repeat visits or spoofed requests, not unique visitors or settled orders. No automatic click, affiliate redirects or external URL requests. D1 usage limits apply; failures do not prevent shopping. Reports are private via Cloudflare authenticated access; no public read endpoint. Disable flag and redeploy to stop collection.

## Editorial workflow

`data/topic-queue.json` contains observed search-result and manufacturer evidence, editorial fit/intent hypotheses, and null search-volume/competition. `node scripts/editorial-check.mjs --topics` prints candidate briefs. Existing-guide topics should be merged into their existing page rather than creating duplicate entry points. Before adding a guide to APPROVED_GUIDES, require original actionable analysis, source links and review, scenarios, FAQs, unique metadata, actual product matching, no fabricated experience or prices, and human/agent evidence review. Structural tests are not fact-checking. JSON-LD Article/BreadcrumbList only on approved canonical guides; no Product/Review/rating claims. Google Search spam policy: https://developers.google.com/search/docs/essentials/spam-policies. No automatic AI publishing or real GSC volume data yet.

## 商品比較

`/compare/` 支援比較最多三件新鮮快照商品，只顯示 API 已提供的名稱、價格、分類與配送；不推測規格、不以價格判定品質，過期或不存在的商品不顯示。比較結果和參數維持 noindex；不保存使用者選擇、不增加酷澎 API 請求。直接 sponsored 連結保留。

## MVP routing and catalog count

`/affiliate` and supported public subpaths redirect 301 to the canonical root routes, preserving query parameters. Unknown affiliate paths return 404. `/guides/` is a guide directory. Search counts use unique product IDs across current validated deal, category and guide rows. `/api/catalog` exposes the same aggregate counts; no 500-product guarantee. Images retain provider URLs; a local labeled placeholder replaces failed images without retry loops or proxying/storing provider images.

## Catalog expansion
40 editorial purchase-intent keywords, conservative two-second pacing per search, bounded limit=10 probe (falls back to 5 if rejected), optional documented bestcategories detail without additional parameters if unique count below 501. Stop expansion on 429/401/403, do not bypass provider limits. No long-term storage, no invented products. Search/API counts share validated unique IDs; report target >500 separately from actual. Snapshot endpoint protocol 5, max 2 MiB; readback checks search count. Expansion remains dependent on provider response and approved usage terms.

## 商品卡片賣點（CRO 第一階段）
首頁、商品探索、每日特價、分類及指南中的商品卡共用 `productBenefits`。以已同步商品標題的品類與明示特色生成簡短使用利益；特色不足時只顯示品類用途，品類不明、配件或否定／混合名稱則不生成。最多兩個明示特色，不新增價格、優惠、評價、實測或未提供的規格。比較表、指南正文與購物工具不變。仍沿用原始 sponsored 連結和點擊統計。無額外 API、快照欄位、快取、金鑰或資料留存。本階段是確定性文案規則，不是 Gemini 即時產文；若後續加入模型，應先取得並核對可用商品規格來源及資料使用條款，避免用商品標題補造規格。以實際點擊率驗證效果，不保證轉換提升。
