import { DateRange } from "@mui/icons-material";
import {
  Box,
  ButtonGroup,
  Button,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Stack,
  Typography,
} from "@mui/joy";
import React, { useState, useCallback } from "react";
import { TimeRange } from "../core/ChartTypes";

type PresetKey = "5m" | "1h" | "6h" | "24h";

const PRESET_RANGES: { key: PresetKey; label: string }[] = [
  { key: "5m", label: "5 Minutes" },
  { key: "1h", label: "1 Hour" },
  { key: "6h", label: "6 Hours" },
  { key: "24h", label: "24 Hours" },
];

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  disabled?: boolean;
  showCustomRange?: boolean;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  disabled = false,
  showCustomRange = true,
}) => {
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  const handlePresetSelect = useCallback(
    (preset: PresetKey) => {
      const now = Date.now();
      let start = now;
      switch (preset) {
        case "5m":
          start = now - 5 * 60 * 1000;
          break;
        case "1h":
          start = now - 60 * 60 * 1000;
          break;
        case "6h":
          start = now - 6 * 60 * 60 * 1000;
          break;
        case "24h":
          start = now - 24 * 60 * 60 * 1000;
          break;
      }
      onRangeChange({ start, end: now, preset });
    },
    [onRangeChange],
  );

  const handleCustomRangeOpen = () => {
    setCustomStart(new Date(selectedRange.start));
    setCustomEnd(new Date(selectedRange.end));
    setCustomModalOpen(true);
  };

  const handleCustomRangeApply = () => {
    if (customStart && customEnd) {
      onRangeChange({
        start: customStart.getTime(),
        end: customEnd.getTime(),
        preset: "custom",
      });
      setCustomModalOpen(false);
    }
  };

  // const getCurrentRangeLabel = () => {
  //   if (selectedRange.preset && selectedRange.preset !== "custom") {
  //     return (
  //       PRESET_RANGES.find((p) => p.key === selectedRange.preset)?.label ||
  //       "Custom"
  //     );
  //   }
  //   const start = new Date(selectedRange.start).toLocaleString();
  //   const end = new Date(selectedRange.end).toLocaleString();
  //   return `${start} - ${end}`;
  // };

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
    >
      <ButtonGroup size="sm" disabled={disabled}>
        {PRESET_RANGES.map((preset) => (
          <Button
            key={preset.key}
            color={selectedRange.preset === preset.key ? "primary" : "neutral"}
            variant={selectedRange.preset === preset.key ? "solid" : "outlined"}
            onClick={() => handlePresetSelect(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </ButtonGroup>

      {showCustomRange && (
        <Button
          size="sm"
          color={selectedRange.preset === "custom" ? "primary" : "neutral"}
          variant={selectedRange.preset === "custom" ? "solid" : "outlined"}
          onClick={handleCustomRangeOpen}
          startDecorator={<DateRange />}
        >
          Custom
        </Button>
      )}

      <Modal open={customModalOpen} onClose={() => setCustomModalOpen(false)}>
        <ModalDialog>
          <DialogTitle>Custom Time Range</DialogTitle>
          <DialogContent>
            {/* Replace with a proper DateTime picker component if available */}
            <Typography>Date pickers would go here.</Typography>
          </DialogContent>
          <Stack
            direction="row"
            spacing={2}
            sx={{ mt: 2, justifyContent: "flex-end" }}
          >
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setCustomModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleCustomRangeApply}
            >
              Apply
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default TimeRangeSelector;
