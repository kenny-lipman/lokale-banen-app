# Lokale Banen

Job-posting aggregatie-platform: scrapet vacatures uit meerdere bronnen, verrijkt company-data, en voedt een sales-lead/CRM-pijplijn. Dit is het gedeelde domein-glossarium; één betekenis per begrip, bronoverstijgend.

## Language

### Bedrijven achter een vacature

**Eindwerkgever**:
Het bedrijf waar de baan daadwerkelijk wordt uitgevoerd. Dit is de gewenste sales-lead.
_Avoid_: werkgever (te dubbelzinnig), organisation, employer

**Bemiddelaar**:
Een partij die een vacature plaatst namens of ten behoeve van een eindwerkgever, zonder zelf de baan aan te bieden. Verzamelterm voor uitzendbureau, detacheerder, werving-en-selectiebureau en doorplaatser.
_Avoid_: intermediair (Engels-achtig), uitzender (te smal)

Het onderscheid **eindwerkgever** vs **bemiddelaar** is bronoverstijgend: het geldt voor elke bron (werk.nl, Indeed, LinkedIn, ...), niet alleen werk.nl. Een **Company** in het systeem kan een bemiddelaar zijn; sales wil daarop kunnen filteren in plaats van bemiddelaars stil als eindwerkgever te behandelen.

### Levenscyclus van een vacature

**Delisting**:
Het archiveren van een vacature omdat die niet meer bij de bron bestaat. Een gedelijste vacature blijft als rij bestaan met een `archived_reason`, maar telt niet meer als actief.

**Verlopen vacature**:
Een vacature waarvan de bron een expliciete vervaldatum (`expirationDate`) heeft die gepasseerd is. Direct delisting-signaal, los van of de vacature nog in een scan verschijnt.

**Acquisitie niet gewenst**:
Signaal van de bron dat de plaatser niet benaderd wil worden naar aanleiding van deze vacature. Een do-not-approach-markering op vacatureniveau waar sales op filtert.

**Volledige pass**:
Eén complete doorloop van alle vacatures van een bron. Voor werk.nl het autoritatieve moment waarop delisting bepaald wordt: niet-gezien-in-de-laatste-voltooide-pass betekent gedelijst. Onderscheiden van de **incrementele scan**, die alleen nieuwe/gewijzigde vacatures ontdekt en nooit archiveert.

## Relationships

- Een **Vacature** wordt geplaatst door een **Eindwerkgever** of door een **Bemiddelaar** namens een eindwerkgever.
- Een **Company** representeert ofwel een eindwerkgever ofwel een bemiddelaar; het type is een eigenschap van de Company, niet van de bron.
- Een **Vacature** wordt **gedelijst** als-ie ontbreekt in de laatste **volledige pass** of als-ie een **verlopen** vervaldatum heeft.

## Flagged ambiguities

- "organisation" / "employer" / "company" werden door elkaar gebruikt voor zowel de eindwerkgever als de plaatsende bemiddelaar. Resolutie: dit zijn verschillende rollen. De plaatsende partij is niet automatisch de eindwerkgever; voor lead-gen is dat onderscheid wezenlijk.
- Bemiddelaar-detectie (Fase 2, resolved): de werk.nl detail-API heeft **geen** schoon bemiddelaar-signaal (`isByEmployerDirectly` staat ook op `true` voor een uitzendbureau dat zelf plaatst). Resolutie: **keyword-heuristiek** op `organizationName`/`website`, vastgelegd als `companies.is_bemiddelaar`. Sector-code-mapping uitgesteld tot de heuristiek tekortschiet.
