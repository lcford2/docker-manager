import React, { useState, useCallback } from 'react';
import {
  Box,
  ButtonGroup,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Typography,
  Divider,
} from '@mui/material';
// import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AccessTime, DateRange } from '@mui/icons-material';
import { TimeRange } from '../core/ChartTypes';

export interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  disabled?: boolean;
  showCustomRange?: boolean;
  maxRange?: TimeRange;
}

const PRESET_RANGES: Array<{ 
  key: TimeRange['preset']; 
  label: string; 
  duration: number; // milliseconds
  icon?: React.ReactNode;
}> = [
  { key: '5m', label: '5 Minutes', duration: 5 * 60 * 1000 },
  { key: '1h', label: '1 Hour', duration: 60 * 60 * 1000 },
  { key: '6h', label: '6 Hours', duration: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 Hours', duration: 24 * 60 * 60 * 1000 },
];

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  disabled = false,
  showCustomRange = true,
  maxRange,
}) => {
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(
    new Date(selectedRange.start)
  );
  const [customEnd, setCustomEnd] = useState<Date | null>(
    new Date(selectedRange.end)
  );

  // Calculate relative time range for presets
  const calculatePresetRange = useCallback((duration: number): TimeRange => {
    const end = Date.now();
    const start = end - duration;
    return { start, end };
  }, []);

  // Handle preset range selection
  const handlePresetSelect = useCallback((preset: TimeRange['preset']) => {
    const presetData = PRESET_RANGES.find(r => r.key === preset);
    if (!presetData) return;

    const range = {
      ...calculatePresetRange(presetData.duration),
      preset,
    };

    // Check against max range if provided
    if (maxRange && range.start < maxRange.start) {
      range.start = maxRange.start;
    }
    if (maxRange && range.end > maxRange.end) {
      range.end = maxRange.end;
    }

    onRangeChange(range);
  }, [calculatePresetRange, onRangeChange, maxRange]);

  // Handle custom range
  const handleCustomRangeApply = useCallback(() => {
    if (!customStart || !customEnd) return;

    const start = customStart.getTime();
    const end = customEnd.getTime();

    if (start >= end) {
      alert('Start time must be before end time');
      return;
    }

    // Check against max range if provided
    const finalStart = maxRange ? Math.max(start, maxRange.start) : start;
    const finalEnd = maxRange ? Math.min(end, maxRange.end) : end;

    const range: TimeRange = {
      start: finalStart,
      end: finalEnd,
      preset: 'custom',
    };

    onRangeChange(range);
    setCustomDialogOpen(false);
  }, [customStart, customEnd, onRangeChange, maxRange]);

  // Open custom range dialog
  const handleCustomRangeOpen = useCallback(() => {
    setCustomStart(new Date(selectedRange.start));
    setCustomEnd(new Date(selectedRange.end));
    setCustomDialogOpen(true);
  }, [selectedRange]);

  // Format duration for display
  const formatDuration = useCallback((start: number, end: number): string => {
    const duration = end - start;
    const minutes = Math.floor(duration / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }, []);

  // Get current range label
  const getCurrentRangeLabel = useCallback(() => {
    if (selectedRange.preset && selectedRange.preset !== 'custom') {
      const preset = PRESET_RANGES.find(r => r.key === selectedRange.preset);
      return preset?.label || 'Unknown';
    }
    return formatDuration(selectedRange.start, selectedRange.end);
  }, [selectedRange, formatDuration]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {/* Current Range Display */}
      <Chip
        icon={<AccessTime />}
        label={getCurrentRangeLabel()}
        variant="outlined"
        size="small"
        sx={{ mr: 1 }}
      />

      {/* Preset Range Buttons */}
      <ButtonGroup size="small" disabled={disabled}>
        {PRESET_RANGES.map((preset) => (
          <Button
            key={preset.key}
            variant={selectedRange.preset === preset.key ? 'contained' : 'outlined'}
            onClick={() => handlePresetSelect(preset.key)}
            sx={{ minWidth: 'auto', px: 1 }}
          >
            {preset.label}
          </Button>
        ))}
      </ButtonGroup>

      {/* Custom Range Button */}
      {showCustomRange && (
        <Button
          variant={selectedRange.preset === 'custom' ? 'contained' : 'outlined'}
          onClick={handleCustomRangeOpen}
          startIcon={<DateRange />}
          size="small"
          disabled={disabled}
          sx={{ ml: 1 }}
        >
          Custom
        </Button>
      )}

      {/* Custom Range Dialog */}
      <Dialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DateRange />
            <Typography variant="h6">Select Custom Time Range</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Start Time"
                type="datetime-local"
                value={customStart ? customStart.toISOString().slice(0, 16) : ''}
                onChange={(e) => setCustomStart(e.target.value ? new Date(e.target.value) : null)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  max: customEnd ? customEnd.toISOString().slice(0, 16) : undefined,
                  min: maxRange ? new Date(maxRange.start).toISOString().slice(0, 16) : undefined,
                }}
              />
              
              <TextField
                label="End Time"
                type="datetime-local"
                value={customEnd ? customEnd.toISOString().slice(0, 16) : ''}
                onChange={(e) => setCustomEnd(e.target.value ? new Date(e.target.value) : null)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: customStart ? customStart.toISOString().slice(0, 16) : undefined,
                  max: maxRange ? new Date(maxRange.end).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                }}
              />

              <Divider />

              {/* Duration Display */}
              {customStart && customEnd && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Duration: {formatDuration(customStart.getTime(), customEnd.getTime())}
                  </Typography>
                </Box>
              )}

              {/* Quick Presets in Dialog */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Quick Presets from Now:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {PRESET_RANGES.map((preset) => (
                    <Button
                      key={preset.key}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const range = calculatePresetRange(preset.duration);
                        setCustomStart(new Date(range.start));
                        setCustomEnd(new Date(range.end));
                      }}
                    >
                      Last {preset.label}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCustomRangeApply}
            variant="contained"
            disabled={!customStart || !customEnd}
          >
            Apply Range
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimeRangeSelector; 