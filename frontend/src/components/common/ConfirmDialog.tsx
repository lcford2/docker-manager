import {
  Button,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/joy";
import React from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
        <DialogContent>
          <Typography id="confirm-dialog-description">{message}</Typography>
        </DialogContent>
        <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'flex-end' }}>
          <Button variant="plain" color="neutral" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="solid"
            color="danger"
            onClick={onConfirm}
            disabled={loading}
            startDecorator={loading ? <CircularProgress size="sm" /> : null}
          >
            Confirm
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};

export default ConfirmDialog;
