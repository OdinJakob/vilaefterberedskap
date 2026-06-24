import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dygnsbrytAsset from "@/assets/dygnsbryt_i_personec.png.asset.json";

export default function DygnsbrytHelp() {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Mer information om dygnsbryt"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3 space-y-2">
        <p className="text-sm text-popover-foreground">
          Information om ditt dygnsbryt hittar du i Personec.
        </p>
        <img
          src={dygnsbrytAsset.url}
          alt="Skärmbild som visar var dygnsbrytet visas i Personec Kalender"
          className="w-full rounded border"
        />
      </TooltipContent>
    </Tooltip>
  );
}
