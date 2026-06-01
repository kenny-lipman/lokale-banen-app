#!/usr/bin/env bash
# PostToolUse hook: herinnert eraan de bijbehorende docs/reference/*.md bij te werken
# wanneer code in een gedocumenteerd domein wordt gewijzigd. Output gaat als
# additionalContext terug naar het model. Geen match = geen output = geen ruis.
jq -rc '
  (.tool_input.file_path // .tool_response.filePath // "") as $f
  | if ($f | test("docs/reference/")) then empty
    else
      ($f
        | if test("/components/ui/") then "docs/reference/ui-components.md"
          elif test("/app/api/.*/route\\.ts$") then "docs/reference/conventions.md (auth-seam) plus het relevante domein-doc"
          elif test("/supabase/migrations/") then "docs/reference/database.md"
          elif test("scraper") then "docs/reference/scrapers.md"
          elif test("/cron") then "docs/reference/cron-jobs.md"
          elif test("/automations/") then "docs/reference/cron-jobs.md of scrapers.md"
          else "" end) as $doc
      | if $doc == "" then empty
        else {hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext:("Doc-onderhoud: je wijzigde \($f). Check of \($doc) moet worden bijgewerkt in dezelfde commit (CLAUDE.md hard rule: doc en code lopen niet uiteen).")}}
        end
    end
' 2>/dev/null || true
