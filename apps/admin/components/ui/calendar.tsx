"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type ChevronProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// react-day-picker v9 heeft een complete classNames-API rename ondergaan vs v8:
//   v8 -> v9 mapping:
//   caption           -> month_caption
//   head_row          -> weekdays
//   head_cell         -> weekday
//   row               -> week
//   cell              -> day
//   day               -> day_button
//   day_selected      -> selected (modifier op day)
//   day_today         -> today
//   day_outside       -> outside
//   day_disabled      -> disabled
//   nav_button_*      -> button_previous / button_next
//   table             -> month_grid
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1 absolute inset-x-1 top-1 justify-between pointer-events-none",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 pointer-events-auto"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 pointer-events-auto"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground rounded-md",
        // 'today' is alleen een visuele referentie (DayPicker markeert altijd
        // de huidige dag). Subtiele ring zodat het niet verward wordt met
        // 'selected' - die heeft de volle primary-achtergrond.
        today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-muted-foreground/40 [&>button]:font-medium rounded-md",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-50",
        disabled: "[&>button]:text-muted-foreground [&>button]:opacity-40 [&>button]:cursor-not-allowed",
        range_start: "rounded-l-md",
        range_middle: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        range_end: "rounded-r-md",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }: ChevronProps) =>
          orientation === 'right'
            ? <ChevronRight className="h-4 w-4" {...props} />
            : <ChevronLeft className="h-4 w-4" {...props} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
