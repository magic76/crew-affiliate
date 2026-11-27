CREATE TABLE IF NOT EXISTS daily_metrics (
 day TEXT NOT NULL,
 page TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('pageview','affiliate_click')),
 provider TEXT NOT NULL CHECK(provider IN ('','coupang','shopee')),
 count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
 PRIMARY KEY(day,page,event,provider)
) WITHOUT ROWID;
