# werk.nl detail-API payload - spike-bevindingen (Fase 2, Task 1)

Bron: live `GET .../kia/publiek/zoekenvacatures/api/vacature/{referenceNumber}` via de Fase-1 sessielaag. 3 echte payloads geinspecteerd (refs 37544818, 37694743, 37695295). Read-only, geen DB.

## Top-level structuur

```
referenceNumber            number   (= job_postings.external_vacancy_id)
externalReferenceId        string?  (vaak null)
employerInternalVacatureId string?  (vrije tekst van plaatser)
title                      string
expirationDate             string   "2026-07-03T00:00:00" (naive, geen tz)
modifiedDate               string   "2026-06-05T00:00:00"
createdDate                string
proposition                object   (zie onder: functie/salaris/uren/locatie/contract)
contactPerson              object?  (zie onder)
description                string   (lange vacaturetekst)
isEuresPriority            boolean
isAcquisitionNotAppreciated boolean  <-- ZIE WAARSCHUWING
source                     string   "WNL"
isByEmployerDirectly       boolean  <-- NIET het bemiddelaar-signaal, zie onder
cvOffer                    object   (educationLevel, languageSkills, ...)
applicationMethods         array    ({ sollicitatieWijze:int, urlApplicationForm:string })
employer                   object   (zie onder: dedup-bron)
```

### proposition (job-velden)
```
proposition.function.name            functienaam ("Assemblagemedewerker metaal / elektro")
proposition.function.description      functie-eisen (tekst)
proposition.salary.amountIndication  "2500 - 3500"
proposition.workhours.minimumHours   number
proposition.workhours.maximumHours   number
proposition.contract.type            int (1 = ?)  [codetabel onbekend]
proposition.workLocation.city        "UTRECHT"
proposition.workLocation.postcode    "3572BB"
```

### employer (company-dedup bron)
```
employer.referenceNumber   number   STABIEL  -> dedup-laag 1 (werknl_employer_id)
employer.organizationName  string   -> normalized_name (laag 2)
employer.website           string   "www.urgent-uitzendburo.nl" -> hoofddomein (laag 3)
employer.sector            string   "31317"  (werk.nl-eigen sectorcode, geen SBI)
employer.addressNetherlands{ postcode, city, streetName, houseNumber }
```
Bevestigd: in alle 3 samples is `employer.referenceNumber` gelijk (32609) -> dedup-laag 1 merget ze correct tot 1 company.

### contactPerson (contact-aanmaak)
```
contactPerson.referenceNumber  number
contactPerson.name             "Dymph Herber"
contactPerson.email            "info@urgent-uitzendburo.nl"
contactPerson.phoneNumber      "030-2316344"
contactPerson.department       string?
```

## Antwoorden op de open grill-vragen

**(a) Bemiddelaar/uitzendbureau-signaal: GEEN schoon veld.**
`isByEmployerDirectly` is in alle 3 samples `true`, terwijl de `employer` "Urgent Uitzendburo B.V." is. Het veld betekent dus "de plaatser plaatste zelf rechtstreeks", NIET "de plaatser is de eindwerkgever". Een uitzendbureau dat zelf plaatst = `isByEmployerDirectly: true`. Er is geen boolean "is uitzendbureau".
-> Bemiddelaar-detectie moet **heuristisch**: op `organizationName`/`website` (termen als uitzend, detach, flex, payroll, werving, recruit, ...) en eventueel een mapping van `employer.sector`-codes. Dit raakt CONTEXT.md (systeembreed `is_bemiddelaar`).

**(b) Vervaldatum: bevestigd.**
`expirationDate` = naive ISO datetime ("2026-07-03T00:00:00"). Direct bruikbaar voor archiveren-op-verlopen.

**(c) employer/contactPerson voor dedup + contacts: volledig beschikbaar** (zie boven).

## WAARSCHUWING voor lead-gen: isAcquisitionNotAppreciated

In alle 3 samples `true`. Dit is de standaard NL-disclaimer "acquisitie naar aanleiding van deze vacature wordt niet op prijs gesteld". Voor een platform dat juist recruitment/sales-leads genereert, is dit een direct **do-not-approach**-signaal op vacature-niveau. Beslissing nodig: opslaan en sales hierop laten filteren, of negeren.

## Codetabellen nog onbekend (niet blokkerend voor Fase 2)
`proposition.contract.type`, `salary.type`, `workLocation.type`, `applicationMethods.sollicitatieWijze`, `cvOffer.educationLevel.referentieOpleidingsniveau` zijn ints met onbekende betekenis. Voor Fase 2 mappen we de mens-leesbare velden (`function.name`, `educationLevel.name`, `amountIndication`); de int-codes laten we voorlopig links liggen.
