"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Test component to verify scrolling works
export function ScrollingTest() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Test Scrolling</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 max-h-[300px] overflow-hidden">
        <div className="p-2 border-b">
          <p className="text-sm font-medium">Scrolling Test</p>
        </div>
        <div 
          className="max-h-[200px] overflow-y-auto custom-scrollbar"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db #f3f4f6'
          }}
        >
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="p-2 border-b hover:bg-gray-50">
              <p className="text-sm">Item {i + 1} - This is a test item to verify scrolling functionality</p>
            </div>
          ))}
        </div>
        <div className="p-2 border-t">
          <p className="text-xs text-gray-500">20 items total</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}