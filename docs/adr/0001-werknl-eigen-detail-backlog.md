# 0001 - werk.nl gebruikt niet de gedeelde needs_detail_scrape vlag

De `needs_detail_scrape`-boolean op `job_postings` is eigendom van de career-page-detail-scrape flow: een cron die elke 10 minuten bron-blind elke rij met die vlag (en een `url`) oppakt en de generieke career-page-extractor erop draait. Als de werk.nl lijst-scan die vlag zou zetten, worden werk.nl-rijen ten onrechte door die extractor verwerkt (verkeerde parser op de detail-API-URL) en wordt de vlag op `false` gezet, waardoor de toekomstige werk.nl-worker ze nooit meer ziet.

**Besluit:** de werk.nl lijst-scan zet `needs_detail_scrape` niet. De werk.nl detail-backlog wordt vanaf Fase 2 bijgehouden in een eigen `werk_nl_scrape_queue` (bounded context, eigen worker, onafhankelijk pauzeren/schalen). Dit volgt het werkenindekempen-patroon (eigen queue per bron-scraper).

**Overwogen alternatief:** de career-page-cron bron-bewust maken (source-filter). Afgewezen: dat raakt een werkende automation en houdt één vlag overladen over twee bounded contexts; ontkoppelen aan de producent-kant is schoner.
